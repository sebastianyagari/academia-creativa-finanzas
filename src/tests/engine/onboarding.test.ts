import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  applyOnboarding,
  backupReminder,
  budgetSummary,
  createDefaultData,
  debtBalance,
  describeSchedule,
  firstSteps,
  pendingFor,
  suggestedCesantiasInterest,
  suggestedGoal,
  suggestedPrima,
  type AppData,
  type OnboardingAnswers,
  type OnboardingRules,
} from '../../engine';
import { idGen, tx } from '../helpers';

// Cifras legales en null, como el archivo 2026 actual: no se inventan.
const RULES: OnboardingRules = {
  smmlv: null,
  auxilioTransporte: null,
  primaFechas: { semestre1: '06-30', semestre2: '12-20' },
  cesantias: { consignacionFondo: '02-14', interesesAnuales: 0.12, pagoIntereses: '01-31' },
};

const TODAY = '2026-10-21';

function answers(over: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    name: 'Ana',
    incomeType: 'empleado',
    payFrequency: 'quincenal',
    monthlyIncome: 3_400_000,
    payDay: 31,
    cesantias: 'fondo',
    socialSecurity: false,
    accounts: [
      { name: 'Efectivo', type: 'efectivo', balance: 80_000, use: true },
      { name: 'Nequi', type: 'billetera', balance: 150_000, use: true },
      { name: 'Daviplata', type: 'billetera', balance: null, use: false },
      { name: 'Cuenta de ahorros', type: 'banco', balance: 900_000, use: true },
    ],
    debts: [],
    mainGoal: 'ordenar',
    goal: null,
    ...over,
  };
}

const run = (a: OnboardingAnswers, base: AppData = createDefaultData(idGen('d'))) =>
  applyOnboarding(base, a, TODAY, RULES, idGen('o'));

const incomes = (data: AppData) =>
  data.recurrings
    .filter((r) => r.kind === 'ingreso')
    .map((r) => `${r.note} · ${r.amount} · ${describeSchedule(r)}`);

describe('onboarding de un empleado quincenal (SPEC 6.1, 5.5, 7.2)', () => {
  const data = run(answers());

  it('guarda el perfil y marca el onboarding como hecho', () => {
    expect(data.profile).toMatchObject({
      name: 'Ana',
      incomeType: 'empleado',
      payFrequency: 'quincenal',
      onboardingDone: true,
      startTab: 'inicio',
    });
  });

  it('programa la quincena, la prima de junio y diciembre y los intereses de cesantías', () => {
    expect(incomes(data)).toEqual([
      'Pago de quincena · 1700000 · Cada quincena: el día 15 y el último día',
      'Prima de junio (aproximado) · 1700000 · Cada año, el 30 de junio',
      'Prima de diciembre (aproximado) · 1700000 · Cada año, el 20 de diciembre',
      'Intereses de cesantías (aproximado) · 408000 · Cada año, el 31 de enero',
    ]);
  });

  it('las cesantías que van al fondo no se programan; si las recibe, sí (Anexo D.13)', () => {
    const own = run(answers({ cesantias: 'cuenta' }));
    expect(incomes(own)).toContain('Cesantías (aproximado) · 3400000 · Cada año, el 14 de febrero');
  });

  it('el ingreso declarado es el ingreso esperado del presupuesto (Anexo D.12)', () => {
    expect(budgetSummary(data, '2026-10').budgets.ingresos).toBe(3_400_000);
  });

  it('deja los saldos de hoy y archiva las cuentas por defecto sin uso', () => {
    const byName = (n: string) => data.accounts.find((a) => a.name === n)!;
    expect(accountBalance(byName('Efectivo'), data.transactions)).toBe(80_000);
    expect(accountBalance(byName('Cuenta de ahorros'), data.transactions)).toBe(900_000);
    expect(byName('Daviplata').archived).toBe(true);
  });

  it('los ingresos programados quedan pendientes, no se anotan solos (SPEC 2.4)', () => {
    expect(data.transactions).toEqual([]);
    expect(pendingFor(data, '2026-10').map((p) => p.scheduledDate)).toEqual([
      '2026-10-15',
      '2026-10-31',
    ]);
  });
});

describe('otros perfiles', () => {
  it('independiente: sin prima ni cesantías, con categoría de seguridad social (Anexo D.14)', () => {
    const data = run(
      answers({
        incomeType: 'independiente',
        payFrequency: 'mensual',
        payDay: 5,
        socialSecurity: true,
      }),
    );
    expect(incomes(data)).toEqual(['Pago del mes · 3400000 · Cada mes, el día 5']);
    const honorarios = data.categories.find(
      (c) => c.name === 'Honorarios o trabajo independiente',
    )!;
    expect(honorarios.budget).toBe(3_400_000);
    const ss = data.categories.find((c) => c.name === 'Seguridad social e impuestos');
    expect(ss).toMatchObject({ group: 'facturas', isOther: false });
  });

  it('deudas: crédito y tarjeta (la tarjeta crea cuenta y deuda enlazadas)', () => {
    const data = run(
      answers({
        mainGoal: 'deudas',
        debts: [
          {
            name: 'Crédito libre inversión',
            balance: 4_500_000,
            rateEA: 22,
            minPayment: 260_000,
            isCard: false,
          },
          { name: 'Visa', balance: 3_200_000, rateEA: 27, minPayment: 160_000, isCard: true },
        ],
      }),
    );
    expect(data.profile.startTab).toBe('deudas');
    expect(data.debts.map((d) => [d.name, d.type, debtBalance(d, data)])).toEqual([
      ['Crédito libre inversión', 'credito', 4_500_000],
      ['Visa', 'tarjeta_credito', 3_200_000],
    ]);
    expect(data.accounts.find((a) => a.name === 'Visa')?.type).toBe('tarjeta_credito');
  });

  it('fondo de emergencia: crea la meta y abre en Metas', () => {
    const goal = suggestedGoal('emergencia', 3_400_000, TODAY);
    expect(goal).toEqual({ name: 'Fondo de emergencia', target: 10_200_000, deadline: '2027-10' });
    const data = run(answers({ mainGoal: 'emergencia', goal }));
    expect(data.goals).toHaveLength(1);
    expect(data.profile.startTab).toBe('metas');
  });

  it('saltar todo deja la app usable con lo que hay por defecto', () => {
    const base = createDefaultData(idGen('d'));
    const data = run(answers({ name: '', monthlyIncome: 0, accounts: null }), base);
    expect(data.profile.onboardingDone).toBe(true);
    expect(data.accounts).toEqual(base.accounts);
    expect(data.categories).toEqual(base.categories);
    expect(data.recurrings).toEqual([]);
  });
});

describe('repetir el onboarding (SPEC 6.1: sin borrar datos)', () => {
  it('no duplica cuentas, ingresos, prima ni metas, y conserva los movimientos', () => {
    const goal = { name: 'Viaje', target: 2_000_000, deadline: '2027-06' };
    const first = run(answers({ mainGoal: 'ahorrar', goal }));
    const salaryAccount = first.accounts.find((a) => a.name === 'Cuenta de ahorros')!;
    first.transactions.push(
      tx({
        id: 'g1',
        kind: 'gasto',
        date: '2026-10-20',
        amount: 50_000,
        accountId: salaryAccount.id,
        categoryId: 'x',
      }),
    );

    const second = run(answers({ monthlyIncome: 4_000_000, mainGoal: 'ahorrar', goal }), first);
    expect(second.accounts.length).toBe(first.accounts.length);
    expect(second.goals).toHaveLength(1);
    expect(second.recurrings).toHaveLength(first.recurrings.length);
    expect(second.recurrings.find((r) => r.note === 'Pago de quincena')?.amount).toBe(2_000_000);
    expect(second.transactions).toEqual(first.transactions);
    // El saldo declarado se respeta aunque ya haya movimientos.
    expect(
      accountBalance(
        second.accounts.find((a) => a.name === 'Cuenta de ahorros')!,
        second.transactions,
      ),
    ).toBe(900_000);
  });
});

describe('cuentas existentes', () => {
  it('renombrar la cuenta de banco no crea otra', () => {
    const base = createDefaultData(idGen('d'));
    const bank = base.accounts.find((a) => a.type === 'banco')!;
    const data = run(
      answers({
        accounts: [
          { id: bank.id, name: 'Bancolombia', type: 'banco', balance: 500_000, use: true },
        ],
      }),
      base,
    );
    expect(data.accounts.filter((a) => a.type === 'banco').map((a) => a.name)).toEqual([
      'Bancolombia',
    ]);
    expect(
      accountBalance(
        data.accounts.find((a) => a.id === bank.id)!,
        data.transactions,
      ),
    ).toBe(500_000);
  });
});

describe('montos sugeridos', () => {
  it('prima = medio mes; suma medio auxilio de transporte solo si el archivo lo trae', () => {
    expect(suggestedPrima(3_400_000, RULES)).toBe(1_700_000);
    // Valores de prueba, no cifras legales reales.
    const withAux = { ...RULES, smmlv: 1_000_000, auxilioTransporte: 100_000 };
    expect(suggestedPrima(1_500_000, withAux)).toBe(800_000);
    expect(suggestedPrima(2_500_000, withAux)).toBe(1_250_000);
    expect(suggestedCesantiasInterest(1_000_000, RULES)).toBe(120_000);
  });
});

describe('primeros pasos (SPEC 6.1)', () => {
  it('se cumplen con los datos de la persona', () => {
    const data = run(answers());
    expect(firstSteps(data).map((s) => s.done)).toEqual([false, false, false, false]);
    data.transactions.push(
      tx({ kind: 'gasto', date: TODAY, amount: 1, accountId: 'a', categoryId: 'c' }),
    );
    data.categories[10]!.budget = 100_000;
    data.recurrings.push({ ...data.recurrings[0]!, id: 'r-gasto', kind: 'factura' });
    data.settings.lastBackupAt = TODAY;
    expect(firstSteps(data).map((s) => s.done)).toEqual([true, true, true, true]);
  });
});

describe('recordatorio de respaldo (SPEC 9.1)', () => {
  const settings = createDefaultData().settings;
  const one = [tx({ kind: 'gasto', date: TODAY, amount: 1, accountId: 'a' })];

  it('sin movimientos y sin respaldo, no molesta', () => {
    expect(backupReminder({ settings, transactions: [] }, TODAY)).toEqual({
      show: false,
      daysSince: null,
    });
  });

  it('con movimientos y nunca respaldado, avisa', () => {
    expect(backupReminder({ settings, transactions: one }, TODAY).show).toBe(true);
  });

  it('avisa a los 30 días del último respaldo, no antes', () => {
    const at = (last: string) =>
      backupReminder({ settings: { ...settings, lastBackupAt: last }, transactions: one }, TODAY);
    expect(at('2026-09-22')).toEqual({ show: false, daysSince: 29 });
    expect(at('2026-09-21')).toEqual({ show: true, daysSince: 30 });
  });
});
