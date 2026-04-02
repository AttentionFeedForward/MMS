import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
    const materials = await prisma.masterMaterial.findMany({
        include: { manufacturer: true }
    });
    return NextResponse.json(materials);
}
