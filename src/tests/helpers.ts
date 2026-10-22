import {
  createDefaultData,
  type Account,
  type AppData,
  type Category,
  type Debt,
  type Group,
  type Transaction,
} from '../engine';

/** Generador de ids predecible para las pruebas. */
export function idGen(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/** Datos por defecto + cuentas conocidas: banco, nequi y una tarjeta enlazada a su deuda. */
export function makeData(overrides: Partial<AppData> = {}): AppData {
  const data = createDefaultData(idGen('def'));
  const accounts: Account[] = [
    {
      id: 'banco',
      name: 'Bancolombia ahorros',
      type: 'banco',
      openingBalance: 1_000_000,
      archived: false,
      order: 0,
    },
    {
      id: 'nequi',
      name: 'Nequi',
      type: 'billetera',
      openingBalance: 200_000,
      archived: false,
      order: 1,
    },
    {
      id: 'visa',
      name: 'Tarjeta Visa',
      type: 'tarjeta_credito',
      openingBalance: 500_000,
      archived: false,
      debtId: 'deuda-visa',
      order: 2,
    },
  ];
  const debts: Debt[] = [
    {
      id: 'deuda-visa',
      name: 'Tarjeta Visa',
      type: 'tarjeta_credito',
      openingBalance: 0,
      rateEA: 27,
      minPayment: 80_000,
      archived: false,
    },
  ];
  return { ...data, accounts, debts, ...overrides };
}

export function categoryId(data: AppData, group: Group, name: string): string {
  const c = data.categories.find((x: Category) => x.group === group && x.name === name);
  if (!c) throw new Error(`No existe la categoría ${group}/${name}`);
  return c.id;
}

let txCounter = 0;
export function tx(fields: Omit<Transaction, 'id'> & { id?: string }): Transaction {
  return { id: fields.id ?? `tx-${++txCounter}`, ...fields };
}
