import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const docType = data.get('type') as string;
    const archiveItemId = data.get('archiveItemId') as string;

    if (!file || !archiveItemId) {
      return NextResponse.json({ success: false, message: 'Missing file or archiveItemId' }, { status: 400 });
    }

    // Verify Access
    if (session.role !== 'ADMIN') {
        const archiveItem = await prisma.projectArchiveItem.findUnique({
            where: { id: archiveItemId },
            select: { projectId: true }
        });

        if (!archiveItem) {
            return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 });
        }

        const membership = await (prisma as any).projectMember.findUnique({
             where: {
                 userId_projectId: {
                     userId: session.userId,
                     projectId: archiveItem.projectId
                 }
             }
         });

        if (!membership || membership.status !== 'APPROVED') {
             return NextResponse.json({ success: false, message: 'Forbidden: Project access not approved' }, { status: 403 });
        }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const doc = await prisma.projectDocument.create({
      data: {
        type: docType || 'SAMPLE_SEALING_FORM',
        filePath: `/uploads/${encodeURIComponent(filename)}`,
        fileName: file.name,
        archiveItemId: archiveItemId
      }
    });

    return NextResponse.json({ success: true, doc });
  } catch (error) {
    console.error('Project Upload error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
