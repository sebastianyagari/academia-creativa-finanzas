import type { Account, AppData, Category, Group, Profile, Settings } from './types';

/** Categoría de sistema donde caen los intereses de los pagos de deuda (SPEC 4.2). */
export const INTEREST_CATEGORY_ID = 'sistema-intereses';

export const CURRENT_SCHEMA_VERSION = 1;

type IdFn = () => string;

const DEFAULT_CATEGORIES: Record<Group, { names: string[]; other: string }> = {
  ingresos: {
    names: [
      'Salario',
      'Honorarios o trabajo independiente',
      'Ventas',
      'Prima de servicios',
      'Cesantías e intereses',
      'Ingresos extra',
    ],
    other: 'Otros ingresos',
  },
  facturas: {
    names: [
      'Arriendo o cuota de vivienda',
      'Servicios públicos',
      'Internet y celular',
      'Suscripciones',
      'Seguros',
      'Educación',
      'Administración',
    ],
    other: 'Otras facturas',
  },
  gastos: {
    names: [
      'Mercado',
      'Transporte',
      'Comida fuera',
      'Salud',
      'Ocio',
      'Ropa',
      'Mascotas',
      'Gastos hormiga',
      'Impuestos y GMF (4x1000)',
    ],
    other: 'Otros gastos',
  },
  inversiones: {
    names: ['CDT', 'Fondo de inversión', 'Acciones o ETF'],
    other: 'Otras inversiones',
  },
};

function category(id: string, group: Group, name: string, extra: Partial<Category> = {}): Category {
  return {
    id,
    group,
    name,
    budget: 0,
    isOther: false,
    isSystem: false,
    archived: false,
    order: 0,
    ...extra,
  };
}

/**
 * Categorías precargadas para Colombia (SPEC 4.4), en el orden de la SPEC.
 * Cada grupo termina con su "Otros".
 */
export function defaultCategories(newId: IdFn): Category[] {
  const out: Category[] = [];
  for (const group of Object.keys(DEFAULT_CATEGORIES) as Group[]) {
    const { names, other } = DEFAULT_CATEGORIES[group];
    const inGroup: Category[] = names.map((name) => category(newId(), group, name));
    if (group === 'gastos') {
      inGroup.push(
        category(INTEREST_CATEGORY_ID, 'gastos', 'Intereses y cuotas de manejo', {
          isSystem: true,
        }),
      );
    }
    inGroup.push(category(newId(), group, other, { isOther: true }));
    out.push(...inGroup.map((c, order) => ({ ...c, order })));
  }
  return out;
}

export function defaultAccounts(newId: IdFn): Account[] {
  const accounts: Omit<Account, 'order'>[] = [
    { id: newId(), name: 'Efectivo', type: 'efectivo', openingBalance: 0, archived: false },
    { id: newId(), name: 'Nequi', type: 'billetera', openingBalance: 0, archived: false },
    { id: newId(), name: 'Daviplata', type: 'billetera', openingBalance: 0, archived: false },
    { id: newId(), name: 'Cuenta de ahorros', type: 'banco', openingBalance: 0, archived: false },
  ];
  return accounts.map((a, order) => ({ ...a, order }));
}

export function defaultProfile(): Profile {
  return {
    name: '',
    incomeType: 'empleado',
    payFrequency: 'mensual',
    mainGoal: 'ordenar',
    onboardingDone: false,
    firstStepsDone: [],
  };
}

export function defaultSettings(): Settings {
  return {
    strategy: 'avalancha',
    extraPayment: 0,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: 'sistema',
  };
}

/** Datos con los que queda la app si se salta el onboarding (SPEC 6.1). */
export function createDefaultData(newId: IdFn = () => crypto.randomUUID()): AppData {
  return {
    accounts: defaultAccounts(newId),
    categories: defaultCategories(newId),
    transactions: [],
    recurrings: [],
    recurringSkips: [],
    goals: [],
    debts: [],
    profile: defaultProfile(),
    settings: defaultSettings(),
  };
}
