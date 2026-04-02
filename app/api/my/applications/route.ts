import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch Material Applications (Documents uploaded by user)
    const materials = await (prisma.masterDocument as any).findMany({
        where: { uploaderId: session.userId },
        include: {
            manufacturer: true,
            masterMaterial: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch Project Access Requests
    const projects = await (prisma as any).projectMember.findMany({
        where: { userId: session.userId },
        include: {
            project: true
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ 
        success: true, 
        data: {
            materials,
            projects
        }
    });
  } catch (error) {
    console.error('Error fetching my applications:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
