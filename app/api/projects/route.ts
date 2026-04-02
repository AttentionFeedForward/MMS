import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  
  const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
          archiveItems: {
              include: {
                  masterMaterial: {
                      select: { manufacturerId: true }
                  }
              }
          }
      }
  });

  let enhancedProjects = projects;

  if (session) {
      if (session.role === 'ADMIN') {
          enhancedProjects = projects.map(p => ({ ...p, membershipStatus: 'APPROVED' }));
      } else {
          const memberships = await (prisma as any).projectMember.findMany({
              where: { userId: session.userId }
          });
          const membershipMap = new Map(memberships.map((m: any) => [m.projectId, m.status]));
          
          enhancedProjects = projects.map(p => ({
              ...p,
              membershipStatus: membershipMap.get(p.id) || null
          }));
      }
  } else {
      enhancedProjects = projects.map(p => ({ ...p, membershipStatus: null }));
  }

  return NextResponse.json(enhancedProjects);
}

export async function POST(req: NextRequest) {
    const session = getSession();
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }
    try {
        const body = await req.json();
        const project = await prisma.project.create({
            data: {
                name: body.name,
                code: body.code,
                description: body.description
            }
        });
        return NextResponse.json(project);
    } catch (e) {
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
}
