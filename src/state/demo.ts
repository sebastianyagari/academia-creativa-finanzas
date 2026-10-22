/**
 * Datos de ejemplo (SPEC 6.9), basados en el demo() del prototipo: 6 meses de
 * movimientos que terminan en saldos, metas y deudas conocidos. A diferencia
 * del prototipo, la tarjeta es una cuenta tarjeta_credito enlazada a su deuda y
 * se paga con transferencias desde el banco (SPEC 4.3).
 */
import {
  accountBalance,
  addMonths,
  createDefaultData,
  dayOf,
  monthOf,
  type AppData,
  type Category,
  type Kind,
  type Recurring,
  type Transaction,
} from '../engine';

/** Generador pseudoaleatorio con semilla: el ejemplo es siempre el mismo. */
function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUDGETS: Record<string, { budget: number; dueDay?: number }> = {
  Salario: { budget: 3_400_000 },
  'Ingresos extra': { budget: 150_000 },
  'Arriendo o cuota de vivienda': { budget: 750_000, dueDay: 5 },
  'Servicios públicos': { budget: 190_000, dueDay: 28 },
  'Internet y celular': { budget: 125_000, dueDay: 15 },
  Suscripciones: { budget: 48_000, dueDay: 20 },
  Mercado: { budget: 460_000 },
  Transporte: { budget: 170_000 },
  'Comida fuera': { budget: 130_000 },
  Salud: { budget: 70_000 },
  Ocio: { budget: 70_000 },
  'Gastos hormiga': { budget: 70_000 },
  'Fondo de inversión': { budget: 100_000 },
};

const NOTES: Record<string, string[]> = {
  Mercado: ['Supermercado', 'Plaza de mercado', 'Tiendas D1'],
  Transporte: ['Gasolina', 'Recarga TuLlave', 'Taxi'],
  'Comida fuera': ['Almuerzo', 'Domicilio', 'Pizza'],
  Salud: ['Droguería', 'Cita médica'],
  Ocio: ['Cine', 'Salida con amigos'],
  'Gastos hormiga': ['Café', 'Empanadas', 'Helado'],
};

export function createDemoData(
  today: string,
  newId: () => string = () => crypto.randomUUID(),
): AppData {
  const base = createDefaultData(newId);
  const r = rng(11);
  const current = monthOf(today);

  const categories: Category[] = base.categories.map((c) => {
    const b = BUDGETS[c.name];
    return b ? { ...c, budget: b.budget, ...(b.dueDay ? { dueDay: b.dueDay } : {}) } : c;
  });
  const cat = (name: string) => categories.find((c) => c.name === name)!;

  const [cashAcc, nequiAcc, daviAcc, bankAcc] = base.accounts;
  const cash = cashAcc!.id;
  const nequi = nequiAcc!.id;
  const bank = bankAcc!.id;
  const cardId = newId();
  const cardDebtId = newId();
  const accounts = [
    { ...cashAcc! },
    { ...nequiAcc! },
    { ...daviAcc! },
    { ...bankAcc!, name: 'Bancolombia ahorros' },
    {
      id: cardId,
      name: 'Tarjeta de crédito',
      type: 'tarjeta_credito' as const,
      openingBalance: 0,
      archived: false,
      debtId: cardDebtId,
      order: 4,
    },
  ];
  const rotation = [cash, nequi, bank, nequi];

  const goals = [
    {
      id: newId(),
      name: 'Fondo de emergencia',
      target: 6_000_000,
      openingSaved: 0,
      deadline: addMonths(current, 10),
      archived: false,
    },
    {
      id: newId(),
      name: 'Viaje a Cartagena',
      target: 2_500_000,
      openingSaved: 0,
      deadline: addMonths(current, 6),
      archived: false,
    },
  ];
  const debts = [
    {
      id: cardDebtId,
      name: 'Tarjeta de crédito',
      type: 'tarjeta_credito' as const,
      openingBalance: 0,
      rateEA: 27,
      minPayment: 160_000,
      archived: false,
    },
    {
      id: newId(),
      name: 'Crédito de libre inversión',
      type: 'credito' as const,
      openingBalance: 0,
      rateEA: 22,
      minPayment: 260_000,
      archived: false,
    },
    {
      id: newId(),
      name: 'Préstamo familiar',
      type: 'otro' as const,
      openingBalance: 0,
      rateEA: 0,
      minPayment: 100_000,
      archived: false,
    },
  ];

  // Movimientos que se repiten (SPEC 6.9): sus movimientos quedan enlazados, así
  // solo aparecen como pendientes los de este mes que aún no llegan.
  const firstMonth = addMonths(current, -5);
  const repeating = (
    kind: Kind,
    amount: number,
    day: number,
    fields: Partial<Recurring>,
  ): Recurring => ({
    id: newId(),
    kind,
    amount,
    accountId: bank,
    schedule: { type: 'mensual', day },
    active: true,
    startMonth: firstMonth,
    ...fields,
  });
  const nomina = repeating('ingreso', 3_400_000, 1, {
    categoryId: cat('Salario').id,
    note: 'Nómina',
  });
  const arriendo = repeating('factura', 750_000, 5, {
    categoryId: cat('Arriendo o cuota de vivienda').id,
  });
  const internet = repeating('factura', 125_000, 15, {
    categoryId: cat('Internet y celular').id,
    accountId: nequi,
  });
  const pagoTarjeta = repeating('transferencia', 160_000, 10, {
    toAccountId: cardId,
    note: 'Pago tarjeta',
  });
  const recurrings = [nomina, arriendo, internet, pagoTarjeta];

  const transactions: Transaction[] = [];
  const paidGoal = [0, 0];
  const paidDebt = [0, 0, 0];

  for (let i = -5; i <= 0; i++) {
    const month = addMonths(current, i);
    const last = i === 0 ? dayOf(today) : 28;
    const add = (day: number, amount: number, kind: Kind, fields: Partial<Transaction>) => {
      if (day > last) return null;
      const t: Transaction = {
        id: newId(),
        kind,
        date: `${month}-${String(day).padStart(2, '0')}`,
        amount: Math.round(amount / 1000) * 1000,
        accountId: bank,
        ...fields,
      };
      if (t.fromRecurringId) t.scheduledDate = t.date;
      transactions.push(t);
      return t;
    };

    add(1, 3_400_000, 'ingreso', {
      categoryId: cat('Salario').id,
      note: 'Nómina',
      fromRecurringId: nomina.id,
    });
    if (i % 2 === 0) {
      add(18, 120_000 + Math.round(r() * 80_000), 'ingreso', {
        categoryId: cat('Ingresos extra').id,
        accountId: nequi,
        note: 'Trabajo freelance',
      });
    }
    add(5, 750_000, 'factura', {
      categoryId: cat('Arriendo o cuota de vivienda').id,
      fromRecurringId: arriendo.id,
    });
    if (i < 0) {
      add(28, 170_000 + Math.round(r() * 40_000), 'factura', {
        categoryId: cat('Servicios públicos').id,
      });
    }
    add(15, 125_000, 'factura', {
      categoryId: cat('Internet y celular').id,
      accountId: nequi,
      fromRecurringId: internet.id,
    });
    add(20, 48_000, 'factura', { categoryId: cat('Suscripciones').id, accountId: cardId });

    for (const name of [
      'Mercado',
      'Transporte',
      'Comida fuera',
      'Salud',
      'Ocio',
      'Gastos hormiga',
    ]) {
      const c = cat(name);
      const k = name === 'Mercado' ? 3 : name === 'Gastos hormiga' ? 4 : name === 'Salud' ? 1 : 2;
      for (let j = 0; j < k; j++) {
        const day = 1 + Math.floor(r() * 27);
        const amount = (c.budget / k) * (0.78 + r() * 0.4);
        const notes = NOTES[name]!;
        add(day, amount, 'gasto', {
          categoryId: c.id,
          accountId: rotation[Math.floor(r() * 4)]!,
          note: notes[Math.floor(r() * notes.length)]!,
        });
      }
    }
    add(3, 100_000, 'inversion', {
      categoryId: cat('Fondo de inversión').id,
      note: 'Aporte mensual',
    });

    const a1 = add(2, 200_000, 'ahorro', { goalId: goals[0]!.id });
    if (a1) paidGoal[0]! += a1.amount;
    const a2 = add(2, 150_000, 'ahorro', { goalId: goals[1]!.id });
    if (a2) paidGoal[1]! += a2.amount;

    // Tarjeta: se paga con transferencia. Créditos: pago de deuda.
    const p0 = add(10, debts[0]!.minPayment, 'transferencia', {
      toAccountId: cardId,
      note: 'Pago tarjeta',
      fromRecurringId: pagoTarjeta.id,
    });
    if (p0) paidDebt[0]! += p0.amount;
    debts.slice(1).forEach((d, k) => {
      const p = add(10, d.minPayment, 'pago_deuda', { debtId: d.id, note: 'Cuota' });
      if (p) paidDebt[k + 1]! += p.amount;
    });
  }

  // Saldos de hoy conocidos: se despeja el saldo inicial de cada cuenta.
  const targets: [string, number][] = [
    [cash, 180_000],
    [nequi, 420_000],
    [bank, 2_350_000],
  ];
  for (const [id, target] of targets) {
    const acc = accounts.find((a) => a.id === id)!;
    acc.openingBalance = target - (accountBalance(acc, transactions) - acc.openingBalance);
  }
  const cardCharges = transactions
    .filter((t) => t.accountId === cardId)
    .reduce((s, t) => s + t.amount, 0);
  accounts[4]!.openingBalance = 3_200_000 - cardCharges + paidDebt[0]!;

  goals[0]!.openingSaved = 1_900_000 - paidGoal[0]!;
  goals[1]!.openingSaved = 950_000 - paidGoal[1]!;
  debts[1]!.openingBalance = 4_500_000 + paidDebt[1]!;
  debts[2]!.openingBalance = 800_000 + paidDebt[2]!;

  transactions.sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...base,
    categories,
    accounts,
    goals,
    debts,
    transactions,
    recurrings,
    settings: { ...base.settings, extraPayment: 150_000, isDemo: true },
  };
}
