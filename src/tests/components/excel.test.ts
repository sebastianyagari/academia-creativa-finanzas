import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { workbookBuffer } from '../../features/ajustes/exportExcel';
import { buildSheets, excelFileName } from '../../features/ajustes/excelSheets';
import { createDemoData } from '../../state/demo';
import { idGen } from '../helpers';

const demo = createDemoData('2026-10-21', idGen('x'));
const sheets = buildSheets(demo, '2026-10');

describe('exportar a Excel (SPEC 9.3)', () => {
  it('trae las seis hojas de la SPEC', () => {
    expect(sheets.map((s) => s.name)).toEqual([
      'Movimientos',
      'Resumen por mes',
      'Presupuesto',
      'Metas',
      'Deudas',
      'Cuentas',
    ]);
    expect(excelFileName('2026-10-21')).toBe('academia-finanzas-2026-10-21.xlsx');
  });

  it('Movimientos: uno por fila, en orden de fecha', () => {
    const mov = sheets[0]!;
    expect(mov.rows).toHaveLength(demo.transactions.length);
    const dates = mov.rows.map((r) => r[0] as string);
    expect([...dates].sort()).toEqual(dates);
  });

  it('el resumen por mes cuadra con sus totales', () => {
    const res = sheets[1]!;
    expect(res.rows.map((r) => r[0])).toEqual([
      'Mayo 2026',
      'Junio 2026',
      'Julio 2026',
      'Agosto 2026',
      'Septiembre 2026',
      'Octubre 2026',
    ]);
    const ingresos = res.rows.reduce((s, r) => s + (r[1] as number), 0);
    expect(res.total![1]).toBe(ingresos);
  });

  it('cuentas y deudas muestran los saldos de hoy', () => {
    const cuentas = sheets[5]!.rows;
    expect(cuentas).toContainEqual(['Bancolombia ahorros', 'Banco', 2_350_000]);
    expect(cuentas).toContainEqual(['Tarjeta de crédito', 'Tarjeta de crédito', -3_200_000]);
    expect(sheets[4]!.rows).toContainEqual([
      'Crédito de libre inversión',
      'Crédito',
      4_500_000,
      22,
      260_000,
      'Enero 2028',
    ]);
  });

  it('el archivo se abre con las hojas, fechas reales y formato de pesos', async () => {
    const buffer = await workbookBuffer(sheets);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(sheets.map((s) => s.name));
    const mov = wb.getWorksheet('Movimientos')!;
    expect(mov.getRow(1).getCell(1).value).toBe('Fecha');
    expect(mov.getRow(2).getCell(1).value).toBeInstanceOf(Date);
    expect(mov.getColumn(6).numFmt).toContain('"$ "#,##0');
  });
});
