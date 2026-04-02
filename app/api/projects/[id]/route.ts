import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
        const membership = await (prisma as any).projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.userId,
                    projectId: params.id
                }
            }
        });
        
        if (!membership || membership.status !== 'APPROVED') {
            return NextResponse.json({ error: "Forbidden: You do not have access to this project" }, { status: 403 });
        }
    }

    const project = await prisma.project.findUnique({
        where: { id: params.id },
        include: {
            archiveItems: {
                include: {
                    masterMaterial: {
                        include: {
                            manufacturer: true,
                            documents: true
                        }
                    },
                    documents: true
                }
            }
        }
    });
    
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const project = await prisma.project.update({
            where: { id: params.id },
            data: {
                name: body.name,
                code: body.code,
                description: body.description,
                status: body.status
            }
        });
        return NextResponse.json(project);
    } catch (e) {
        console.error("Update project failed:", e);
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    try {
        // Use transaction to ensure all related data is deleted
        await prisma.$transaction(async (tx) => {
            // 1. Find all Archive Items to get their IDs
            const archiveItems = await tx.projectArchiveItem.findMany({
                where: { projectId: params.id },
                select: { id: true }
            });
            const archiveItemIds = archiveItems.map(item => item.id);

            // 2. Delete all Project Documents associated with these Archive Items
            if (archiveItemIds.length > 0) {
                await tx.projectDocument.deleteMany({
                    where: { archiveItemId: { in: archiveItemIds } }
                });
            }

            // 3. Delete Project Archive Items
            await tx.projectArchiveItem.deleteMany({
                where: { projectId: params.id }
            });

            // 4. Delete Project Members
            await tx.projectMember.deleteMany({
                where: { projectId: params.id }
            });

            // 5. Delete the Project
            await tx.project.delete({
                where: { id: params.id }
            });
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Delete project failed:", e);
        return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to delete project" }, { status: 500 });
    }
}
