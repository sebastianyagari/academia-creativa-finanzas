import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  cardDebt,
  debtBalance,
  goalSaved,
  loanBalance,
  netWorth,
  type Goal,
} from '../../engine';
import { categoryId, makeData, tx } from '../helpers';

describe('saldos de cuentas (SPEC 14, punto 1)', () => {
  it('suma ingresos, resta salidas y aplica transferencias', () => {
    const data = makeData();
    const salario = categoryId(data, 'ingresos', 'Salario');
    const mercado = categoryId(data, 'gastos', 'Mercado');
    const arriendo = categoryId(data, 'facturas', 'Arriendo o cuota de vivienda');
    data.transactions = [
      tx({
        kind: 'ingreso',
        date: '2026-10-01',
        amount: 3_000_000,
        accountId: 'banco',
        categoryId: salario,
      }),
      tx({
        kind: 'factura',
        date: '2026-10-05',
        amount: 800_000,
        accountId: 'banco',
        categoryId: arriendo,
      }),
      tx({
        kind: 'gasto',
        date: '2026-10-06',
        amount: 50_000,
        accountId: 'nequi',
        categoryId: mercado,
      }),
      tx({
        kind: 'transferencia',
        date: '2026-10-07',
        amount: 300_000,
        accountId: 'banco',
        toAccountId: 'nequi',
      }),
    ];
    const [banco, nequi] = data.accounts;
    expect(accountBalance(banco!, data.transactions)).toBe(
      1_000_000 + 3_000_000 - 800_000 - 300_000,
    );
    expect(accountBalance(nequi!, data.transactions)).toBe(200_000 - 50_000 + 300_000);
  });

  it('resta ahorros, inversiones y pagos de deuda de la cuenta origen', () => {
    const data = makeData();
    data.transactions = [
      tx({ kind: 'ahorro', date: '2026-10-02', amount: 100_000, accountId: 'banco', goalId: 'g1' }),
      tx({
        kind: 'inversion',
        date: '2026-10-03',
        amount: 50_000,
        accountId: 'banco',
        categoryId: categoryId(data, 'inversiones', 'CDT'),
      }),
      tx({
        kind: 'pago_deuda',
        date: '2026-10-10',
        amount: 70_000,
        accountId: 'banco',
        debtId: 'x',
        interestPart: 20_000,
      }),
    ];
    expect(accountBalance(data.accounts[0]!, data.transactions)).toBe(
      1_000_000 - 100_000 - 50_000 - 70_000,
    );
  });

  it('con asOf ignora movimientos posteriores', () => {
    const data = makeData();
    data.transactions = [
      tx({
        kind: 'ingreso',
        date: '2026-10-01',
        amount: 10_000,
        accountId: 'banco',
        categoryId: 'c',
      }),
      tx({
        kind: 'ingreso',
        date: '2026-10-20',
        amount: 99_000,
        accountId: 'banco',
        categoryId: 'c',
      }),
    ];
    expect(accountBalance(data.accounts[0]!, data.transactions, '2026-10-15')).toBe(1_010_000);
  });
});

describe('tarjeta de crédito (SPEC 14, punto 3)', () => {
  it('una compra sube la deuda; un pago por transferencia la baja', () => {
    const data = makeData();
    const card = data.accounts[2]!;
    const mercado = categoryId(data, 'gastos', 'Mercado');
    data.transactions = [
      tx({
        kind: 'gasto',
        date: '2026-10-03',
        amount: 120_000,
        accountId: 'visa',
        categoryId: mercado,
      }),
    ];
    expect(cardDebt(card, data.transactions)).toBe(620_000);

    data.transactions.push(
      tx({
        kind: 'transferencia',
        date: '2026-10-20',
        amount: 400_000,
        accountId: 'banco',
        toAccountId: 'visa',
      }),
    );
    expect(cardDebt(card, data.transactions)).toBe(220_000);
    expect(accountBalance(data.accounts[0]!, data.transactions)).toBe(600_000);
  });

  it('la deuda tipo tarjeta toma el saldo de su cuenta', () => {
    const data = makeData();
    data.transactions = [
      tx({
        kind: 'factura',
        date: '2026-10-03',
        amount: 30_000,
        accountId: 'visa',
        categoryId: 'c',
      }),
    ];
    expect(debtBalance(data.debts[0]!, data)).toBe(530_000);
  });

  it('un saldo a favor en la tarjeta no es deuda negativa', () => {
    const data = makeData();
    data.transactions = [
      tx({
        kind: 'transferencia',
        date: '2026-10-03',
        amount: 600_000,
        accountId: 'banco',
        toAccountId: 'visa',
      }),
    ];
    expect(cardDebt(data.accounts[2]!, data.transactions)).toBe(-100_000);
    expect(debtBalance(data.debts[0]!, data)).toBe(0);
  });

  it('patrimonio neto = cuentas − tarjetas − créditos y otros', () => {
    const data = makeData();
    data.debts.push(
      {
        id: 'credito',
        name: 'Libre inversión',
        type: 'credito',
        openingBalance: 2_000_000,
        rateEA: 22,
        minPayment: 100_000,
        archived: false,
      },
      {
        id: 'familiar',
        name: 'Préstamo familiar',
        type: 'otro',
        openingBalance: 300_000,
        rateEA: 0,
        minPayment: 50_000,
        archived: false,
      },
      {
        id: 'vieja',
        name: 'Quitada',
        type: 'credito',
        openingBalance: 999_000,
        rateEA: 10,
        minPayment: 1,
        archived: true,
      },
    );
    data.transactions = [
      tx({
        kind: 'gasto',
        date: '2026-10-03',
        amount: 100_000,
        accountId: 'visa',
        categoryId: 'c',
      }),
      tx({
        kind: 'transferencia',
        date: '2026-10-04',
        amount: 50_000,
        accountId: 'banco',
        toAccountId: 'visa',
      }),
    ];
    const nw = netWorth(data);
    expect(nw.assets).toBe(950_000 + 200_000);
    expect(nw.liabilities).toBe(550_000 + 2_000_000 + 300_000);
    expect(nw.netWorth).toBe(1_150_000 - 2_850_000);
  });
});

describe('pago de deuda con intereses (SPEC 14, punto 4)', () => {
  it('solo el abono a capital baja el saldo, sin pasar de 0', () => {
    const debt = {
      id: 'cr',
      name: 'Crédito',
      type: 'credito' as const,
      openingBalance: 1_000_000,
      rateEA: 22,
      minPayment: 100_000,
      archived: false,
    };
    const pays = [
      tx({
        kind: 'pago_deuda',
        date: '2026-10-10',
        amount: 100_000,
        accountId: 'banco',
        debtId: 'cr',
        interestPart: 18_000,
      }),
      tx({
        kind: 'pago_deuda',
        date: '2026-11-10',
        amount: 100_000,
        accountId: 'banco',
        debtId: 'cr',
      }),
    ];
    expect(loanBalance(debt, pays)).toBe(1_000_000 - 82_000 - 100_000);
    expect(loanBalance({ ...debt, openingBalance: 50_000 }, pays)).toBe(0);
  });
});

describe('ahorrado en una meta', () => {
  it('suma lo inicial y los aportes de esa meta', () => {
    const goal: Goal = {
      id: 'g1',
      name: 'Viaje',
      target: 2_000_000,
      openingSaved: 300_000,
      deadline: '2027-06',
      archived: false,
    };
    const txs = [
      tx({ kind: 'ahorro', date: '2026-10-02', amount: 150_000, accountId: 'banco', goalId: 'g1' }),
      tx({
        kind: 'ahorro',
        date: '2026-10-02',
        amount: 999_000,
        accountId: 'banco',
        goalId: 'otra',
      }),
    ];
    expect(goalSaved(goal, txs)).toBe(450_000);
  });
});
