import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const copyFile = promisify(fs.copyFile);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const materialId = params.id;
        const body = await req.json(); // { sourceDocumentId }

        if (!body.sourceDocumentId) {
            return NextResponse.json({ error: "Missing sourceDocumentId" }, { status: 400 });
        }

        // 1. Get Source Document
        const sourceDoc = await prisma.masterDocument.findUnique({
            where: { id: body.sourceDocumentId }
        });

        if (!sourceDoc) {
            return NextResponse.json({ error: "Source document not found" }, { status: 404 });
        }

        // 2. Create Physical Copy
        // We must copy the file physically because if the user deletes the project document,
        // we don't want to delete the original global library document.
        
        const sourcePath = path.join(process.cwd(), 'public', sourceDoc.filePath);
        
        if (!fs.existsSync(sourcePath)) {
            // If physical file is missing, we can't copy. 
            // Return error or maybe just proceed with DB only? 
            // Proceeding with DB only creates a broken link. Better error out.
            return NextResponse.json({ error: "Original file not found on server disk" }, { status: 404 });
        }

        // Generate new filename: {original_basename}_copy_{timestamp}{ext}
        // Use path.posix or manual string manipulation to ensure web-friendly paths if needed, 
        // but typically filePath comes from DB as '/uploads/...'
        
        const ext = path.extname(sourceDoc.filePath);
        const dir = path.dirname(sourceDoc.filePath); // e.g. "/uploads" or "\uploads"
        const basename = path.basename(sourceDoc.filePath, ext);
        
        const newFileName = `${basename}_copy_${Date.now()}${ext}`;
        // Normalize separators to forward slashes for DB storage
        const newRelativePath = path.join(dir, newFileName).split(path.sep).join('/');
        
        const newFullPath = path.join(process.cwd(), 'public', newRelativePath);

        await copyFile(sourcePath, newFullPath);

        // 3. Create Clone linked to new Material
        const newDoc = await prisma.masterDocument.create({
            data: {
                type: sourceDoc.type,
                filePath: newRelativePath, // Point to NEW physical file
                fileName: sourceDoc.fileName,
                expiryDate: sourceDoc.expiryDate,
                reportDate: sourceDoc.reportDate,
                parsedMeta: sourceDoc.parsedMeta,
                materialId: materialId, 
            }
        });

        return NextResponse.json(newDoc);
    } catch (e) {
        console.error("Copy Document Error:", e);
        return NextResponse.json({ error: "Failed to copy document" }, { status: 500 });
    }
}
