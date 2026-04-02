import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const projectId = params.id;

        // 1. Fetch Project with all materials and documents
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                archiveItems: {
                    include: {
                        masterMaterial: {
                            include: {
                                manufacturer: {
                                    include: {
                                        documents: true
                                    }
                                },
                                documents: true
                            }
                        },
                        documents: true // Project specific documents
                    }
                }
            }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // 2. Setup Archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // 3. Create a stream response
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        const encoder = new TextEncoder();

        // Pipe archive data to the response stream
        archive.on('data', (chunk: any) => {
            writer.write(chunk);
        });

        archive.on('end', () => {
            writer.close();
        });

        archive.on('error', (err: any) => {
            console.error('Archiver error:', err);
            writer.abort(err);
        });

        // 4. Generate Excel File: "物料报审表.xlsx"
        // Columns: 序号, 物料名称, 规格型号, 厂家名称
        const excelData = project.archiveItems.map((item, index) => {
            let materialName = item.masterMaterial.name;
            let model = item.masterMaterial.model || '-';
            let manufacturerName = item.masterMaterial.manufacturer.name;

            // Try to extract from documents
            // Priority: CERTIFICATE > TYPE_REPORT
            // Updated Logic: Check Project Documents (ArchiveItem.documents) instead of Master Material Documents
            const validTypes = ['CERTIFICATE', 'TYPE_REPORT'];
            
            // Use project-specific documents (ProjectDocument[])
            const projectDocs = item.documents || [];
            
            if (projectDocs.length > 0) {
                const sortedDocs = projectDocs
                    .filter(doc => validTypes.includes(doc.type))
                    .sort((a, b) => {
                         // specific sort order: CERTIFICATE first
                         if (a.type === 'CERTIFICATE' && b.type !== 'CERTIFICATE') return -1;
                         if (a.type !== 'CERTIFICATE' && b.type === 'CERTIFICATE') return 1;
                         return 0;
                    });
    
                for (const doc of sortedDocs) {
                    if (doc.parsedMeta) {
                        try {
                            const meta = JSON.parse(doc.parsedMeta);
                            console.log(`[Export Debug] Doc ID: ${doc.id}, Type: ${doc.type}, Meta:`, meta);
                            
                            // 1. Model
                            if (meta.model && meta.model.trim() !== '') {
                                console.log(`[Export Debug] Found Model in Meta: ${meta.model}`);
                                model = meta.model.trim();
                            }
                            
                            // 2. Material Name (Priority: parsedMeta > DB)
                            if (meta.materialName && meta.materialName.trim() !== '') {
                                console.log(`[Export Debug] Found MaterialName in Meta: ${meta.materialName}`);
                                materialName = meta.materialName.trim();
                            }

                            // 3. Manufacturer Name (Priority: parsedMeta > DB)
                            if (meta.manufacturerName && meta.manufacturerName.trim() !== '') {
                                console.log(`[Export Debug] Found ManufacturerName in Meta: ${meta.manufacturerName}`);
                                manufacturerName = meta.manufacturerName.trim();
                            }

                            // If we found a valid certificate, we use its data and stop looking at other docs?
                            // Or should we merge? Usually one good certificate is enough.
                            // Let's break if we found at least the material name or manufacturer name to avoid mixing data from different docs too much.
                            if (model !== '-' || meta.materialName || meta.manufacturerName) {
                                break;
                            }
                            
                        } catch (e) {
                            console.error("Error parsing parsedMeta for doc", doc.id, e);
                        }
                    } else {
                        console.log(`[Export Debug] Doc ID: ${doc.id} has NO parsedMeta`);
                    }
                }
            }

            return {
                "序号": index + 1,
                "物料编码": item.masterMaterial.materialCode,
                "物料名称": materialName,
                "规格型号": model,
                "厂家名称": manufacturerName
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        // Set column widths
        const colWidths = [
            { wch: 8 },  // 序号
            { wch: 20 }, // 物料编码
            { wch: 30 }, // 物料名称
            { wch: 25 }, // 规格型号
            { wch: 35 }  // 厂家名称
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "物料报审表");
        
        // Write Excel to buffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        
        // Add Excel to archive
        archive.append(excelBuffer, { name: '物料报审表.xlsx' });



        // 5. Add files to archive
        // Structure: ProjectName / MaterialName-Manufacturer / Documents...
        
        for (const item of project.archiveItems) {
            const materialCode = item.masterMaterial.materialCode.replace(/[\\/:*?"<>|]/g, '_');
            const materialName = item.masterMaterial.name.replace(/[\\/:*?"<>|]/g, '_');
            const manufacturerName = item.masterMaterial.manufacturer.name.replace(/[\\/:*?"<>|]/g, '_');
            const folderName = `${materialCode}-${materialName}-${manufacturerName}`;

            // C. Sealing Form (Project Specific)
            const projectDocs = item.documents || [];
            
            // Separate Sealing Forms from other project documents (referenced certificates)
            const sealingForms = projectDocs.filter((d: any) => d.type === 'SAMPLE_SEALING_FORM');
            const otherProjectDocs = projectDocs.filter((d: any) => d.type !== 'SAMPLE_SEALING_FORM');

            // A. Manufacturer Qualification Certificates and Product Certificates
            // Combine General Documents (Product Certs), Manufacturer Documents, and Referenced Project Certificates
            const combinedDocs = [
                ...(item.masterMaterial.documents || []),
                ...(item.masterMaterial.manufacturer?.documents || []),
                ...otherProjectDocs
            ];
            
            for (const doc of combinedDocs) {
                const filePath = path.join(process.cwd(), 'public', doc.filePath);
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: `${folderName}/厂家资质证书和产品证书/${doc.fileName}` });
                }
            }

            // B. (Removed separate Manufacturer Documents loop as it is combined above)

            for (const doc of sealingForms) {
                const filePath = path.join(process.cwd(), 'public', doc.filePath);
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: `${folderName}/封样单/${doc.fileName}` });
                }
            }
        }

        // Finalize the archive (this triggers the 'end' event)
        archive.finalize();

        // 5. Return Response
        const responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/zip');
        responseHeaders.set('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.zip"`);

        return new NextResponse(stream.readable, {
            headers: responseHeaders
        });

    } catch (e) {
        console.error("Export failed:", e);
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
}
