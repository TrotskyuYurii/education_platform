import ExcelJS from 'exceljs';

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

export async function buildXlsx(sheetName: string, columns: ExportColumn[], rows: Record<string, any>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 20 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach(row => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function csvEscape(value: any): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(columns: ExportColumn[], rows: Record<string, any>[]): string {
  const header = columns.map(c => csvEscape(c.header)).join(';');
  const lines = rows.map(row => columns.map(c => csvEscape(row[c.key])).join(';'));
  // BOM so Excel opens UTF-8 Cyrillic text correctly instead of mangling it.
  return '﻿' + [header, ...lines].join('\r\n');
}
