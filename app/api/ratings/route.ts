
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search') || '';

        // Fetch all manufacturers with their scores
        // If search is provided, filter by manufacturer name
        // AND ensure manufacturer has documents (filters out project-archive-only manufacturers)
        const whereClause: any = {
            documents: { some: {} }
        };

        if (search) {
            whereClause.name = { contains: search };
        }

        const manufacturers = await prisma.manufacturer.findMany({
            where: whereClause,
            include: {
                scores: {
                    orderBy: { year: 'desc' },
                    take: 5 // Get recent years
                }
            },
            orderBy: { name: 'asc' }
        });

        // Format data for frontend
        const formattedData = manufacturers.map(m => {
            const scoresMap: Record<number, number> = {};
            let totalScore = 0;
            
            m.scores.forEach(s => {
                scoresMap[s.year] = s.score;
                totalScore += s.score;
            });

            // Calculate average if there are scores
            const avgScore = m.scores.length > 0 
                ? (totalScore / m.scores.length).toFixed(1) 
                : null;

            return {
                id: m.id,
                name: m.name,
                scores: scoresMap,
                average: avgScore,
                latestYear: m.scores.length > 0 ? m.scores[0].year : null
            };
        });

        return NextResponse.json(formattedData);
    } catch (error) {
        console.error('Error fetching ratings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
