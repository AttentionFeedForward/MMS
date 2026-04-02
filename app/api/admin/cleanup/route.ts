import { NextRequest, NextResponse } from 'next/server';
import { cleanupGhostData } from '@/lib/cleanupService';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        // Optional: Check for admin permission
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') {
             return NextResponse.json({ success: false, message: 'Unauthorized: Admin only' }, { status: 403 });
        }

        const result = await cleanupGhostData();
        
        return NextResponse.json({ 
            success: true, 
            message: 'Ghost data cleanup executed successfully',
            details: result 
        });
    } catch (error) {
        console.error('Manual cleanup failed:', error);
        return NextResponse.json({ success: false, message: 'Cleanup failed' }, { status: 500 });
    }
}
