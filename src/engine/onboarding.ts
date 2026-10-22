/**
 * Onboarding (SPEC 6.1, 7.2 y Anexo D.7, D.8, D.12–D.14, D.17).
 * Convierte las respuestas en datos. Es idempotente: repetirlo desde Ajustes
 * actualiza lo que ya existe (cuentas, ingreso, prima, cesantías, meta) en vez
 * de duplicarlo, y nunca borra movimientos.
 */
import { accountBalance } from './balances';
import { createCard } from './cards';
import { addMonths, monthOf } from './dates';
import { insertCategory, nextAccountOrder } from './order';
import type {
  Account,
  AccountType,
  AppData,
  Category,
  Profile,
  Recurring,
  Schedule,
  TabId,
} from './types';

/** Parámetros de Colombia que usa el onboarding (subconjunto de /rules/co/AAAA.json). */
export interface OnboardingRules {
  smmlv: number | null;
  auxilioTransporte: number | null;
  primaFechas: { semestre1: string; semestre2: string };
  cesantias: { consignacionFondo: string; interesesAnuales: number; pagoIntereses: string };
}

export interface OnboardingAccount {
  /** Cuenta existente que se edita (permite renombrar sin duplicar). */
  id?: string;
  name: string;
  type: Exclude<AccountType, 'tarjeta_credito'>;
  /** Saldo de hoy; null si no lo dijo (no se toca el saldo actual). */
  balance: number | null;
  use: boolean;
}

export interface OnboardingDebt {
  name: string;
  balance: number;
  rateEA: number;
  minPayment: number;
  isCard: boolean;
}

export interface OnboardingAnswers {
  name: string;
  incomeType: Profile['incomeType'];
  payFrequency: Profile['payFrequency'];
  /** Ingreso mensual aproximado; 0 si no lo dijo. */
  monthlyIncome: number;
  /** Día de pago si es mensual (31 = último día del mes). */
  payDay: number;
  /** Cesantías: las recibe la persona o las consigna el empleador al fondo (Anexo D.13). */
  cesantias: 'cuenta' | 'fondo';
  /** Independientes: crear la categoría "Seguridad social e impuestos" (Anexo D.14). */
  socialSecurity: boolean;
  /** null = saltó el paso de cuentas. */
  accounts: OnboardingAccount[] | null;
  debts: OnboardingDebt[];
  mainGoal: Profile['mainGoal'];
  goal: { name: string; target: number; deadline: string } | null;
}

export const APPROX_LABEL = 'Aproximado. Verifica con tu empleador o contador.';

const START_TAB: Record<Profile['mainGoal'], TabId> = {
  ordenar: 'inicio',
  ahorrar: 'metas',
  emergencia: 'metas',
  deudas: 'deudas',
};

function parseMonthDay(md: string): { month: number; day: number } {
  const [m, d] = md.split('-').map(Number);
  return { month: m!, day: d! };
}

/**
 * Prima sugerida por semestre: medio mes de salario, más medio auxilio de
 * transporte si aplica (hasta 2 SMMLV) y si el archivo de parámetros lo trae.
 */
export function suggestedPrima(monthlyIncome: number, rules: OnboardingRules): number {
  const transport =
    rules.auxilioTransporte !== null && rules.smmlv !== null && monthlyIncome <= 2 * rules.smmlv
      ? rules.auxilioTransporte
      : 0;
  return Math.round((monthlyIncome + transport) / 2);
}

/** Intereses de cesantías: tasa anual del archivo sobre un mes de salario (aproximado). */
export function suggestedCesantiasInterest(monthlyIncome: number, rules: OnboardingRules): number {
  return Math.round(monthlyIncome * rules.cesantias.interesesAnuales);
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function applyOnboarding(
  input: AppData,
  answers: OnboardingAnswers,
  today: string,
  rules: OnboardingRules,
  newId: () => string,
): AppData {
  const data: AppData = structuredClone(input);
  const month = monthOf(today);

  data.profile = {
    ...data.profile,
    name: answers.name.trim(),
    incomeType: answers.incomeType,
    payFrequency: answers.payFrequency,
    mainGoal: answers.mainGoal,
    onboardingDone: true,
    startTab: START_TAB[answers.mainGoal],
  };

  // Cuentas: se actualiza la del mismo nombre o se crea; las por defecto sin uso se archivan.
  if (answers.accounts) {
    for (const wanted of answers.accounts) {
      const existing = wanted.id
        ? data.accounts.find((a) => a.id === wanted.id)
        : data.accounts.find(
            (a) => !a.archived && a.type !== 'tarjeta_credito' && sameName(a.name, wanted.name),
          );
      if (!wanted.use) {
        const unused =
          existing &&
          existing.openingBalance === 0 &&
          !data.transactions.some(
            (t) => t.accountId === existing.id || t.toAccountId === existing.id,
          );
        if (unused) existing.archived = true;
        continue;
      }
      if (existing) {
        if (wanted.name.trim()) existing.name = wanted.name.trim();
        existing.type = wanted.type;
        existing.archived = false;
        if (wanted.balance !== null) {
          const current = accountBalance(existing, data.transactions);
          existing.openingBalance += wanted.balance - current;
        }
      } else {
        data.accounts.push({
          id: newId(),
          name: wanted.name.trim(),
          type: wanted.type,
          openingBalance: wanted.balance ?? 0,
          archived: false,
          order: nextAccountOrder(data.accounts),
        });
      }
    }
  }

  const usable = data.accounts.filter((a) => !a.archived && a.type !== 'tarjeta_credito');
  const incomeAccount: Account | undefined =
    usable.find((a) => a.type === 'banco') ??
    usable.find((a) => a.type === 'billetera') ??
    usable[0];

  const category = (group: Category['group'], name: string) =>
    data.categories.find((c) => c.group === group && c.name === name && !c.archived);

  /** Crea o actualiza un ingreso programado identificado por categoría y horario. */
  const upsertIncome = (
    categoryId: string,
    amount: number,
    schedule: Schedule,
    note: string,
    matches: (r: Recurring) => boolean,
  ) => {
    if (!incomeAccount || amount <= 0) return;
    const existing = data.recurrings.find(
      (r) => r.kind === 'ingreso' && r.categoryId === categoryId && matches(r),
    );
    if (existing) {
      Object.assign(existing, { amount, schedule, note, active: true });
    } else {
      data.recurrings.push({
        id: newId(),
        kind: 'ingreso',
        amount,
        accountId: incomeAccount.id,
        categoryId,
        note,
        schedule,
        active: true,
        startMonth: month,
      });
    }
  };

  const income = answers.monthlyIncome;
  if (income > 0) {
    // Ingresos esperados = presupuesto de la categoría principal (Anexo D.12).
    const main =
      answers.incomeType === 'independiente'
        ? category('ingresos', 'Honorarios o trabajo independiente')
        : category('ingresos', 'Salario');
    if (main) {
      main.budget = income;
      const quincenal = answers.payFrequency === 'quincenal';
      upsertIncome(
        main.id,
        quincenal ? Math.round(income / 2) : income,
        quincenal
          ? { type: 'quincenal', days: [15, 31] }
          : { type: 'mensual', day: answers.payDay },
        quincenal ? 'Pago de quincena' : 'Pago del mes',
        (r) => r.schedule.type !== 'anual',
      );
    }

    // Prima y cesantías: solo empleados (SPEC 7.2). Prima = dos plantillas anuales (Anexo D.7).
    if (answers.incomeType !== 'independiente') {
      const prima = category('ingresos', 'Prima de servicios');
      if (prima) {
        const amount = suggestedPrima(income, rules);
        for (const [md, label] of [
          [rules.primaFechas.semestre1, 'Prima de junio (aproximado)'],
          [rules.primaFechas.semestre2, 'Prima de diciembre (aproximado)'],
        ] as const) {
          const { month: m, day } = parseMonthDay(md);
          upsertIncome(
            prima.id,
            amount,
            { type: 'anual', month: m, day },
            label,
            (r) => r.schedule.type === 'anual' && r.schedule.month === m,
          );
        }
      }
      const cesantias = category('ingresos', 'Cesantías e intereses');
      if (cesantias) {
        const interest = parseMonthDay(rules.cesantias.pagoIntereses);
        upsertIncome(
          cesantias.id,
          suggestedCesantiasInterest(income, rules),
          { type: 'anual', month: interest.month, day: interest.day },
          'Intereses de cesantías (aproximado)',
          (r) => r.schedule.type === 'anual' && r.schedule.month === interest.month,
        );
        const fund = parseMonthDay(rules.cesantias.consignacionFondo);
        const matchesFund = (r: Recurring) =>
          r.schedule.type === 'anual' && r.schedule.month === fund.month;
        if (answers.cesantias === 'cuenta') {
          upsertIncome(
            cesantias.id,
            income,
            { type: 'anual', month: fund.month, day: fund.day },
            'Cesantías (aproximado)',
            matchesFund,
          );
        } else {
          // Si van al fondo, no se programan (y se pausa una plantilla anterior).
          const old = data.recurrings.find(
            (r) => r.kind === 'ingreso' && r.categoryId === cesantias.id && matchesFund(r),
          );
          if (old) old.active = false;
        }
      }
    }
  }

  // Independientes (y quienes tienen ambos ingresos) pueden apartar para seguridad social.
  if (answers.socialSecurity && answers.incomeType !== 'empleado') {
    if (!category('facturas', 'Seguridad social e impuestos')) {
      data.categories = insertCategory(data.categories, {
        id: newId(),
        group: 'facturas',
        name: 'Seguridad social e impuestos',
        budget: 0,
        isOther: false,
        isSystem: false,
        archived: false,
        order: 0,
      });
    }
  }

  for (const debt of answers.debts) {
    if (!debt.name.trim()) continue;
    if (debt.isCard) {
      const card = createCard(
        {
          name: debt.name.trim(),
          currentDebt: debt.balance,
          rateEA: debt.rateEA,
          minPayment: debt.minPayment,
          order: nextAccountOrder(data.accounts),
        },
        newId,
      );
      data.accounts.push(card.account);
      data.debts.push(card.debt);
    } else {
      data.debts.push({
        id: newId(),
        name: debt.name.trim(),
        type: 'credito',
        openingBalance: debt.balance,
        rateEA: debt.rateEA,
        minPayment: debt.minPayment,
        archived: false,
      });
    }
  }

  if (answers.goal && answers.goal.target > 0 && answers.goal.name.trim()) {
    const exists = data.goals.find((g) => !g.archived && sameName(g.name, answers.goal!.name));
    if (exists) {
      exists.target = answers.goal.target;
      exists.deadline = answers.goal.deadline;
    } else {
      data.goals.push({
        id: newId(),
        name: answers.goal.name.trim(),
        target: answers.goal.target,
        openingSaved: 0,
        deadline: answers.goal.deadline,
        archived: false,
      });
    }
  }
  return data;
}

/** Meta sugerida según el objetivo principal (editable en el onboarding). */
export function suggestedGoal(
  mainGoal: Profile['mainGoal'],
  monthlyIncome: number,
  today: string,
): { name: string; target: number; deadline: string } | null {
  if (mainGoal === 'emergencia') {
    // Referencia común: tres meses de ingreso. Siempre editable.
    return {
      name: 'Fondo de emergencia',
      target: monthlyIncome * 3,
      deadline: addMonths(monthOf(today), 12),
    };
  }
  if (mainGoal === 'ahorrar')
    return { name: '', target: 0, deadline: addMonths(monthOf(today), 12) };
  return null;
}

export interface FirstStep {
  id: 'primer-gasto' | 'presupuesto' | 'repetido';
  label: string;
  done: boolean;
}

/**
 * "Primeros pasos" (SPEC 6.1), calculados desde los datos. El paso del respaldo
 * se agrega en la Fase 5, cuando exista el respaldo en archivo.
 */
export function firstSteps(data: AppData): FirstStep[] {
  return [
    {
      id: 'primer-gasto',
      label: 'Registra tu primer gasto',
      done: data.transactions.some((t) => t.kind === 'gasto' || t.kind === 'factura'),
    },
    {
      id: 'presupuesto',
      label: 'Define tu presupuesto',
      done: data.categories.some((c) => c.group !== 'ingresos' && !c.archived && c.budget > 0),
    },
    {
      id: 'repetido',
      label: 'Activa un movimiento que se repite',
      // Los ingresos que crea el onboarding no cuentan: el paso es activar uno propio.
      done: data.recurrings.some((r) => r.kind !== 'ingreso'),
    },
  ];
}
