/**
 * Escribe el archivo .xlsx (SPEC 9.3). ExcelJS se carga solo aquí, con import
 * dinámico, para no pesar en el arranque de la app (SPEC 3).
 */
import type { Sheet } from './excelSheets';

const MONEY_FORMAT = '"$ "#,##0;-"$ "#,##0';
const BRAND = 'FF6A1B9A';

function toCell(value: string | number | null, kind: Sheet['columns'][number]['kind']) {
  if (value === null) return null;
  if (kind === 'fecha' && typeof value === 'string') {
    const [y, m, d] = value.split('-').map(Number);
    // Fecha de calendario (sin hora): se guarda a mediodía UTC para que no cambie de día.
    return new Date(Date.UTC(y!, m! - 1, d!, 12));
  }
  return value;
}

export async function workbookBuffer(sheets: Sheet[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Academia Creativa Finanzas';
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      width: c.width,
      style:
        c.kind === 'pesos'
          ? { numFmt: MONEY_FORMAT }
          : c.kind === 'fecha'
            ? { numFmt: 'dd/mm/yyyy' }
            : {},
    }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    for (const row of sheet.rows) {
      ws.addRow(row.map((v, i) => toCell(v, sheet.columns[i]!.kind)));
    }
    if (sheet.total) {
      const total = ws.addRow(sheet.total);
      total.font = { bold: true };
    }
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
