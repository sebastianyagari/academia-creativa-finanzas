import { describe, expect, it } from 'vitest';
import {
  budgetSummary,
  groupBudgets,
  monthsElapsed,
  periodMonths,
  scaleBudgets,
  spendingCheck,
  totalsFor,
  monthRange,
  type AppData,
} from '../../engine';
import { categoryId, makeData, tx } from '../helpers';

function setBudget(
  data: AppData,
  group: Parameters<typeof categoryId>[1],
  name: string,
  budget: number,
) {
  const id = categoryId(data, group, name);
  data.categories = data.categories.map((c) => (c.id === id ? { ...c, budget } : c));
}

function budgetedData(): AppData {
  const data = makeData();
  setBudget(data, 'ingresos', 'Salario', 3_400_000);
  setBudget(data, 'facturas', 'Arriendo o cuota de vivienda', 750_000);
  setBudget(data, 'gastos', 'Mercado', 460_000);
  setBudget(data, 'inversiones', 'CDT', 100_000);
  data.goals = [
    {
      id: 'g',
      name: 'Viaje',
      target: 1_000_000,
      openingSaved: 0,
      deadline: '2027-07',
      archived: false,
    },
  ];
  data.debts.push({
    id: 'cr',
    name: 'Crédito',
    type: 'credito',
    openingBalance: 4_500_000,
    rateEA: 22,
    minPayment: 260_000,
    archived: false,
  });
  data.settings = { ...data.settings, extraPayment: 150_000 };
  return data;
}

describe('presupuesto por grupo (SPEC 5.1)', () => {
  it('suma categorías, aportes de metas y cuotas de créditos', () => {
    const b = groupBudgets(budgetedData(), '2026-10');
    expect(b).toEqual({
      ingresos: 3_400_000,
      facturas: 750_000,
      gastos: 460_000,
      inversiones: 100_000,
      ahorros: 112_000, // 1.000.000 / 9 meses → 111.111 → 112.000
      deudas: 260_000 + 150_000,
    });
  });

  it('la cuota de la tarjeta no entra al presupuesto de deudas (Anexo D.2)', () => {
    const data = makeData();
    expect(groupBudgets(data, '2026-10').deudas).toBe(0);
  });

  it('sin créditos con saldo no se presupuesta abono extra', () => {
    const data = makeData({ settings: { ...makeData().settings, extraPayment: 150_000 } });
    data.debts.push({
      id: 'pagado',
      name: 'Pagado',
      type: 'credito',
      openingBalance: 0,
      rateEA: 22,
      minPayment: 260_000,
      archived: false,
    });
    expect(groupBudgets(data, '2026-10').deudas).toBe(0);
  });

  it('ignora categorías, metas y deudas archivadas', () => {
    const data = budgetedData();
    data.categories = data.categories.map((c) =>
      c.budget > 0 && c.group === 'gastos' ? { ...c, archived: true } : c,
    );
    data.goals = data.goals.map((g) => ({ ...g, archived: true }));
    const b = groupBudgets(data, '2026-10');
    expect(b.gastos).toBe(0);
    expect(b.ahorros).toBe(0);
  });

  it('falta por presupuestar = ingresos esperados − asignado', () => {
    const s = budgetSummary(budgetedData(), '2026-10');
    expect(s.assigned).toBe(750_000 + 460_000 + 100_000 + 112_000 + 410_000);
    expect(s.unassigned).toBe(3_400_000 - s.assigned);
  });

  it('negativo cuando se presupuesta más de lo que entra ("Te pasaste por")', () => {
    const data = budgetedData();
    setBudget(data, 'ingresos', 'Salario', 1_000_000);
    expect(budgetSummary(data, '2026-10').unassigned).toBeLessThan(0);
  });
});

describe('presupuesto multiplicado por meses transcurridos (SPEC 14, punto 9)', () => {
  it('en Año a octubre se multiplica por 10; en 6 meses por 6', () => {
    const b = groupBudgets(budgetedData(), '2026-10');
    const year = scaleBudgets(b, monthsElapsed(periodMonths('anio', '2026-10'), '2026-10'));
    expect(year.gastos).toBe(4_600_000);
    expect(year.ingresos).toBe(34_000_000);
    const six = scaleBudgets(b, monthsElapsed(periodMonths('6m', '2026-10'), '2026-10'));
    expect(six.facturas).toBe(4_500_000);
  });
});

describe('alerta de exceso', () => {
  it('avisa cuando facturas + gastos superan su presupuesto', () => {
    const data = budgetedData();
    const b = groupBudgets(data, '2026-10');
    const mercado = categoryId(data, 'gastos', 'Mercado');
    const under = totalsFor(
      [
        tx({
          kind: 'gasto',
          date: '2026-10-03',
          amount: 1_000_000,
          accountId: 'banco',
          categoryId: mercado,
        }),
      ],
      monthRange('2026-10'),
    );
    expect(spendingCheck(under, b)).toEqual({
      spent: 1_000_000,
      budget: 1_210_000,
      percent: 83,
      exceeded: false,
    });
    const over = totalsFor(
      [
        tx({
          kind: 'gasto',
          date: '2026-10-03',
          amount: 1_300_000,
          accountId: 'banco',
          categoryId: mercado,
        }),
      ],
      monthRange('2026-10'),
    );
    expect(spendingCheck(over, b).exceeded).toBe(true);
  });

  it('sin presupuesto no hay alerta', () => {
    const t = totalsFor(
      [tx({ kind: 'gasto', date: '2026-10-03', amount: 5, accountId: 'banco', categoryId: 'c' })],
      monthRange('2026-10'),
    );
    expect(spendingCheck(t, groupBudgets(makeData(), '2026-10'))).toMatchObject({
      percent: 0,
      exceeded: false,
    });
  });
});
