import { describe, expect, it } from 'vitest';
import {
  formatCOP,
  MAX_SIMULATION_MONTHS,
  monthlyRate,
  paymentBelowInterest,
  priorityDebtId,
  simDebts,
  simulate,
  type SimDebt,
} from '../../engine';
import { makeData, tx } from '../helpers';

// Caso de regresión de la SPEC 5.3 (verificado contra el sim() del prototipo).
const REGRESSION: SimDebt[] = [
  { id: 'tarjeta', balance: 3_200_000, rateEA: 27, minPayment: 160_000 },
  { id: 'libre', balance: 4_500_000, rateEA: 22, minPayment: 260_000 },
  { id: 'familiar', balance: 800_000, rateEA: 0, minPayment: 100_000 },
];

describe('tasa mensual', () => {
  it('convierte EA sin dividir entre 12', () => {
    expect(monthlyRate(0)).toBe(0);
    expect(Math.pow(1 + monthlyRate(27), 12)).toBeCloseTo(1.27, 12);
    expect(monthlyRate(27)).not.toBeCloseTo(0.27 / 12, 4);
  });
});

describe('simulación de deudas (SPEC 14, punto 5)', () => {
  it('avalancha: 15 meses, intereses 1.143.934, primera deuda en el mes 8', () => {
    const r = simulate(REGRESSION, 'avalancha', 150_000);
    expect(r.finished).toBe(true);
    expect(r.months).toBe(15);
    expect(formatCOP(r.interest)).toBe('$ 1.143.934');
    expect(r.firstPaidMonth).toBe(8);
    expect(r.paidMonth).toEqual({ tarjeta: 11, libre: 15, familiar: 8 });
  });

  it('bola de nieve: 15 meses, intereses 1.190.228, primera deuda en el mes 4', () => {
    const r = simulate(REGRESSION, 'bola', 150_000);
    expect(r.finished).toBe(true);
    expect(r.months).toBe(15);
    expect(formatCOP(r.interest)).toBe('$ 1.190.228');
    expect(r.firstPaidMonth).toBe(4);
    expect(r.paidMonth).toEqual({ tarjeta: 11, libre: 15, familiar: 4 });
  });

  it('no modifica las deudas que recibe', () => {
    const copy = structuredClone(REGRESSION);
    simulate(REGRESSION, 'bola', 150_000);
    expect(REGRESSION).toEqual(copy);
  });

  it('cuota menor al interés: avisa y no termina antes del tope ("Sin fecha")', () => {
    const debt: SimDebt = { id: 'mala', balance: 10_000_000, rateEA: 30, minPayment: 100_000 };
    expect(paymentBelowInterest(debt)).toBe(true);
    const r = simulate([debt], 'avalancha', 0);
    expect(r.finished).toBe(false);
    expect(r.months).toBeNull();
    expect(r.paidMonth.mala).toBeNull();
    expect(r.firstPaidMonth).toBeNull();
  });

  it('se detiene en el tope de 600 meses', () => {
    const r = simulate(
      [{ id: 'lenta', balance: 100_000_000, rateEA: 12, minPayment: 950_000 }],
      'bola',
      0,
    );
    expect(MAX_SIMULATION_MONTHS).toBe(600);
    expect(r.finished).toBe(false);
  });

  it('una cuota suficiente no dispara la advertencia', () => {
    expect(paymentBelowInterest(REGRESSION[0]!)).toBe(false);
  });

  it('deuda al 0 % EA: sin intereses y meses exactos', () => {
    const r = simulate([{ id: 'f', balance: 800_000, rateEA: 0, minPayment: 100_000 }], 'bola', 0);
    expect(r).toMatchObject({ finished: true, months: 8, interest: 0, firstPaidMonth: 8 });
  });

  it('una sola deuda con abono extra', () => {
    const r = simulate(
      [{ id: 'u', balance: 1_000_000, rateEA: 0, minPayment: 100_000 }],
      'avalancha',
      150_000,
    );
    expect(r.months).toBe(4);
  });

  it('ninguna deuda: libre desde ya', () => {
    expect(simulate([], 'avalancha', 100_000)).toEqual({
      finished: true,
      months: 0,
      interest: 0,
      paidMonth: {},
      firstPaidMonth: null,
    });
  });

  it('ignora deudas ya pagadas', () => {
    const r = simulate([{ id: 'p', balance: 0, rateEA: 20, minPayment: 50_000 }], 'bola', 0);
    expect(r.months).toBe(0);
  });
});

describe('deuda prioritaria ("Abono extra aquí")', () => {
  it('avalancha elige la tasa más alta; bola de nieve el saldo más pequeño', () => {
    expect(priorityDebtId(REGRESSION, 'avalancha')).toBe('tarjeta');
    expect(priorityDebtId(REGRESSION, 'bola')).toBe('familiar');
    expect(priorityDebtId([], 'bola')).toBeNull();
  });

  it('en avalancha, a igual tasa gana el saldo más pequeño', () => {
    const tie: SimDebt[] = [
      { id: 'grande', balance: 5_000_000, rateEA: 20, minPayment: 1 },
      { id: 'chica', balance: 1_000_000, rateEA: 20, minPayment: 1 },
    ];
    expect(priorityDebtId(tie, 'avalancha')).toBe('chica');
  });
});

describe('deudas para simular desde los datos', () => {
  it('incluye la tarjeta con su saldo derivado y excluye las archivadas', () => {
    const data = makeData();
    data.debts.push({
      id: 'arch',
      name: 'Quitada',
      type: 'credito',
      openingBalance: 9,
      rateEA: 1,
      minPayment: 1,
      archived: true,
    });
    data.transactions = [
      tx({
        kind: 'gasto',
        date: '2026-10-03',
        amount: 100_000,
        accountId: 'visa',
        categoryId: 'c',
      }),
    ];
    expect(simDebts(data)).toEqual([
      { id: 'deuda-visa', balance: 600_000, rateEA: 27, minPayment: 80_000 },
    ]);
  });
});
