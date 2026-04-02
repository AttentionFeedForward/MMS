import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params; // ProjectMember ID
    const { action, reason } = await request.json(); // action: 'APPROVE' | 'REJECT' | 'REVOKE'

    if (!['APPROVE', 'REJECT', 'REVOKE'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    let status = 'PENDING';
    if (action === 'APPROVE') status = 'APPROVED';
    if (action === 'REJECT' || action === 'REVOKE') status = 'REJECTED';

    const member = await (prisma as any).projectMember.update({
      where: { id },
      data: { 
          status,
          rejectReason: action === 'REJECT' ? reason : null
      }
    });

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error('Error processing project approval:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
