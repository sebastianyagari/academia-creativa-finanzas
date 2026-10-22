/** Presupuesto (SPEC 5.1 y Anexo D.2, D.12, D.15). */
import { debtBalance, goalSaved } from './balances';
import { goalProgress } from './goals';
import type { Totals } from './totals';
import type { AppData, Group } from './types';

export interface GroupBudgets {
  /** "Ingresos esperados": presupuesto de las categorías de ingreso (Anexo D.12). */
  ingresos: number;
  facturas: number;
  gastos: number;
  inversiones: number;
  /** Suma de aportes sugeridos de las metas activas. */
  ahorros: number;
  /** Cuotas mínimas de créditos y otros con saldo, más el abono extra. Sin tarjetas (Anexo D.2). */
  deudas: number;
}

function categoryBudget(data: AppData, group: Group): number {
  return data.categories
    .filter((c) => c.group === group && !c.archived)
    .reduce((sum, c) => sum + c.budget, 0);
}

export function groupBudgets(data: AppData, currentMonth: string): GroupBudgets {
  const ahorros = data.goals
    .filter((g) => !g.archived)
    .reduce(
      (sum, g) => sum + goalProgress(g, goalSaved(g, data.transactions), currentMonth).suggested,
      0,
    );

  const loansWithBalance = data.debts.filter(
    (d) => !d.archived && d.type !== 'tarjeta_credito' && debtBalance(d, data) > 0,
  );
  // El abono extra solo se presupuesta si hay créditos u otros a los que abonar:
  // los pagos a tarjetas son transferencias y no cuentan como salida.
  const deudas =
    loansWithBalance.reduce((sum, d) => sum + d.minPayment, 0) +
    (loansWithBalance.length > 0 ? data.settings.extraPayment : 0);

  return {
    ingresos: categoryBudget(data, 'ingresos'),
    facturas: categoryBudget(data, 'facturas'),
    gastos: categoryBudget(data, 'gastos'),
    inversiones: categoryBudget(data, 'inversiones'),
    ahorros,
    deudas,
  };
}

export interface BudgetSummary {
  budgets: GroupBudgets;
  /** Presupuesto asignado a las salidas. */
  assigned: number;
  /** Ingresos esperados − asignado. Negativo: "Te pasaste por". */
  unassigned: number;
}

export function budgetSummary(data: AppData, currentMonth: string): BudgetSummary {
  const budgets = groupBudgets(data, currentMonth);
  const assigned =
    budgets.facturas + budgets.gastos + budgets.inversiones + budgets.ahorros + budgets.deudas;
  return { budgets, assigned, unassigned: budgets.ingresos - assigned };
}

/** Presupuesto del período: el mensual multiplicado por los meses transcurridos (SPEC 5.1). */
export function scaleBudgets(budgets: GroupBudgets, months: number): GroupBudgets {
  return {
    ingresos: budgets.ingresos * months,
    facturas: budgets.facturas * months,
    gastos: budgets.gastos * months,
    inversiones: budgets.inversiones * months,
    ahorros: budgets.ahorros * months,
    deudas: budgets.deudas * months,
  };
}

export interface SpendingCheck {
  /** Facturas + gastos reales. */
  spent: number;
  /** Presupuesto de facturas + gastos. */
  budget: number;
  /** Porcentaje usado, redondeado; 0 sin presupuesto. */
  percent: number;
  /** "Excediste tu presupuesto". */
  exceeded: boolean;
}

export function spendingCheck(totals: Totals, budgets: GroupBudgets): SpendingCheck {
  const spent = totals.facturas + totals.gastos;
  const budget = budgets.facturas + budgets.gastos;
  return {
    spent,
    budget,
    percent: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    exceeded: budget > 0 && spent > budget,
  };
}
