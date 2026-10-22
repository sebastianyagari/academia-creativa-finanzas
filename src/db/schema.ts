/**
 * Esquemas Zod del modelo (SPEC 4). Validan respaldos importados antes de
 * tocar la base (SPEC 9.2): un archivo corrupto nunca llega a guardarse.
 */
import { z } from 'zod';
import type { AppData } from '../engine';

const id = z.string().min(1);
const money = z.number().int();
const positiveMoney = money.positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-\d{2}$/);
const kind = z.enum([
  'ingreso',
  'factura',
  'gasto',
  'inversion',
  'ahorro',
  'pago_deuda',
  'transferencia',
]);

export const accountSchema = z.object({
  id,
  name: z.string(),
  type: z.enum(['efectivo', 'billetera', 'banco', 'tarjeta_credito']),
  openingBalance: money,
  archived: z.boolean(),
  debtId: id.optional(),
});

export const categorySchema = z.object({
  id,
  group: z.enum(['ingresos', 'facturas', 'gastos', 'inversiones']),
  name: z.string(),
  budget: money.nonnegative(),
  dueDay: z.number().int().min(1).max(31).optional(),
  isOther: z.boolean(),
  isSystem: z.boolean(),
  archived: z.boolean(),
});

export const transactionSchema = z.object({
  id,
  kind,
  date,
  amount: positiveMoney,
  accountId: id,
  toAccountId: id.optional(),
  categoryId: id.optional(),
  goalId: id.optional(),
  debtId: id.optional(),
  interestPart: money.nonnegative().optional(),
  note: z.string().optional(),
  fromRecurringId: id.optional(),
  scheduledDate: date.optional(),
});

const day = z.number().int().min(1).max(31);

export const recurringSchema = z.object({
  id,
  kind,
  amount: positiveMoney,
  accountId: id,
  toAccountId: id.optional(),
  categoryId: id.optional(),
  goalId: id.optional(),
  debtId: id.optional(),
  note: z.string().optional(),
  schedule: z.discriminatedUnion('type', [
    z.object({ type: z.literal('mensual'), day }),
    z.object({ type: z.literal('quincenal'), days: z.tuple([day, day]) }),
    z.object({ type: z.literal('anual'), month: z.number().int().min(1).max(12), day }),
  ]),
  active: z.boolean(),
  startMonth: month,
});

export const recurringSkipSchema = z.object({ recurringId: id, month, day });

export const goalSchema = z.object({
  id,
  name: z.string(),
  target: positiveMoney,
  openingSaved: money.nonnegative(),
  deadline: month,
  archived: z.boolean(),
});

export const debtSchema = z.object({
  id,
  name: z.string(),
  type: z.enum(['credito', 'tarjeta_credito', 'otro']),
  openingBalance: money.nonnegative(),
  rateEA: z.number().min(0).max(200),
  minPayment: money.nonnegative(),
  archived: z.boolean(),
});

export const profileSchema = z.object({
  name: z.string(),
  incomeType: z.enum(['empleado', 'independiente', 'ambos']),
  payFrequency: z.enum(['mensual', 'quincenal']),
  mainGoal: z.enum(['ordenar', 'ahorrar', 'deudas', 'emergencia']),
  onboardingDone: z.boolean(),
  firstStepsDone: z.array(z.string()),
  firstStepsDismissed: z.boolean().optional(),
  startTab: z.enum(['inicio', 'movimientos', 'presupuesto', 'metas', 'deudas']).optional(),
});

export const settingsSchema = z.object({
  strategy: z.enum(['bola', 'avalancha']),
  extraPayment: money.nonnegative(),
  lastBackupAt: date.optional(),
  schemaVersion: z.number().int().positive(),
  theme: z.enum(['sistema', 'claro', 'oscuro']),
  isDemo: z.boolean().optional(),
});

export const appDataSchema = z.object({
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  recurrings: z.array(recurringSchema),
  recurringSkips: z.array(recurringSkipSchema),
  goals: z.array(goalSchema),
  debts: z.array(debtSchema),
  profile: profileSchema,
  settings: settingsSchema,
});

// Garantiza en compilación que el esquema y el tipo del engine no se separen.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatchesModel: Same<z.infer<typeof appDataSchema>, AppData> = true;
void schemaMatchesModel;
