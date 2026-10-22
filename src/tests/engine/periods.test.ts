import { describe, expect, it } from 'vitest';
import {
  addMonths,
  defaultPeriod,
  monthRange,
  monthsBetween,
  monthsElapsed,
  periodMonths,
  periodStep,
  quincenaRange,
  rangeOfMonths,
  todayInColombia,
  totalsFor,
} from '../../engine';
import { tx } from '../helpers';

describe('períodos (SPEC 14, punto 8)', () => {
  it('Mes: solo el mes seleccionado', () => {
    expect(periodMonths('mes', '2026-10')).toEqual(['2026-10']);
  });

  it('6 meses: ventana móvil que cruza el cambio de año', () => {
    expect(periodMonths('6m', '2027-02')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('Año: enero a diciembre del año del mes seleccionado', () => {
    const months = periodMonths('anio', '2026-10');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });

  it('las flechas mueven 1 mes o 12 en Año', () => {
    expect(periodStep('mes')).toBe(1);
    expect(periodStep('6m')).toBe(1);
    expect(periodStep('anio')).toBe(12);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', -12)).toBe('2025-10');
  });

  it('rangos de fechas por mes y período', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(rangeOfMonths(periodMonths('6m', '2027-02'))).toEqual({
      from: '2026-09-01',
      to: '2027-02-28',
    });
  });

  it('los totales del período Año suman todos sus meses y nada del año siguiente', () => {
    const txs = [
      tx({ kind: 'ingreso', date: '2026-01-01', amount: 100, accountId: 'b', categoryId: 'c' }),
      tx({ kind: 'ingreso', date: '2026-12-31', amount: 200, accountId: 'b', categoryId: 'c' }),
      tx({ kind: 'ingreso', date: '2027-01-01', amount: 400, accountId: 'b', categoryId: 'c' }),
    ];
    expect(totalsFor(txs, rangeOfMonths(periodMonths('anio', '2026-05'))).ingresos).toBe(300);
  });

  it('quincenas: 1 a 15 y 16 a fin de mes', () => {
    expect(quincenaRange('2026-10', 1)).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(quincenaRange('2026-10', 2)).toEqual({ from: '2026-10-16', to: '2026-10-31' });
  });

  it('vista por defecto: 6 meses si hay datos de más de un mes', () => {
    expect(defaultPeriod([])).toBe('mes');
    expect(
      defaultPeriod([tx({ kind: 'gasto', date: '2026-10-01', amount: 1, accountId: 'b' })]),
    ).toBe('mes');
    expect(
      defaultPeriod([
        tx({ kind: 'gasto', date: '2026-09-30', amount: 1, accountId: 'b' }),
        tx({ kind: 'gasto', date: '2026-10-01', amount: 1, accountId: 'b' }),
      ]),
    ).toBe('6m');
  });

  it('meses entre fechas', () => {
    expect(monthsBetween('2026-10', '2027-08')).toBe(10);
    expect(monthsBetween('2026-10', '2026-09')).toBe(-1);
  });
});

describe('meses transcurridos para el presupuesto', () => {
  it('cuenta hasta el mes actual, mínimo 1', () => {
    expect(monthsElapsed(periodMonths('anio', '2026-10'), '2026-10')).toBe(10);
    expect(monthsElapsed(periodMonths('6m', '2026-10'), '2026-10')).toBe(6);
    expect(monthsElapsed(periodMonths('anio', '2027-03'), '2026-10')).toBe(1);
    expect(monthsElapsed(periodMonths('anio', '2025-03'), '2026-10')).toBe(12);
  });
});

describe('hoy en Colombia (Anexo D.16)', () => {
  it('usa la hora de Bogotá aunque en UTC ya sea otro día', () => {
    // 2026-11-01 03:00 UTC = 2026-10-31 22:00 en Bogotá.
    expect(todayInColombia(new Date('2026-11-01T03:00:00Z'))).toBe('2026-10-31');
    expect(todayInColombia(new Date('2026-11-01T05:00:00Z'))).toBe('2026-11-01');
  });
});
