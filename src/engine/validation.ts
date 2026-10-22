/**
 * Validación de un movimiento antes de guardarlo (SPEC 6.3, 4.3 y Anexo D.1, D.3).
 * Devuelve mensajes en español listos para mostrar; lista vacía = válido.
 */
import { isValidDate } from './dates';
import type { AppData, Group, Kind, Transaction } from './types';

const CATEGORY_GROUP: Partial<Record<Kind, Group>> = {
  ingreso: 'ingresos',
  factura: 'facturas',
  gasto: 'gastos',
  inversion: 'inversiones',
};

const CARD_ALLOWED: ReadonlySet<Kind> = new Set(['gasto', 'factura', 'inversion']);

export function validateTransaction(
  tx: Transaction,
  data: Pick<AppData, 'accounts' | 'categories' | 'goals' | 'debts'>,
): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(tx.amount) || tx.amount <= 0) errors.push('Escribe un monto mayor a 0.');
  if (!isValidDate(tx.date)) errors.push('Elige una fecha válida.');

  const account = data.accounts.find((a) => a.id === tx.accountId);
  if (!account) errors.push('Elige una cuenta.');

  if (tx.kind === 'transferencia') {
    const to = data.accounts.find((a) => a.id === tx.toAccountId);
    if (!to) errors.push('Elige la cuenta de destino.');
    else if (to.id === tx.accountId)
      errors.push('La cuenta de origen y la de destino deben ser distintas.');
    if (account?.type === 'tarjeta_credito') {
      errors.push('En esta versión no se pueden sacar avances de una tarjeta de crédito.');
    }
    return errors;
  }

  if (account?.type === 'tarjeta_credito' && !CARD_ALLOWED.has(tx.kind)) {
    errors.push(
      'Con una tarjeta de crédito solo puedes registrar compras: gastos, facturas o inversiones.',
    );
  }

  const group = CATEGORY_GROUP[tx.kind];
  if (group) {
    const category = data.categories.find((c) => c.id === tx.categoryId);
    if (!category) errors.push('Elige una categoría.');
    else if (category.group !== group)
      errors.push('La categoría no corresponde al tipo de movimiento.');
  }

  if (tx.kind === 'ahorro' && !data.goals.some((g) => g.id === tx.goalId))
    errors.push('Elige una meta.');

  if (tx.kind === 'pago_deuda') {
    const debt = data.debts.find((d) => d.id === tx.debtId);
    if (!debt) errors.push('Elige una deuda.');
    else if (debt.type === 'tarjeta_credito') {
      errors.push('El pago de una tarjeta se registra como transferencia hacia la tarjeta.');
    }
    const interest = tx.interestPart ?? 0;
    if (!Number.isInteger(interest) || interest < 0 || interest > tx.amount) {
      errors.push('Los intereses deben estar entre 0 y el monto del pago.');
    }
  }
  return errors;
}
