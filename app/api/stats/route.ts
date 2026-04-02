import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    // 1. Manufacturer Count: Only count those with at least one document
    const manufacturerCount = await prisma.manufacturer.count({
        where: {
            documents: { some: {} }
        }
    });

    // 2. Material Count: Only count those with at least one document
    const materialCount = await prisma.masterMaterial.count({
        where: {
            documents: { some: {} }
        }
    });
    
    const projectCount = await prisma.project.count();
    
    // Country stats (Only for manufacturers with documents)
    const countries = await prisma.manufacturer.groupBy({
        by: ['country'],
        where: {
            documents: { some: {} }
        },
        _count: {
            id: true
        }
    });

    // Project stats: Include both materials count (archiveItems) and distinct manufacturers count
    // Since we can't easily do distinct count in a single prisma query for nested relations in this way,
    // we fetch the data and process it.
    const projectsData = await prisma.project.findMany({
        select: {
            name: true,
            archiveItems: {
                select: {
                    masterMaterial: {
                        select: {
                            manufacturerId: true
                        }
                    }
                }
            }
        }
    });

    const projectStats = projectsData.map((p: any) => {
        const uniqueManufacturerIds = new Set(
            p.archiveItems
                .map((item: any) => item.masterMaterial?.manufacturerId)
                .filter((id: any) => id !== undefined && id !== null)
        );
        
        return {
            name: p.name,
            materials: p.archiveItems.length,
            manufacturers: uniqueManufacturerIds.size
        };
    });

    // Manufacturer Role Stats
    const docs = await prisma.masterDocument.findMany({
        select: { manufacturerRole: true },
        where: { manufacturerRole: { not: null } }
    });

    const roleCounts: Record<string, number> = {
        '生产厂家': 0,
        '供应商': 0,
        '组装厂': 0
    };

    docs.forEach((doc: any) => {
        if (doc.manufacturerRole) {
            const roles = doc.manufacturerRole.split(',');
            roles.forEach((role: any) => {
                const trimmedRole = role.trim();
                if (roleCounts[trimmedRole] !== undefined) {
                    roleCounts[trimmedRole]++;
                } else if (trimmedRole === 'MANUFACTURER') {
                    roleCounts['生产厂家']++;
                } else if (trimmedRole === 'SUPPLIER') {
                    roleCounts['供应商']++;
                } else if (trimmedRole === 'ASSEMBLER') {
                    roleCounts['组装厂']++;
                }
            });
        }
    });

    const roleStats = Object.keys(roleCounts).map(key => ({
        name: key,
        value: roleCounts[key]
    })).filter(item => item.value > 0);

    return NextResponse.json({
        counts: {
            manufacturers: manufacturerCount,
            materials: materialCount,
            projects: projectCount,
        },
        countryStats: countries.map(c => ({ name: c.country || 'Unknown', value: c._count.id })),
        projectStats: projectStats,
        roleStats: roleStats
    });
}
