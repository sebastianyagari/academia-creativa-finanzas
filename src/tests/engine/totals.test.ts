import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  categoryActuals,
  INTEREST_CATEGORY_ID,
  monthRange,
  totalsByMonth,
  totalsFor,
  type AppData,
  type Totals,
  type Transaction,
} from '../../engine';
import { categoryId, makeData, tx } from '../helpers';

const OCT = monthRange('2026-10');

function sample(data: AppData): Transaction[] {
  return [
    tx({
      kind: 'ingreso',
      date: '2026-10-01',
      amount: 3_000_000,
      accountId: 'banco',
      categoryId: categoryId(data, 'ingresos', 'Salario'),
    }),
    tx({
      kind: 'factura',
      date: '2026-10-05',
      amount: 800_000,
      accountId: 'banco',
      categoryId: categoryId(data, 'facturas', 'Arriendo o cuota de vivienda'),
    }),
    tx({
      kind: 'gasto',
      date: '2026-10-06',
      amount: 120_000,
      accountId: 'visa',
      categoryId: categoryId(data, 'gastos', 'Mercado'),
    }),
    tx({
      kind: 'inversion',
      date: '2026-10-07',
      amount: 100_000,
      accountId: 'banco',
      categoryId: categoryId(data, 'inversiones', 'CDT'),
    }),
    tx({ kind: 'ahorro', date: '2026-10-08', amount: 200_000, accountId: 'banco', goalId: 'g1' }),
    tx({
      kind: 'pago_deuda',
      date: '2026-10-10',
      amount: 260_000,
      accountId: 'banco',
      debtId: 'cr',
      interestPart: 60_000,
    }),
  ];
}

describe('totales del mes (SPEC 4.2)', () => {
  it('suma cada tipo y calcula "Te queda"', () => {
    const data = makeData();
    const t = totalsFor(sample(data), OCT);
    expect(t).toEqual<Totals>({
      ingresos: 3_000_000,
      facturas: 800_000,
      gastos: 120_000 + 60_000,
      inversiones: 100_000,
      ahorros: 200_000,
      deudas: 200_000,
      salidas: 800_000 + 180_000 + 100_000 + 200_000 + 200_000,
      balance: 3_000_000 - 1_480_000,
    });
  });

  it('una compra con tarjeta cuenta como gasto el día de la compra (SPEC 14, punto 3)', () => {
    const data = makeData();
    const compra = tx({
      kind: 'gasto',
      date: '2026-10-28',
      amount: 90_000,
      accountId: 'visa',
      categoryId: categoryId(data, 'gastos', 'Ocio'),
    });
    const pago = tx({
      kind: 'transferencia',
      date: '2026-11-15',
      amount: 90_000,
      accountId: 'banco',
      toAccountId: 'visa',
    });
    expect(totalsFor([compra, pago], OCT).gastos).toBe(90_000);
    expect(totalsFor([compra, pago], monthRange('2026-11')).salidas).toBe(0);
  });

  it('el interés de un pago de deuda va a la categoría de sistema (SPEC 14, punto 4)', () => {
    const data = makeData();
    const actuals = categoryActuals(sample(data), OCT);
    expect(actuals.get(INTEREST_CATEGORY_ID)).toBe(60_000);
    expect(actuals.get(categoryId(data, 'gastos', 'Mercado'))).toBe(120_000);
  });

  it('un interés mayor que el pago se limita al monto del pago', () => {
    const t = totalsFor(
      [
        tx({
          kind: 'pago_deuda',
          date: '2026-10-10',
          amount: 50_000,
          accountId: 'banco',
          debtId: 'cr',
          interestPart: 80_000,
        }),
      ],
      OCT,
    );
    expect(t.gastos).toBe(50_000);
    expect(t.deudas).toBe(0);
  });

  it('separa los totales mes a mes', () => {
    const data = makeData();
    const txs = [
      ...sample(data),
      tx({
        kind: 'ingreso',
        date: '2026-11-01',
        amount: 500_000,
        accountId: 'banco',
        categoryId: 'c',
      }),
    ];
    const byMonth = totalsByMonth(txs, ['2026-10', '2026-11']);
    expect(byMonth.get('2026-10')!.ingresos).toBe(3_000_000);
    expect(byMonth.get('2026-11')!.ingresos).toBe(500_000);
    expect(byMonth.get('2026-11')!.balance).toBe(500_000);
  });
});

describe('invariante de transferencias (SPEC 14, punto 2)', () => {
  const transfer = tx({
    id: 'tr',
    kind: 'transferencia',
    date: '2026-10-15',
    amount: 250_000,
    accountId: 'banco',
    toAccountId: 'nequi',
  });

  function snapshot(data: AppData, txs: Transaction[]) {
    return {
      totals: totalsFor(txs, OCT),
      byMonth: [...totalsByMonth(txs, ['2026-10']).values()],
      categories: [...categoryActuals(txs, OCT).entries()].sort(),
      balances: Object.fromEntries(data.accounts.map((a) => [a.id, accountBalance(a, txs)])),
    };
  }

  it('crear, editar o borrar una transferencia no cambia ningún total', () => {
    const data = makeData();
    const base = sample(data);
    const before = snapshot(data, base);

    const created = snapshot(data, [...base, transfer]);
    const edited = snapshot(data, [
      ...base,
      { ...transfer, amount: 999_000, date: '2026-10-31', toAccountId: 'visa' },
    ]);
    const deleted = snapshot(data, base);

    for (const after of [created, edited, deleted]) {
      expect(after.totals).toEqual(before.totals);
      expect(after.byMonth).toEqual(before.byMonth);
      expect(after.categories).toEqual(before.categories);
    }
  });

  it('solo cambian los saldos de las dos cuentas', () => {
    const data = makeData();
    const base = sample(data);
    const before = snapshot(data, base).balances;
    const after = snapshot(data, [...base, transfer]).balances;
    expect(after.banco).toBe(before.banco! - 250_000);
    expect(after.nequi).toBe(before.nequi! + 250_000);
    expect(after.visa).toBe(before.visa);
  });
});
