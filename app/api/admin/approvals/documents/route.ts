import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const allDocs = await (prisma.masterDocument as any).findMany({
      // Remove status filter to show all documents (Pending, Approved, Rejected)
      include: {
        manufacturer: true,
        masterMaterial: true,
        uploader: {
            select: { username: true } // Include uploader info
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: allDocs });
  } catch (error) {
    console.error('Error fetching pending documents:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
