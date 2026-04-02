import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const country = searchParams.get('country');
    const manufacturerName = searchParams.get('manufacturer');
    const materialName = searchParams.get('material');
    const materialCode = searchParams.get('materialCode');
    const model = searchParams.get('model');
    const type = searchParams.get('type');
    const types = searchParams.get('types');
    const manufacturerRoles = searchParams.get('manufacturerRoles');
    const advanced = searchParams.get('advanced') === 'true';

    // --- Build Where Clause (Common for both Basic and Advanced Search) ---
    const whereClause: any = {};
    whereClause.status = 'APPROVED'; // Always enforce APPROVED status

    if (types) {
        whereClause.type = { in: types.split(',') };
    } else if (type) {
        whereClause.type = type;
    }

    if (country) {
        whereClause.manufacturer = { 
            country: { contains: country } 
        };
    }
    
    if (manufacturerName) {
        whereClause.manufacturer = {
            ...whereClause.manufacturer,
            name: { contains: manufacturerName }
        };
    }

    if (materialName) {
        whereClause.masterMaterial = {
            name: { contains: materialName }
        };
    }

    if (materialCode) {
        whereClause.masterMaterial = {
            ...whereClause.masterMaterial,
            materialCode: materialCode
        };
    }

    if (model) {
        whereClause.parsedMeta = { contains: model };
    }

    if (manufacturerRoles) {
        const roles = manufacturerRoles.split(',');
        // Use AND to ensure role criteria is met along with other filters
        if (!whereClause.AND) {
            whereClause.AND = [];
        }
        whereClause.AND.push({
            OR: roles.map(role => ({ manufacturerRole: { contains: role } }))
        });
    }

    // --- Advanced Semantic Search ---
    if (advanced && q) {
        try {
            // Pre-filtering: Get Allowed Document IDs based on filters
            // Check if we have filters other than status
            const hasFilters = types || type || country || manufacturerName || materialName || materialCode || model;
            let allowedIds: string[] | undefined = undefined;

            if (hasFilters) {
                // Fetch IDs matching the filters
                const allowedDocs = await prisma.masterDocument.findMany({
                    where: whereClause,
                    select: { id: true }
                });
                
                allowedIds = allowedDocs.map(doc => doc.id);
                
                // Optimization: If filter results in 0 docs, return early
                if (allowedIds.length === 0) {
                     return NextResponse.json({ success: true, data: [], isAdvanced: true });
                }
            }

            // Call Python Service
            const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
            const pythonRes = await fetch(`${pythonServiceUrl}/search_advanced`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: q, 
                    top_k: 10,
                    allowed_ids: allowedIds
                })
            });
            const pythonJson = await pythonRes.json();
            
            if (pythonJson.success && pythonJson.results) {
                // Results: [{ id: 'docId_chunk_0', text: '...', ... }]
                // Extract docIds
                const results = pythonJson.results;
                const docIdMap = new Map<string, any>(); // docId -> { text, score } (Best match per doc)
                
                for (const res of results) {
                    const docId = res.id.split('_chunk_')[0];
                    // Keep the best scoring chunk for each document
                    if (!docIdMap.has(docId) || res.score > docIdMap.get(docId).score) {
                        docIdMap.set(docId, res);
                    }
                }

                const docIds = Array.from(docIdMap.keys());
                
                // Fetch Docs from DB
                const dbDocs = await prisma.masterDocument.findMany({
                    where: { 
                        id: { in: docIds },
                        status: 'APPROVED'
                    },
                    include: {
                        manufacturer: true,
                        masterMaterial: true
                    }
                });

                // Merge Results
                const finalDocs = dbDocs.map(doc => {
                    const match = docIdMap.get(doc.id);
                    return {
                        ...doc,
                        matchedFragment: match ? match.text : null,
                        relevanceScore: match ? match.score : 0,
                        llmRelevant: match ? match.llm_relevant : false,
                        llmReasoning: match ? match.llm_reasoning : null
                    };
                });

                // Sort by relevanceScore ASCENDING (Rank 1, 2, 3...)
                // Note: Python returns rank as 1, 2, 3. So lower is better.
                finalDocs.sort((a, b) => a.relevanceScore - b.relevanceScore);
                
                return NextResponse.json({ success: true, data: finalDocs, isAdvanced: true });
            }
        } catch (e) {
            console.error("Advanced search failed, falling back to basic:", e);
            // Fallback to basic search below
        }
    }

    // Generic Search (Basic)
    // Add text search conditions to whereClause if not advanced
    if (!country && !manufacturerName && !materialName && q) {
        whereClause.OR = [
            { fileName: { contains: q } },
            { manufacturer: { name: { contains: q } } },
            { masterMaterial: { name: { contains: q } } },
            { parsedMeta: { contains: q } }
        ];
    }

    const docs = await prisma.masterDocument.findMany({
        where: whereClause,
        include: {
            manufacturer: true,
            masterMaterial: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return NextResponse.json({ success: true, data: docs });
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE') throw error;
    console.error("Search Error", error);
    return NextResponse.json({ success: false, message: "Error searching" }, { status: 500 });
  }
}
