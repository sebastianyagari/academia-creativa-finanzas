/**
 * Tarjeta de crédito = cuenta tarjeta_credito + deuda enlazada (SPEC 4.3, Anexo D.5).
 * El saldo vive en la cuenta; la deuda guarda la tasa EA y la cuota mínima.
 */
import type { Account, Debt } from './types';

export interface NewCard {
  name: string;
  /** Lo que se debe hoy en la tarjeta. */
  currentDebt: number;
  rateEA: number;
  minPayment: number;
  order: number;
}

export function createCard(card: NewCard, newId: () => string): { account: Account; debt: Debt } {
  const debtId = newId();
  return {
    account: {
      id: newId(),
      name: card.name,
      type: 'tarjeta_credito',
      openingBalance: card.currentDebt,
      archived: false,
      debtId,
      order: card.order,
    },
    debt: {
      id: debtId,
      name: card.name,
      type: 'tarjeta_credito',
      openingBalance: 0,
      rateEA: card.rateEA,
      minPayment: card.minPayment,
      archived: false,
    },
  };
}
