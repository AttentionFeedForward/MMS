import { NextResponse } from 'next/server';
import { checkAndNotifyExpiredDocuments } from '@/lib/expiryService';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
    try {
        const result = await checkAndNotifyExpiredDocuments();
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Expiry check failed:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
