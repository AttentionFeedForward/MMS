import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const copyFile = promisify(fs.copyFile);

export async function POST(req: NextRequest, { params }: { params: { itemId: string } }) {
    try {
        const archiveItemId = params.itemId;
        const body = await req.json(); // { sourceDocumentId }

        if (!body.sourceDocumentId) {
            return NextResponse.json({ error: "Missing sourceDocumentId" }, { status: 400 });
        }

        // 1. Get Source Document (from Global Library)
        const sourceDoc = await prisma.masterDocument.findUnique({
            where: { id: body.sourceDocumentId }
        });

        if (!sourceDoc) {
            return NextResponse.json({ error: "Source document not found" }, { status: 404 });
        }

        // 2. Create Physical Copy
        // Ensure independence between Project Library and Global Library
        
        // Handle potentially URL-encoded paths or absolute URLs from legacy data
        let relativeSourcePath = sourceDoc.filePath;
        if (relativeSourcePath.startsWith('http')) {
             try {
                 const url = new URL(relativeSourcePath);
                 relativeSourcePath = decodeURIComponent(url.pathname);
             } catch (e) {
                 // Fallback if not a valid URL
                 relativeSourcePath = decodeURIComponent(relativeSourcePath);
             }
        } else {
             relativeSourcePath = decodeURIComponent(relativeSourcePath);
        }

        // Remove leading slash if present to join correctly
        if (relativeSourcePath.startsWith('/') || relativeSourcePath.startsWith('\\')) {
            relativeSourcePath = relativeSourcePath.substring(1);
        }

        const sourcePath = path.join(process.cwd(), 'public', relativeSourcePath);
        
        if (!fs.existsSync(sourcePath)) {
            console.error(`File not found at: ${sourcePath}`);
            return NextResponse.json({ error: "Original file not found on server disk" }, { status: 404 });
        }

        const ext = path.extname(relativeSourcePath);
        const dir = path.dirname(relativeSourcePath); 
        const basename = path.basename(relativeSourcePath, ext);
        
        // Add a suffix to indicate it's a project copy
        const newFileName = `${basename}_prj_${Date.now()}${ext}`;
        
        // Construct new paths
        const newRelativePath = path.join(dir, newFileName).split(path.sep).join('/');
        const newFullPath = path.join(process.cwd(), 'public', newRelativePath);

        await copyFile(sourcePath, newFullPath);

        // 3. Create ProjectDocument
        // Instead of MasterDocument, we create a ProjectDocument.
        // This ensures it DOES NOT appear in Global Search.
        // Add leading slash for web access if missing
        const webPath = newRelativePath.startsWith('/') ? newRelativePath : '/' + newRelativePath;

        const newDoc = await prisma.projectDocument.create({
            data: {
                type: sourceDoc.type,
                filePath: webPath,
                fileName: sourceDoc.fileName,
                archiveItemId: archiveItemId,
                parsedMeta: sourceDoc.parsedMeta // Copy parsedMeta
            }
        });

        return NextResponse.json(newDoc);
    } catch (e) {
        console.error("Reference Document Error:", e);
        return NextResponse.json({ error: "Failed to reference document" }, { status: 500 });
    }
}
