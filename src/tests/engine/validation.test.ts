import { describe, expect, it } from 'vitest';
import {
  createDefaultData,
  INTEREST_CATEGORY_ID,
  validateTransaction,
  type Transaction,
} from '../../engine';
import { categoryId, makeData } from '../helpers';

const data = makeData();
data.debts.push({
  id: 'cr',
  name: 'Crédito',
  type: 'credito',
  openingBalance: 1_000_000,
  rateEA: 22,
  minPayment: 100_000,
  archived: false,
});
data.goals.push({
  id: 'g1',
  name: 'Viaje',
  target: 1_000_000,
  openingSaved: 0,
  deadline: '2027-06',
  archived: false,
});
const mercado = categoryId(data, 'gastos', 'Mercado');
const salario = categoryId(data, 'ingresos', 'Salario');

function check(t: Partial<Transaction>) {
  return validateTransaction(
    {
      id: 'x',
      kind: 'gasto',
      date: '2026-10-21',
      amount: 10_000,
      accountId: 'banco',
      categoryId: mercado,
      ...t,
    },
    data,
  );
}

describe('validación de movimientos (SPEC 6.3)', () => {
  it('acepta un gasto correcto', () => {
    expect(check({})).toEqual([]);
  });

  it('monto mayor a 0 y entero', () => {
    expect(check({ amount: 0 })).toContain('Escribe un monto mayor a 0.');
    expect(check({ amount: 10.5 })).toContain('Escribe un monto mayor a 0.');
  });

  it('fecha válida', () => {
    expect(check({ date: '2026-02-30' })).toContain('Elige una fecha válida.');
    expect(check({ date: '21/10/2026' })).toContain('Elige una fecha válida.');
  });

  it('categoría del grupo correcto', () => {
    expect(check({ categoryId: undefined })).toContain('Elige una categoría.');
    expect(check({ categoryId: salario })).toContain(
      'La categoría no corresponde al tipo de movimiento.',
    );
  });

  it('transferencia: destino distinto del origen', () => {
    expect(check({ kind: 'transferencia', categoryId: undefined, toAccountId: 'nequi' })).toEqual(
      [],
    );
    expect(check({ kind: 'transferencia', categoryId: undefined, toAccountId: 'banco' })).toContain(
      'La cuenta de origen y la de destino deben ser distintas.',
    );
    expect(check({ kind: 'transferencia', categoryId: undefined })).toContain(
      'Elige la cuenta de destino.',
    );
  });
});

describe('restricciones de tarjeta (Anexo D.1 y D.3)', () => {
  it('acepta compras con tarjeta y pagos por transferencia hacia ella', () => {
    expect(check({ accountId: 'visa' })).toEqual([]);
    expect(
      check({
        kind: 'transferencia',
        categoryId: undefined,
        accountId: 'banco',
        toAccountId: 'visa',
      }),
    ).toEqual([]);
  });

  it('rechaza ingresos, ahorros y avances con tarjeta', () => {
    expect(check({ kind: 'ingreso', accountId: 'visa', categoryId: salario })).toHaveLength(1);
    expect(
      check({ kind: 'ahorro', accountId: 'visa', categoryId: undefined, goalId: 'g1' }),
    ).toHaveLength(1);
    expect(
      check({
        kind: 'transferencia',
        categoryId: undefined,
        accountId: 'visa',
        toAccountId: 'banco',
      }),
    ).toEqual(['En esta versión no se pueden sacar avances de una tarjeta de crédito.']);
  });

  it('un pago de deuda a una tarjeta se rechaza: se hace por transferencia', () => {
    expect(check({ kind: 'pago_deuda', categoryId: undefined, debtId: 'deuda-visa' })).toContain(
      'El pago de una tarjeta se registra como transferencia hacia la tarjeta.',
    );
  });

  it('pago de deuda: intereses entre 0 y el monto', () => {
    expect(
      check({ kind: 'pago_deuda', categoryId: undefined, debtId: 'cr', interestPart: 3_000 }),
    ).toEqual([]);
    expect(
      check({ kind: 'pago_deuda', categoryId: undefined, debtId: 'cr', interestPart: 20_000 }),
    ).toContain('Los intereses deben estar entre 0 y el monto del pago.');
  });
});

describe('categorías por defecto (SPEC 4.4)', () => {
  it('cada grupo tiene un único "Otros" y existe la categoría de sistema de intereses', () => {
    const d = createDefaultData();
    for (const group of ['ingresos', 'facturas', 'gastos', 'inversiones'] as const) {
      expect(d.categories.filter((c) => c.group === group && c.isOther)).toHaveLength(1);
    }
    const sys = d.categories.find((c) => c.id === INTEREST_CATEGORY_ID);
    expect(sys).toMatchObject({
      group: 'gastos',
      name: 'Intereses y cuotas de manejo',
      isSystem: true,
    });
    expect(new Set(d.categories.map((c) => c.id)).size).toBe(d.categories.length);
  });
});
