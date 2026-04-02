import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { action, reason } = await request.json(); // action: 'APPROVE' | 'REJECT', reason: string

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const doc = await (prisma.masterDocument as any).update({
      where: { id },
      data: { 
          status,
          rejectReason: action === 'REJECT' ? reason : null 
      }
    });

    // If approved and linked to a material, approve the material as well
    if (action === 'APPROVE' && doc.materialId) {
        await (prisma.masterMaterial as any).update({
            where: { id: doc.materialId },
            data: { status: 'APPROVED' }
        });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error('Error processing document approval:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // 1. Get document info to delete file
    const doc = await (prisma.masterDocument as any).findUnique({
        where: { id }
    });

    if (!doc) {
        return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // 2. Delete from Database
    await (prisma.masterDocument as any).delete({
        where: { id }
    });

    // Sync Delete from Vector DB
    try {
        const formData = new FormData();
        formData.append('documentId', id);
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        fetch(`${pythonServiceUrl}/delete`, {
            method: 'POST',
            body: formData
        }).catch(err => console.error("Vector DB delete failed:", err));
    } catch (e) {
        console.error("Vector DB sync error:", e);
    }

    // 3. Delete file from disk (Optional but recommended)
    // Note: In a real production system, you might want to soft-delete or move to trash.
    // For now, we will try to delete the file if it exists.
    try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'public', doc.filePath);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error('Error deleting file from disk:', err);
        // Continue even if file delete fails
    }

    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
