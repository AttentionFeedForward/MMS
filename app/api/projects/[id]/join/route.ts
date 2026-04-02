import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.userId;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) {
      return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    }

    // Check existing membership
    const existingMember = await (prisma as any).projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId
        }
      }
    });

    if (existingMember) {
      if (existingMember.status === 'APPROVED') {
        return NextResponse.json({ success: false, message: 'You are already a member of this project' }, { status: 400 });
      }
      if (existingMember.status === 'PENDING') {
        return NextResponse.json({ success: false, message: 'Access request is already pending' }, { status: 400 });
      }
      // If REJECTED, update to PENDING
      const updatedMember = await (prisma as any).projectMember.update({
        where: { id: existingMember.id },
        data: { status: 'PENDING' }
      });
      return NextResponse.json({ success: true, message: 'Access request re-submitted', data: updatedMember });
    }

    // Create new request
    const newMember = await (prisma as any).projectMember.create({
      data: {
        userId,
        projectId,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, message: 'Access request submitted', data: newMember });
  } catch (error) {
    console.error('Error requesting project access:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
