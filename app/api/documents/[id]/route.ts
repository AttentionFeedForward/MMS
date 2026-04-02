import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { getSession } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getSession();
    if (!session) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

    // Check if it's a MasterDocument
    const doc = await prisma.masterDocument.findUnique({ where: { id } });

    if (doc) {
        // It is a MasterDocument - ADMIN ONLY
        if (session.role !== 'ADMIN') {
            return NextResponse.json({ success: false, message: 'Forbidden: Admin only' }, { status: 403 });
        }
        try {
            // Use fileName to construct path, as filePath might be a full URL
            const filePath = path.join(process.cwd(), 'public', 'uploads', doc.fileName);
            if (fs.existsSync(filePath)) {
                await unlink(filePath);
            }
        } catch (e) {
            console.error("Error deleting file:", e);
        }

        // Capture relations to check for orphans after delete
        const materialId = doc.materialId;

        await prisma.masterDocument.delete({ where: { id } });

        // Clean up MasterMaterial if it becomes an orphan (no docs, no project usage)
        if (materialId) {
            try {
                const material = await prisma.masterMaterial.findUnique({
                    where: { id: materialId },
                    include: {
                        documents: true,
                        archiveItems: true
                    }
                });

                if (material && material.documents.length === 0 && material.archiveItems.length === 0) {
                    await prisma.masterMaterial.delete({
                        where: { id: materialId }
                    });
                    console.log(`Deleted orphan MasterMaterial: ${materialId}`);
                }
            } catch (cleanupError) {
                console.error("Error cleaning up orphan material:", cleanupError);
            }
        }
        
        // Sync Delete from Vector DB
        try {
            const formData = new FormData();
            formData.append('documentId', id);
            // Fire and forget, or await? Await to ensure log, but don't fail request
            const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
            fetch(`${pythonServiceUrl}/delete`, {
                method: 'POST',
                body: formData
            }).catch(err => console.error("Vector DB delete failed:", err));
        } catch (e) {
            console.error("Vector DB sync error:", e);
        }

        return NextResponse.json({ success: true });
    }

    // Check if it's a ProjectDocument (Sample Form)
    const projDoc = await prisma.projectDocument.findUnique({ where: { id } });
    
    if (projDoc) {
        // It is a ProjectDocument - Allowed for Staff (Logic for project permission can be added here)
        try {
            // Use fileName to construct path, as filePath might be a full URL
            const filePath = path.join(process.cwd(), 'public', 'uploads', projDoc.fileName);
            if (fs.existsSync(filePath)) {
                await unlink(filePath);
            }
        } catch (e) {
            console.error("Error deleting file:", e);
        }
        await prisma.projectDocument.delete({ where: { id } });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
