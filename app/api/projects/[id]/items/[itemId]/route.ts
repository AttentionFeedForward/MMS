import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// Helper for Auth
async function checkAccess(projectId: string) {
    const session = await getSession();
    if (!session) return { authorized: false, status: 401 };

    if (session.role === 'ADMIN') return { authorized: true };

    const membership = await (prisma as any).projectMember.findUnique({
        where: {
            userId_projectId: {
                userId: session.userId,
                projectId: projectId
            }
        }
    });

    if (membership && membership.status === 'APPROVED') {
        return { authorized: true };
    }

    return { authorized: false, status: 403 };
}

// DELETE Item from Project
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string; itemId: string } }
) {
    try {
        const { id: projectId, itemId } = params;

        const access = await checkAccess(projectId);
        if (!access.authorized) {
            return NextResponse.json({ error: "Forbidden" }, { status: access.status || 403 });
        }

        // 1. Find the item to ensure it belongs to this project
        const item = await prisma.projectArchiveItem.findUnique({
            where: { id: itemId },
            include: { masterMaterial: true }
        });

        if (!item || item.projectId !== projectId) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        // 2. Delete the ProjectArchiveItem and its associated ProjectDocuments in a transaction
        await prisma.$transaction(async (tx) => {
            // Delete associated Project Documents (e.g., Sample Sealing Forms)
            await tx.projectDocument.deleteMany({
                where: { archiveItemId: itemId }
            });

            // Delete the ProjectArchiveItem
            await tx.projectArchiveItem.delete({
                where: { id: itemId }
            });
        });

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error("Delete Item Error:", e);
        return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete item" }, { status: 500 });
    }
}

// UPDATE Item (Rename Material)
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string; itemId: string } }
) {
    try {
        const { id: projectId, itemId } = params;

        const access = await checkAccess(projectId);
        if (!access.authorized) {
            return NextResponse.json({ error: "Forbidden" }, { status: access.status || 403 });
        }

        const body = await req.json(); // { materialCode?, materialName?, manufacturerName? }

        // 1. Get the item to find the MasterMaterial ID
        const item = await prisma.projectArchiveItem.findUnique({
            where: { id: itemId }
        });

        if (!item) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        // 2. Update the MasterMaterial name / code if provided
        const updateData: any = {};

        if (body.materialCode) {
            const codeRow = await (prisma as any).materialCode.findUnique({
                where: { code: body.materialCode }
            });
            if (!codeRow) {
                return NextResponse.json({ error: "Invalid materialCode" }, { status: 400 });
            }
            updateData.name = codeRow.name;
            updateData.materialCode = codeRow.code;
        } else if (body.materialName) {
            updateData.name = body.materialName;
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.masterMaterial.update({
                where: { id: item.masterMaterialId },
                data: updateData
            });
        }

        // 3. Update Manufacturer Name if provided
        if (body.manufacturerName) {
            const material = await prisma.masterMaterial.findUnique({
                where: { id: item.masterMaterialId },
                select: { manufacturerId: true }
            });

            if (material) {
                // Check if target name already exists
                const existingManuf = await prisma.manufacturer.findUnique({
                    where: { name: body.manufacturerName }
                });

                if (existingManuf) {
                    // If exists, we can't just rename. We should move the material to the existing manufacturer.
                    await prisma.masterMaterial.update({
                        where: { id: item.masterMaterialId },
                        data: { manufacturerId: existingManuf.id }
                    });
                } else {
                    // If not exists, safe to rename
                    await prisma.manufacturer.update({
                        where: { id: material.manufacturerId },
                        data: { name: body.manufacturerName }
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Update Item Error:", e);
        return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
    }
}
