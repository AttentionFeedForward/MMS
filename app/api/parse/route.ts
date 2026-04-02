import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        
        // Forward to Python Service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL 
            ? `${process.env.PYTHON_SERVICE_URL}/parse`
            : 'http://localhost:8000/parse';
        
        try {
            const res = await fetch(pythonServiceUrl, {
                method: 'POST',
                body: formData, 
                // Note: When sending FormData with fetch, do NOT set Content-Type header manually.
                // The browser/runtime will set it with the boundary.
            });
            
            if (!res.ok) {
                const errText = await res.text();
                console.error("Python service error:", errText);
                return NextResponse.json({ success: false, message: 'Python service error' }, { status: 500 });
            }

            const json = await res.json();
            return NextResponse.json(json);
            
        } catch (fetchError) {
            console.error("Failed to connect to Python service:", fetchError);
            return NextResponse.json({ 
                success: false, 
                message: 'OCR Service unavailable. Please ensure Python service is running on port 8000.' 
            }, { status: 503 });
        }

    } catch (error) {
        console.error("Parse API Error:", error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
