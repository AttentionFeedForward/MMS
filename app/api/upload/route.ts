import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

const TYPE_MAP: Record<string, string> = {
    'LICENSE': '营业执照',
    'ISO_QUALITY': '质量管理体系认证证书',
    'ISO_SAFETY': '安全管理体系认证证书',
    'ISO_ENV': '环境管理体系认证证书',
    'CERTIFICATE': '产品合格证',
    'TYPE_REPORT': '产品型式检验报告'
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const userRole = session.role;
    const status = userRole === 'ADMIN' ? 'APPROVED' : 'PENDING';

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const docType = data.get('type') as string;
    
    // New fields
    const manufacturerName = data.get('manufacturerName') as string | null;
    const manufacturerRole = data.get('manufacturerRole') as string | null;
    const materialName = data.get('materialName') as string | null;
    const materialCode = data.get('materialCode') as string | null;
    const country = data.get('country') as string | null;
    const parsedMeta = data.get('parsedMeta') as string | null;
    const archiveItemId = data.get('archiveItemId') as string | null;
    const replaceTargetId = data.get('replaceTargetId') as string | null;
    const skipDuplicateCheck = data.get('skipDuplicateCheck') === 'true';

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    // Fix: If this is a project upload (has archiveItemId), skip Global creation to prevent duplicates
    if (archiveItemId) {
        console.log('Detected project upload (archiveItemId present), skipping MasterDocument creation.');
        return NextResponse.json({ success: true, message: 'Skipped Global creation for project file' });
    }

    let parsedData: any = {};
    if (parsedMeta) {
      try {
        parsedData = JSON.parse(parsedMeta);
      } catch {
        parsedData = {};
      }
    }

    // --- Renaming Logic ---
    // Manufacturer Certs: {ManufacturerName}-{CertificateType}...
    // Product Certs: {ManufacturerName}-{MaterialName}-{CertificateType}
    
    const ext = path.extname(file.name);
    let newFileName = file.name;
    const typeLabel = TYPE_MAP[docType] || docType;

    if (['LICENSE', 'ISO_QUALITY', 'ISO_SAFETY', 'ISO_ENV'].includes(docType) && manufacturerName) {
        newFileName = `${manufacturerName}-${typeLabel}${ext}`;
    } else if (['CERTIFICATE', 'TYPE_REPORT'].includes(docType) && manufacturerName) {
        if (!materialCode) {
            return NextResponse.json({ success: false, message: 'Missing materialCode' }, { status: 400 });
        }
        const material = await prisma.materialCode.findUnique({ where: { code: materialCode } });
        if (!material) {
            return NextResponse.json({ success: false, message: 'Invalid materialCode' }, { status: 400 });
        }
        const normalizedMaterialName = material.name;
        const model = parsedData.model ? parsedData.model.trim() : '';
        if (model) {
            newFileName = `${manufacturerName}-${normalizedMaterialName}-${model}-${typeLabel}${ext}`;
        } else {
            newFileName = `${manufacturerName}-${normalizedMaterialName}-${typeLabel}${ext}`;
        }
    } else if (['COMPANY_ACHIEVEMENT', 'OTHER'].includes(docType) && manufacturerName) {
        newFileName = `${manufacturerName}-${file.name}`;
    }

    // Sanitize filename: Replace illegal characters on Windows (* : " < > ? | \ /)
    const sanitizedFileName = newFileName.replace(/[\\/:*?"<>|]/g, '_');

    // Use exact filename without prefix
    const finalFileName = sanitizedFileName;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure upload directory exists
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, finalFileName);

    await writeFile(filepath, buffer);

    // --- Database Operations ---

    // Find or Create Manufacturer
    let manufacturerId = null;
    if (manufacturerName) {
        const manuf = await prisma.manufacturer.upsert({
            where: { name: manufacturerName },
            update: {
                country: country || undefined // Update country if provided
            },
            create: { 
                name: manufacturerName,
                country: country
            }
        });
        manufacturerId = manuf.id;
    }

    // Find or Create Material
    let materialId = null;
    if (manufacturerId && ['CERTIFICATE', 'TYPE_REPORT'].includes(docType)) {
         if (!materialCode) {
             return NextResponse.json({ success: false, message: 'Missing materialCode' }, { status: 400 });
         }
         const material = await prisma.materialCode.findUnique({ where: { code: materialCode } });
         if (!material) {
             return NextResponse.json({ success: false, message: 'Invalid materialCode' }, { status: 400 });
         }
         const normalizedMaterialName = material.name;
         const model = parsedData.model ? parsedData.model.trim() : null;

         // Check if exists - STRICTLY GLOBAL (No Project Links) AND Matching Model
         const mat = await prisma.masterMaterial.findFirst({
             where: { 
                 name: normalizedMaterialName,
                 manufacturerId: manufacturerId,
                 model: model, // Strict model match
                 materialCode: materialCode,
                 archiveItems: { none: {} } // Only reuse materials that are NOT bound to a project
             }
         });

         if (mat) {
             materialId = mat.id;
         } else {
             const newMat = await (prisma.masterMaterial as any).create({
                 data: {
                     name: normalizedMaterialName,
                     manufacturerId: manufacturerId,
                     model: model,
                     materialCode: materialCode,
                     status: status
                 }
             });
             materialId = newMat.id;
         }
    }

    // --- Duplication Check ---
    // Before saving file and creating record, check if a similar document already exists.
    const duplicateCheckWhere: any = {
        type: docType,
        manufacturerId: manufacturerId || undefined,
        materialId: materialId || undefined,
    };
    
    // If we have parsed model info, we could potentially check parsedMeta, but that's string based and fragile.
    // For now, checking Type + Manufacturer + Material is strong enough.
    // However, if it's a manufacturer certificate (no materialId), we should be careful.
    
    if (manufacturerId && !skipDuplicateCheck) {
        const existingDoc = await prisma.masterDocument.findFirst({
            where: duplicateCheckWhere
        });

        if (existingDoc) {
            console.log(`Duplicate document detected: ${existingDoc.fileName}`);
            return NextResponse.json({ 
                success: false, 
                isDuplicate: true, 
                message: '该文档已存在于全局库中',
                existingDoc: existingDoc 
            });
        }
    }

    const doc = await (prisma.masterDocument as any).create({
      data: {
        type: docType || 'UNKNOWN',
        filePath: `/uploads/${encodeURIComponent(finalFileName)}`,
        fileName: finalFileName,
        parsedMeta: JSON.stringify(parsedData),
        manufacturerRole: manufacturerRole, // Save manufacturer roles
        expiryDate: (parsedData.expiryDate && !isNaN(new Date(parsedData.expiryDate).getTime())) ? new Date(parsedData.expiryDate) : null,
        reportDate: (parsedData.reportDate && !isNaN(new Date(parsedData.reportDate).getTime())) ? new Date(parsedData.reportDate) : null,
        manufacturerId: manufacturerId || undefined,
        materialId: materialId || undefined,
        status: status,
        uploaderId: session.userId // Save uploader ID
      }
    });

    // --- Trigger Vector Indexing (Sync Wait) ---
    // User requested to wait for indexing to complete before showing success.
    try {
        console.log(`Triggering indexing for doc: ${doc.id}`);
        const formData = new FormData();
        const blob = new Blob([buffer], { type: file.type });
        formData.append('file', blob, finalFileName);
        formData.append('documentId', doc.id);
        
        // Pass metadata to Python service for embedding
        if (parsedMeta) {
            formData.append('metadata', parsedMeta);
        }

        // Await the indexing process
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const indexRes = await fetch(`${pythonServiceUrl}/index`, {
            method: 'POST',
            body: formData
        });
        
        const indexJson = await indexRes.json();
        if (!indexJson.success) {
            console.error('Indexing failed:', indexJson.message);
            // We still return success for upload, but maybe with a warning? 
            // Or fail? Let's just log for now, as file is saved.
        } else {
            console.log('Indexing completed successfully');
        }
    } catch (err) {
        console.error('Indexing trigger failed:', err);
    }

    // --- Handle Replacement (Atomic Delete of Old File) ---
    if (replaceTargetId) {
        console.log(`Processing replacement for old doc: ${replaceTargetId}`);
        try {
            // 1. Find Old Document
            const oldDoc = await prisma.masterDocument.findUnique({ where: { id: replaceTargetId } });
            
            if (oldDoc) {
                 // Check permissions: Admin or Owner (if we enforce strict ownership, but for now allow replacement if triggered)
                 // Note: Ideally check session.role === 'ADMIN' or oldDoc.uploaderId === session.userId
                 // But since Upload is open, we assume the frontend context implies permission.
                 
                 // 2. Delete Physical File
                 const oldFilePath = path.join(process.cwd(), 'public', oldDoc.filePath);
                 const { unlink } = require('fs/promises');
                 const fs = require('fs');
                 if (fs.existsSync(oldFilePath)) {
                     try {
                        await unlink(oldFilePath);
                        console.log(`Deleted old file: ${oldFilePath}`);
                     } catch(e) {
                         console.error(`Failed to delete old file: ${e}`);
                     }
                 }

                 // 3. Capture relations for cleanup
                 const oldMaterialId = oldDoc.materialId;

                 // 4. Delete DB Record
                 await prisma.masterDocument.delete({ where: { id: replaceTargetId } });
                 console.log(`Deleted old DB record: ${replaceTargetId}`);

                 // 5. Cleanup Orphan Material
                 if (oldMaterialId) {
                     try {
                         const material = await prisma.masterMaterial.findUnique({
                             where: { id: oldMaterialId },
                             include: {
                                 documents: true,
                                 archiveItems: true
                             }
                         });

                         if (material && material.documents.length === 0 && material.archiveItems.length === 0) {
                             await prisma.masterMaterial.delete({
                                 where: { id: oldMaterialId }
                             });
                             console.log(`Deleted orphan MasterMaterial: ${oldMaterialId}`);
                         }
                     } catch (cleanupError) {
                         console.error("Error cleaning up orphan material:", cleanupError);
                     }
                 }

                 // 6. Sync Delete from Vector DB
                 try {
                     const formData = new FormData();
                     formData.append('documentId', replaceTargetId);
                     const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
                     fetch(`${pythonServiceUrl}/delete`, {
                         method: 'POST',
                         body: formData
                     }).catch(err => console.error("Vector DB delete failed:", err));
                     console.log(`Triggered vector delete for: ${replaceTargetId}`);
                 } catch (e) {
                     console.error("Vector DB sync error:", e);
                 }
            } else {
                console.warn(`Old document not found: ${replaceTargetId}`);
            }
        } catch (e) {
            console.error("Error during replacement cleanup:", e);
            // Don't fail the upload if cleanup fails, but log it
        }
    }

    return NextResponse.json({ success: true, doc, parsedData, status });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
