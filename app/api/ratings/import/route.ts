
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';

// Helper to validate and parse Excel file
async function parseExcel(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Expected format: [{ '厂家名称': 'Name', '年份': 2023, '评分': 95 }]
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    return jsonData;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const data = await parseExcel(buffer);

        if (!Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ error: 'Empty or invalid Excel file' }, { status: 400 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const row of data as any[]) {
            const manufacturerName = row['厂家名称'];
            const year = parseInt(row['年份']);
            const score = parseFloat(row['评分']);

            if (!manufacturerName || isNaN(year) || isNaN(score)) {
                results.failed++;
                results.errors.push(`Row skipped: Invalid data (Name: ${manufacturerName}, Year: ${year}, Score: ${score})`);
                continue;
            }

            // Check if manufacturer exists
            const manufacturer = await prisma.manufacturer.findUnique({
                where: { name: manufacturerName },
                include: {
                    _count: {
                        select: { documents: true }
                    }
                }
            });

            if (!manufacturer) {
                results.failed++;
                results.errors.push(`Row failed: 厂家不存在 "${manufacturerName}"`);
                continue;
            }

            // Check if manufacturer has documents (uploaded in global library)
            // Manufacturers from project archive user input have 0 documents.
            if (manufacturer._count.documents === 0) {
                results.failed++;
                results.errors.push(`Row failed: 厂家 "${manufacturerName}" 仅存在于项目档案中(无全局资料)，无法导入评分`);
                continue;
            }

            // Upsert score
            try {
                await prisma.supplierScore.upsert({
                    where: {
                        manufacturerId_year: {
                            manufacturerId: manufacturer.id,
                            year: year
                        }
                    },
                    update: { score: score },
                    create: {
                        manufacturerId: manufacturer.id,
                        year: year,
                        score: score
                    }
                });
                results.success++;
            } catch (e) {
                results.failed++;
                results.errors.push(`Row failed: Database error for "${manufacturerName}" (${year})`);
            }
        }

        return NextResponse.json({ 
            message: `Import completed. Success: ${results.success}, Failed: ${results.failed}`,
            details: results
        });

    } catch (error) {
        console.error('Error importing ratings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
