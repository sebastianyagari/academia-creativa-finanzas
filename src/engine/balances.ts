/**
 * Saldos derivados (SPEC 4.1). Nunca se guardan: se calculan desde los movimientos.
 * `asOf` (opcional) limita a los movimientos con fecha <= asOf.
 */
import type { Account, AppData, Debt, Goal, Transaction } from './types';

const OUTFLOW_KINDS = new Set(['factura', 'gasto', 'inversion', 'ahorro', 'pago_deuda']);
const CARD_CHARGE_KINDS = new Set(['gasto', 'factura', 'inversion']);

function upTo(transactions: Transaction[], asOf?: string): Transaction[] {
  return asOf ? transactions.filter((t) => t.date <= asOf) : transactions;
}

/** Saldo de una cuenta que no es tarjeta. */
export function accountBalance(
  account: Account,
  transactions: Transaction[],
  asOf?: string,
): number {
  let balance = account.openingBalance;
  for (const t of upTo(transactions, asOf)) {
    if (t.kind === 'transferencia') {
      if (t.accountId === account.id) balance -= t.amount;
      if (t.toAccountId === account.id) balance += t.amount;
    } else if (t.accountId === account.id) {
      if (t.kind === 'ingreso') balance += t.amount;
      else if (OUTFLOW_KINDS.has(t.kind)) balance -= t.amount;
    }
  }
  return balance;
}

/**
 * Deuda de una tarjeta de crédito: compras la suben, transferencias hacia ella la bajan.
 * Puede quedar negativa si la persona pagó de más (saldo a favor).
 */
export function cardDebt(card: Account, transactions: Transaction[], asOf?: string): number {
  let debt = card.openingBalance;
  for (const t of upTo(transactions, asOf)) {
    if (t.kind === 'transferencia' && t.toAccountId === card.id) debt -= t.amount;
    else if (t.accountId === card.id && CARD_CHARGE_KINDS.has(t.kind)) debt += t.amount;
  }
  return debt;
}

/** Lo ahorrado en una meta. */
export function goalSaved(goal: Goal, transactions: Transaction[], asOf?: string): number {
  let saved = goal.openingSaved;
  for (const t of upTo(transactions, asOf)) {
    if (t.kind === 'ahorro' && t.goalId === goal.id) saved += t.amount;
  }
  return saved;
}

/** Saldo de una deuda tipo crédito u otro: solo el abono a capital la baja. */
export function loanBalance(debt: Debt, transactions: Transaction[], asOf?: string): number {
  let paid = 0;
  for (const t of upTo(transactions, asOf)) {
    if (t.kind === 'pago_deuda' && t.debtId === debt.id) paid += t.amount - (t.interestPart ?? 0);
  }
  return Math.max(0, debt.openingBalance - paid);
}

/**
 * Saldo de cualquier deuda. Las de tipo tarjeta toman el saldo de su cuenta
 * (Anexo D.5); un saldo a favor cuenta como 0 deuda.
 */
export function debtBalance(
  debt: Debt,
  data: Pick<AppData, 'accounts' | 'transactions'>,
  asOf?: string,
): number {
  if (debt.type === 'tarjeta_credito') {
    const card = data.accounts.find((a) => a.type === 'tarjeta_credito' && a.debtId === debt.id);
    return card ? Math.max(0, cardDebt(card, data.transactions, asOf)) : 0;
  }
  return loanBalance(debt, data.transactions, asOf);
}

export interface NetWorth {
  /** Suma de cuentas que no son tarjeta (archivadas incluidas: la plata sigue existiendo). */
  assets: number;
  /** Deuda de tarjetas (neta de saldos a favor) más créditos y otros. */
  liabilities: number;
  netWorth: number;
}

/**
 * Patrimonio neto (SPEC 4.1 y Anexo D.4): cuentas − tarjetas − créditos y otros.
 * Las deudas archivadas ("quitadas") no cuentan.
 */
export function netWorth(
  data: Pick<AppData, 'accounts' | 'transactions' | 'debts'>,
  asOf?: string,
): NetWorth {
  let assets = 0;
  let cards = 0;
  for (const account of data.accounts) {
    if (account.type === 'tarjeta_credito') cards += cardDebt(account, data.transactions, asOf);
    else assets += accountBalance(account, data.transactions, asOf);
  }
  let loans = 0;
  for (const debt of data.debts) {
    if (debt.type !== 'tarjeta_credito' && !debt.archived)
      loans += loanBalance(debt, data.transactions, asOf);
  }
  const liabilities = cards + loans;
  return { assets, liabilities, netWorth: assets - liabilities };
}
