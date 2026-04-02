import path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

function normalizeHeaderKey(key: unknown) {
  return String(key ?? '').trim();
}

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : Number(String(val).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeCode(raw: unknown, level: number | null): string | null {
  if (raw === null || raw === undefined) return null;
  let code = String(raw).trim();
  if (!code) return null;

  if (/^\d+(\.0+)?$/.test(code)) code = code.replace(/\.0+$/, '');
  if (!/^\d+$/.test(code)) return null;

  const lenByLevel: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8 };
  const targetLen = level ? lenByLevel[level] : undefined;
  if (targetLen) code = code.padStart(targetLen, '0');
  return code;
}

function parentCodeOf(code: string, level: number): string | null {
  if (level <= 1) return null;
  const lenByLevel: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8 };
  return code.slice(0, lenByLevel[level - 1]);
}

async function main() {
  const excelArg = process.argv[2];
  const excelPath = excelArg
    ? path.resolve(process.cwd(), excelArg)
    : path.resolve(process.cwd(), '物料编码分级表.xlsx');

  const workbook = XLSX.readFile(excelPath, { cellDates: false });

  let upserted = 0;
  let skipped = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: true,
    });

    for (const row of rows) {
      const normalized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) normalized[normalizeHeaderKey(k)] = v;

      const level = toInt(normalized['级别']);
      const code = normalizeCode(normalized['物料编码'], level);
      const name = String(normalized['物料名称'] ?? '').trim();
      if (!level || level < 1 || level > 4 || !code || !name) {
        skipped += 1;
        continue;
      }

      await prisma.materialCode.upsert({
        where: { code },
        update: { name, level, parentCode: parentCodeOf(code, level) },
        create: { code, name, level, parentCode: parentCodeOf(code, level) },
      });
      upserted += 1;
    }
  }

  console.log(JSON.stringify({ excelPath, sheets: workbook.SheetNames.length, upserted, skipped }, null, 2));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

