import { describe, expect, it } from 'vitest';
import {
  cardDebt,
  createCard,
  debtBalance,
  describeSchedule,
  filterTransactions,
  monthRange,
  netWorth,
  normalizeText,
  pendingFor,
  repeatMonthly,
  simDebts,
  suggestedCategoryId,
  totalsFor,
  validateTransaction,
  type Recurring,
} from '../../engine';
import { categoryId, idGen, makeData, tx } from '../helpers';

describe('crear tarjeta de crédito (SPEC 4.3)', () => {
  it('crea la cuenta y su deuda enlazadas; el saldo vive en la cuenta', () => {
    const { account, debt } = createCard(
      {
        name: 'Visa Davivienda',
        currentDebt: 1_200_000,
        rateEA: 28.5,
        minPayment: 90_000,
        order: 7,
      },
      idGen('card'),
    );
    expect(account).toMatchObject({
      type: 'tarjeta_credito',
      openingBalance: 1_200_000,
      debtId: debt.id,
      order: 7,
    });
    expect(debt).toMatchObject({
      type: 'tarjeta_credito',
      openingBalance: 0,
      rateEA: 28.5,
      minPayment: 90_000,
    });

    const data = makeData();
    data.accounts.push(account);
    data.debts.push(debt);
    expect(debtBalance(debt, data)).toBe(1_200_000);
    expect(simDebts(data).find((d) => d.id === debt.id)?.balance).toBe(1_200_000);
  });

  it('flujo completo: compra, pago por transferencia y patrimonio', () => {
    const data = makeData();
    const { account: card, debt } = createCard(
      { name: 'Master', currentDebt: 0, rateEA: 30, minPayment: 50_000, order: 3 },
      idGen('m'),
    );
    data.accounts.push(card);
    data.debts.push(debt);
    const before = netWorth(data).netWorth;
    const compra = tx({
      kind: 'gasto',
      date: '2026-10-05',
      amount: 200_000,
      accountId: card.id,
      categoryId: categoryId(data, 'gastos', 'Ropa'),
    });
    const pago = tx({
      kind: 'transferencia',
      date: '2026-10-25',
      amount: 200_000,
      accountId: 'banco',
      toAccountId: card.id,
    });
    for (const t of [compra, pago]) expect(validateTransaction(t, data)).toEqual([]);
    data.transactions = [compra, pago];

    expect(totalsFor(data.transactions, monthRange('2026-10')).gastos).toBe(200_000);
    expect(cardDebt(card, data.transactions)).toBe(0);
    // La compra baja el patrimonio una sola vez: el pago solo mueve plata a la tarjeta.
    expect(netWorth(data).netWorth).toBe(before - 200_000);
  });
});

describe('repetir cada mes (SPEC 5.4)', () => {
  it('crea la plantilla mensual y el movimiento no queda pendiente este mes', () => {
    const data = makeData();
    const arriendo = categoryId(data, 'facturas', 'Arriendo o cuota de vivienda');
    const { transaction, recurring } = repeatMonthly(
      tx({
        id: 't1',
        kind: 'factura',
        date: '2026-10-05',
        amount: 750_000,
        accountId: 'banco',
        categoryId: arriendo,
        note: 'Arriendo',
      }),
      'r1',
    );
    expect(recurring).toEqual<Recurring>({
      id: 'r1',
      kind: 'factura',
      amount: 750_000,
      accountId: 'banco',
      categoryId: arriendo,
      note: 'Arriendo',
      schedule: { type: 'mensual', day: 5 },
      active: true,
      startMonth: '2026-10',
    });
    expect(transaction).toMatchObject({ fromRecurringId: 'r1', scheduledDate: '2026-10-05' });

    const state = { recurrings: [recurring], recurringSkips: [], transactions: [transaction] };
    expect(pendingFor(state, '2026-10')).toEqual([]);
    expect(pendingFor(state, '2026-11').map((p) => p.scheduledDate)).toEqual(['2026-11-05']);
  });

  it('describe el horario en palabras', () => {
    const base = {
      id: 'r',
      kind: 'ingreso' as const,
      amount: 1,
      accountId: 'b',
      active: true,
      startMonth: '2026-01',
    };
    expect(describeSchedule({ ...base, schedule: { type: 'mensual', day: 5 } })).toBe(
      'Cada mes, el día 5',
    );
    expect(describeSchedule({ ...base, schedule: { type: 'quincenal', days: [15, 31] } })).toBe(
      'Cada quincena: el día 15 y el último día',
    );
    expect(describeSchedule({ ...base, schedule: { type: 'anual', month: 6, day: 30 } })).toBe(
      'Cada año, el 30 de junio',
    );
  });
});

describe('búsqueda y filtros (SPEC 6.4)', () => {
  const data = makeData();
  const mercado = categoryId(data, 'gastos', 'Mercado');
  const comida = categoryId(data, 'gastos', 'Comida fuera');
  data.transactions = [
    tx({
      id: 'a',
      kind: 'gasto',
      date: '2026-10-02',
      amount: 8_000,
      accountId: 'nequi',
      categoryId: comida,
      note: 'Café con Ana',
    }),
    tx({
      id: 'b',
      kind: 'gasto',
      date: '2026-10-03',
      amount: 250_000,
      accountId: 'banco',
      categoryId: mercado,
      note: 'Éxito',
    }),
    tx({
      id: 'c',
      kind: 'transferencia',
      date: '2026-10-04',
      amount: 100_000,
      accountId: 'banco',
      toAccountId: 'nequi',
    }),
    tx({
      id: 'd',
      kind: 'gasto',
      date: '2026-09-28',
      amount: 60_000,
      accountId: 'visa',
      categoryId: mercado,
    }),
  ];
  const ids = (f: Parameters<typeof filterTransactions>[1]) =>
    filterTransactions(data, f).map((t) => t.id);

  it('busca sin tildes ni mayúsculas en nota, categoría y cuenta', () => {
    expect(normalizeText('  Café ÉXITO ')).toBe('cafe exito');
    expect(ids({ text: 'cafe' })).toEqual(['a']);
    expect(ids({ text: 'EXITO' })).toEqual(['b']);
    expect(ids({ text: 'mercado' })).toEqual(['b', 'd']);
    expect(ids({ text: 'tarjeta visa' })).toEqual(['d']);
    expect(ids({ text: 'comida ana' })).toEqual(['a']);
    expect(ids({ text: 'nada que ver' })).toEqual([]);
  });

  it('filtra por cuenta (origen o destino), categoría, tipo, monto y fechas', () => {
    expect(ids({ accountId: 'nequi' })).toEqual(['c', 'a']);
    expect(ids({ categoryId: mercado })).toEqual(['b', 'd']);
    expect(ids({ kind: 'transferencia' })).toEqual(['c']);
    expect(ids({ min: 50_000, max: 100_000 })).toEqual(['c', 'd']);
    expect(ids({ range: monthRange('2026-10'), categoryId: mercado })).toEqual(['b']);
  });
});

describe('categoría sugerida al registrar (3 toques)', () => {
  it('propone la del último movimiento de ese tipo', () => {
    const data = makeData();
    const mercado = categoryId(data, 'gastos', 'Mercado');
    const ocio = categoryId(data, 'gastos', 'Ocio');
    expect(suggestedCategoryId(data, 'gasto')).toBeUndefined();
    data.transactions = [
      tx({ kind: 'gasto', date: '2026-10-01', amount: 1, accountId: 'banco', categoryId: ocio }),
      tx({ kind: 'gasto', date: '2026-10-09', amount: 1, accountId: 'banco', categoryId: mercado }),
      tx({ kind: 'ingreso', date: '2026-10-10', amount: 1, accountId: 'banco', categoryId: 'x' }),
    ];
    expect(suggestedCategoryId(data, 'gasto')).toBe(mercado);
    expect(suggestedCategoryId(data, 'transferencia')).toBeUndefined();
  });

  it('no propone categorías archivadas', () => {
    const data = makeData();
    const mercado = categoryId(data, 'gastos', 'Mercado');
    data.categories = data.categories.map((c) => (c.id === mercado ? { ...c, archived: true } : c));
    data.transactions = [
      tx({ kind: 'gasto', date: '2026-10-09', amount: 1, accountId: 'banco', categoryId: mercado }),
    ];
    expect(suggestedCategoryId(data, 'gasto')).toBeUndefined();
  });
});
