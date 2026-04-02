import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  cookies().delete('auth_token');
  return NextResponse.json({ success: true, message: 'Logged out' });
}
