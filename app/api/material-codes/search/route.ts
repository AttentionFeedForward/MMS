import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(sp.get('limit') || '50') || 50, 1), 50);

    if (!q) return NextResponse.json({ success: true, data: [] });

    const isNumeric = /^\d+$/.test(q);
    const data = await prisma.materialCode.findMany({
      where: isNumeric ? { code: { startsWith: q } } : { name: { contains: q } },
      take: limit,
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, level: true, parentCode: true },
    });

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('MaterialCode search error:', e);
    return NextResponse.json(
      { success: false, message: 'Error searching material codes' },
      { status: 500 }
    );
  }
}

