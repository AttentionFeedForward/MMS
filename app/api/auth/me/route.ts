import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = getSession();
  if (!session) {
    console.warn('API /auth/me: No session found (cookie missing or invalid)');
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  // Optional: Fetch fresh user data from DB to ensure role is up to date
  // (Prisma Client must be generated for this to work)
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true }
  });

  if (!user) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  return NextResponse.json({ success: true, user });
}
