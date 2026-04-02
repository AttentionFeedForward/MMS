import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isAdmin = session.role === 'ADMIN';
        if (!isAdmin) {
            const membership = await (prisma as any).projectMember.findUnique({
                where: {
                    userId_projectId: {
                        userId: session.userId,
                        projectId: params.id
                    }
                }
            });
            if (!membership || membership.status !== 'APPROVED') {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const body = await req.json(); 
        
        // Scenario A: Link existing material (Old logic, kept for compatibility if needed, but UI will change)
        if (body.masterMaterialId) {
            const exists = await prisma.projectArchiveItem.findFirst({
                where: {
                    projectId: params.id,
                    masterMaterialId: body.masterMaterialId
                }
            });
            
            if (exists) {
                return NextResponse.json({ error: "Material already in project" }, { status: 400 });
            }

            const item = await prisma.projectArchiveItem.create({
                data: {
                    projectId: params.id,
                    masterMaterialId: body.masterMaterialId,
                    status: 'APPROVED' // Linked items are visible in project
                }
            });
            return NextResponse.json(item);
        }

        // Scenario B: Create NEW Material container (New Logic)
        // Expects (preferred): { materialCode, manufacturerName }
        // Legacy (fallback): { materialName, manufacturerName }
        if (body.manufacturerName && (body.materialCode || body.materialName)) {
            let materialName = body.materialName;
            const materialCode = body.materialCode;

            if (materialCode) {
                const codeRow = await prisma.materialCode.findUnique({ where: { code: materialCode } });
                if (!codeRow) {
                    return NextResponse.json({ error: "Invalid materialCode" }, { status: 400 });
                }
                materialName = codeRow.name;
            }

            // 1. Find or Create Manufacturer
            let manufacturer = await prisma.manufacturer.findUnique({
                where: { name: body.manufacturerName }
            });

            if (!manufacturer) {
                manufacturer = await prisma.manufacturer.create({
                    data: { name: body.manufacturerName }
                });
            }

            // 2. Create NEW MasterMaterial
            const newMaterial = await (prisma.masterMaterial as any).create({
                data: {
                    name: materialName,
                    manufacturerId: manufacturer.id,
                    materialCode: materialCode || undefined,
                    status: isAdmin ? 'APPROVED' : 'PENDING'
                }
            });

            // 3. Link to Project
            const item = await prisma.projectArchiveItem.create({
                data: {
                    projectId: params.id,
                    masterMaterialId: newMaterial.id,
                    status: 'APPROVED' // Visible in project immediately
                }
            });

            return NextResponse.json(item);
        }

        return NextResponse.json({ error: "Invalid request data" }, { status: 400 });

    } catch (e) {
        console.error("Add Item Error:", e);
        return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
    }
}
