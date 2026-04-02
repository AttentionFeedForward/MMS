import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 });
    }

    const user = await (prisma as any).user.findUnique({
      where: { username }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // Generate Token
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    const token = signToken(payload);

    // Set Cookie
    // Note: 'secure: true' requires HTTPS. Since we are deploying on HTTP (IP access),
    // we must set secure to false, otherwise the browser will not send the cookie back.
    const isSecure = process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:';
    
    cookies().set('auth_token', token, {
      httpOnly: true,
      secure: false, // Force false to allow HTTP connection on IP
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
