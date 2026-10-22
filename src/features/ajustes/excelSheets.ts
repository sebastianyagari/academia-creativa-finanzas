/**
 * Contenido de la exportación a Excel (SPEC 9.3): hojas Movimientos, Resumen por
 * mes, Presupuesto, Metas, Deudas y Cuentas. Solo arma filas; escribir el
 * archivo lo hace exportExcel.ts (que carga ExcelJS solo al exportar).
 */
import {
  accountBalance,
  addMonths,
  budgetSummary,
  cardDebt,
  categoriesOf,
  categoryActuals,
  debtBalance,
  goalProgress,
  goalSaved,
  monthOf,
  monthRange,
  simDebts,
  simulate,
  totalsByMonth,
  type AppData,
  type Group,
} from '../../engine';
import { GROUP_LABEL, KIND, monthLabel } from '../../components/format';
import { accountName, transactionTitle } from '../shared/describe';

export type CellKind = 'texto' | 'pesos' | 'fecha' | 'numero' | 'porcentaje';

export interface Sheet {
  name: string;
  columns: { header: string; kind: CellKind; width: number }[];
  rows: (string | number | null)[][];
  /** Fila final de totales (opcional). */
  total?: (string | number | null)[];
}

const ACCOUNT_TYPE: Record<string, string> = {
  efectivo: 'Efectivo',
  billetera: 'Billetera',
  banco: 'Banco',
  tarjeta_credito: 'Tarjeta de crédito',
};

const DEBT_TYPE: Record<string, string> = {
  credito: 'Crédito',
  tarjeta_credito: 'Tarjeta de crédito',
  otro: 'Otro',
};

export function buildSheets(data: AppData, currentMonth: string): Sheet[] {
  const txs = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));

  const movimientos: Sheet = {
    name: 'Movimientos',
    columns: [
      { header: 'Fecha', kind: 'fecha', width: 12 },
      { header: 'Tipo', kind: 'texto', width: 15 },
      { header: 'Concepto', kind: 'texto', width: 30 },
      { header: 'Cuenta', kind: 'texto', width: 22 },
      { header: 'Cuenta destino', kind: 'texto', width: 22 },
      { header: 'Monto', kind: 'pesos', width: 15 },
      { header: 'De eso, intereses', kind: 'pesos', width: 16 },
      { header: 'Nota', kind: 'texto', width: 30 },
    ],
    rows: txs.map((t) => [
      t.date,
      KIND[t.kind].label,
      transactionTitle(data, t),
      accountName(data, t.accountId),
      t.toAccountId ? accountName(data, t.toAccountId) : null,
      t.amount,
      t.interestPart ?? null,
      t.note ?? null,
    ]),
  };

  // Del primer mes con movimientos hasta el mes actual (o el último con datos).
  const first = txs[0] ? monthOf(txs[0].date) : currentMonth;
  const lastTx = txs.at(-1);
  const last = lastTx && monthOf(lastTx.date) > currentMonth ? monthOf(lastTx.date) : currentMonth;
  const months: string[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  const byMonth = totalsByMonth(data.transactions, months);
  const summaryRows = months.map((m) => {
    const t = byMonth.get(m)!;
    return [
      monthLabel(m),
      t.ingresos,
      t.facturas,
      t.gastos,
      t.ahorros,
      t.deudas,
      t.inversiones,
      t.salidas,
      t.balance,
    ];
  });
  const sum = (i: number) => summaryRows.reduce((s, r) => s + (r[i] as number), 0);
  const resumen: Sheet = {
    name: 'Resumen por mes',
    columns: [
      { header: 'Mes', kind: 'texto', width: 16 },
      ...[
        'Ingresos',
        'Facturas',
        'Gastos',
        'Ahorros',
        'Deudas',
        'Inversiones',
        'Total salidas',
        'Balance',
      ].map((header) => ({ header, kind: 'pesos' as const, width: 15 })),
    ],
    rows: summaryRows,
    total: ['Total', ...[1, 2, 3, 4, 5, 6, 7, 8].map(sum)],
  };

  const actuals = categoryActuals(data.transactions, monthRange(currentMonth));
  const groups: Group[] = ['ingresos', 'facturas', 'gastos', 'inversiones'];
  const { budgets } = budgetSummary(data, currentMonth);
  const presupuesto: Sheet = {
    name: 'Presupuesto',
    columns: [
      { header: 'Grupo', kind: 'texto', width: 14 },
      { header: 'Categoría', kind: 'texto', width: 32 },
      { header: 'Presupuesto mensual', kind: 'pesos', width: 20 },
      { header: `Real ${monthLabel(currentMonth).toLowerCase()}`, kind: 'pesos', width: 20 },
      { header: 'Día de vencimiento', kind: 'numero', width: 18 },
    ],
    rows: [
      ...groups.flatMap((g) =>
        categoriesOf(data.categories, g)
          .filter((c) => !c.archived)
          .map((c) => [GROUP_LABEL[g], c.name, c.budget, actuals.get(c.id) ?? 0, c.dueDay ?? null]),
      ),
      ['Ahorros', 'Aportes sugeridos a metas', budgets.ahorros, null, null],
      ['Deudas', 'Cuotas mínimas y abono extra', budgets.deudas, null, null],
    ],
  };

  const metas: Sheet = {
    name: 'Metas',
    columns: [
      { header: 'Meta', kind: 'texto', width: 28 },
      { header: 'Objetivo', kind: 'pesos', width: 15 },
      { header: 'Ahorrado', kind: 'pesos', width: 15 },
      { header: 'Falta', kind: 'pesos', width: 15 },
      { header: 'Fecha límite', kind: 'texto', width: 16 },
      { header: 'Aporte sugerido al mes', kind: 'pesos', width: 22 },
      { header: 'Estado', kind: 'texto', width: 14 },
    ],
    rows: data.goals
      .filter((g) => !g.archived)
      .map((g) => {
        const p = goalProgress(g, goalSaved(g, data.transactions), currentMonth);
        const estado =
          p.status === 'cumplida'
            ? 'Cumplida'
            : p.status === 'vencida'
              ? 'Fecha vencida'
              : 'En curso';
        return [
          g.name,
          g.target,
          p.saved,
          p.remaining,
          monthLabel(g.deadline),
          p.suggested,
          estado,
        ];
      }),
  };

  const sim = simulate(simDebts(data), data.settings.strategy, data.settings.extraPayment);
  const deudas: Sheet = {
    name: 'Deudas',
    columns: [
      { header: 'Deuda', kind: 'texto', width: 28 },
      { header: 'Tipo', kind: 'texto', width: 18 },
      { header: 'Saldo', kind: 'pesos', width: 15 },
      { header: 'Tasa (% EA)', kind: 'numero', width: 12 },
      { header: 'Cuota mínima', kind: 'pesos', width: 15 },
      { header: 'Se paga en', kind: 'texto', width: 16 },
    ],
    rows: data.debts
      .filter((d) => !d.archived)
      .map((d) => {
        const paid = sim.paidMonth[d.id];
        const balance = debtBalance(d, data);
        const when =
          balance <= 0
            ? 'Pagada'
            : paid != null
              ? monthLabel(addMonths(currentMonth, paid))
              : 'Sin fecha';
        return [d.name, DEBT_TYPE[d.type]!, balance, d.rateEA, d.minPayment, when];
      }),
  };

  const cuentas: Sheet = {
    name: 'Cuentas',
    columns: [
      { header: 'Cuenta', kind: 'texto', width: 26 },
      { header: 'Tipo', kind: 'texto', width: 18 },
      { header: 'Saldo de hoy', kind: 'pesos', width: 16 },
    ],
    rows: data.accounts
      .filter((a) => !a.archived)
      .map((a) => [
        a.name,
        ACCOUNT_TYPE[a.type]!,
        a.type === 'tarjeta_credito'
          ? -cardDebt(a, data.transactions)
          : accountBalance(a, data.transactions),
      ]),
  };

  return [movimientos, resumen, presupuesto, metas, deudas, cuentas];
}

export function excelFileName(today: string): string {
  return `academia-finanzas-${today}.xlsx`;
}
