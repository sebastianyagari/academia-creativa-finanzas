import { describe, expect, it } from 'vitest';
import { appDataSchema } from '../../db';
import {
  accountBalance,
  debtBalance,
  goalSaved,
  pendingFor,
  simDebts,
  simulate,
  validateTransaction,
} from '../../engine';
import { createDemoData } from '../../state/demo';
import { idGen } from '../helpers';

const demo = createDemoData('2026-10-21', idGen('demo'));
const byName = <T extends { name: string }>(list: T[], name: string) =>
  list.find((x) => x.name === name)!;

describe('datos de ejemplo (SPEC 6.9)', () => {
  it('cumplen el esquema y vienen marcados como ejemplo', () => {
    expect(appDataSchema.safeParse(demo).success).toBe(true);
    expect(demo.settings.isDemo).toBe(true);
  });

  it('todos los movimientos pasan la validación del registro', () => {
    for (const t of demo.transactions) expect(validateTransaction(t, demo), t.id).toEqual([]);
  });

  it('cubren 6 meses y nada después de hoy', () => {
    const months = new Set(demo.transactions.map((t) => t.date.slice(0, 7)));
    expect([...months].sort()).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(demo.transactions.every((t) => t.date <= '2026-10-21')).toBe(true);
  });

  it('terminan en los saldos, metas y deudas del ejemplo', () => {
    expect(accountBalance(byName(demo.accounts, 'Efectivo'), demo.transactions)).toBe(180_000);
    expect(accountBalance(byName(demo.accounts, 'Nequi'), demo.transactions)).toBe(420_000);
    expect(accountBalance(byName(demo.accounts, 'Bancolombia ahorros'), demo.transactions)).toBe(
      2_350_000,
    );
    expect(goalSaved(byName(demo.goals, 'Fondo de emergencia'), demo.transactions)).toBe(1_900_000);
    expect(debtBalance(byName(demo.debts, 'Tarjeta de crédito'), demo)).toBe(3_200_000);
    expect(debtBalance(byName(demo.debts, 'Crédito de libre inversión'), demo)).toBe(4_500_000);
    expect(debtBalance(byName(demo.debts, 'Préstamo familiar'), demo)).toBe(800_000);
  });

  it('las deudas del ejemplo reproducen el caso de regresión de la SPEC 5.3', () => {
    const r = simulate(simDebts(demo), 'avalancha', demo.settings.extraPayment);
    expect(r.months).toBe(15);
    expect(Math.round(r.interest)).toBe(1_143_934);
  });

  it('trae movimientos repetidos: solo queda pendiente lo de este mes que aún no llega', () => {
    expect(demo.recurrings).toHaveLength(4);
    // Hoy es 21: nómina (1), arriendo (5), pago de tarjeta (10) e internet (15) ya se registraron.
    expect(pendingFor(demo, '2026-10')).toEqual([]);
    for (const m of ['2026-05', '2026-07', '2026-09']) expect(pendingFor(demo, m)).toEqual([]);
    // El próximo mes aparecen los cuatro.
    expect(pendingFor(demo, '2026-11')).toHaveLength(4);
    // A comienzos de mes, lo que no ha llegado queda pendiente.
    const early = createDemoData('2026-10-07', idGen('demo'));
    expect(pendingFor(early, '2026-10').map((p) => p.scheduledDate)).toEqual([
      '2026-10-10',
      '2026-10-15',
    ]);
  });

  it('es el mismo cada vez (semilla fija)', () => {
    const again = createDemoData('2026-10-21', idGen('demo'));
    expect(again).toEqual(demo);
  });
});
