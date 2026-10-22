/**
 * Aporte a una meta (Metas → Aportar) y pago de un crédito (Deudas → Registrar pago).
 * Comparten forma: monto, cuenta de origen, fecha; el pago agrega "intereses".
 */
import { useState, type FormEvent } from 'react';
import { newId } from '../../engine/id';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import s from '../../components/ui.module.css';
import {
  goalProgress,
  goalSaved,
  repeatMonthly,
  validateTransaction,
  type Transaction,
} from '../../engine';
import { useNav, type PendingRef } from '../../state/nav';
import { useStore } from '../../state/store';
import { accountsFor } from '../shared/describe';
import { DeleteMovement, FormErrors, RepeatToggle } from './TransactionSheet';

export function ContributionSheet({
  goalId,
  editId,
  pending,
}: {
  goalId: string;
  editId?: string;
  pending?: PendingRef;
}) {
  const { data, currentMonth } = useStore();
  const goal = data.goals.find((g) => g.id === goalId);
  const suggested = goal
    ? goalProgress(goal, goalSaved(goal, data.transactions), currentMonth).suggested
    : 0;
  return (
    <MovementForm
      kind="ahorro"
      title={`${editId ? 'Editar aporte a' : 'Aportar a'} ${goal?.name ?? 'meta'}`}
      link={{ goalId }}
      editId={editId}
      pending={pending}
      defaultAmount={suggested}
      savedMessage="Aporte registrado"
    />
  );
}

export function DebtPaymentSheet({
  debtId,
  editId,
  pending,
}: {
  debtId: string;
  editId?: string;
  pending?: PendingRef;
}) {
  const { data } = useStore();
  const debt = data.debts.find((d) => d.id === debtId);
  return (
    <MovementForm
      kind="pago_deuda"
      title={`${editId ? 'Editar pago a' : 'Pago a'} ${debt?.name ?? 'deuda'}`}
      link={{ debtId }}
      editId={editId}
      pending={pending}
      defaultAmount={debt?.minPayment ?? 0}
      savedMessage="Pago registrado"
      withInterest
    />
  );
}

function MovementForm({
  kind,
  title,
  link,
  editId,
  pending,
  defaultAmount,
  savedMessage,
  withInterest,
}: {
  kind: 'ahorro' | 'pago_deuda';
  title: string;
  link: { goalId: string } | { debtId: string };
  editId?: string;
  pending?: PendingRef;
  defaultAmount: number;
  savedMessage: string;
  withInterest?: boolean;
}) {
  const { data, today, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const editing = data.transactions.find((t) => t.id === editId);
  const template = pending ? data.recurrings.find((r) => r.id === pending.recurringId) : undefined;
  const base = editing ?? template;
  const accounts = accountsFor(data, kind, base?.accountId);

  const [amount, setAmount] = useState(base?.amount ?? defaultAmount);
  const [interest, setInterest] = useState(editing?.interestPart ?? 0);
  const [accountId, setAccountId] = useState(base?.accountId ?? accounts[0]?.id ?? '');
  const [date, setDate] = useState(editing?.date ?? pending?.scheduledDate ?? today);
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fromPending = pending
      ? { fromRecurringId: pending.recurringId, scheduledDate: pending.scheduledDate }
      : {};
    let tx: Transaction = {
      ...(editing?.fromRecurringId
        ? { fromRecurringId: editing.fromRecurringId, scheduledDate: editing.scheduledDate }
        : fromPending),
      id: editing?.id ?? newId(),
      kind,
      date,
      amount,
      accountId,
      ...link,
      ...(withInterest && interest > 0 ? { interestPart: interest } : {}),
      ...(base?.note ? { note: base.note } : {}),
    };
    const problems = validateTransaction(tx, data);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    if (repeat) {
      const linked = repeatMonthly(tx, newId());
      tx = linked.transaction;
      await actions.saveTransaction(tx, linked.recurring);
    } else {
      await actions.saveTransaction(tx);
    }
    nav.closeSheet();
    toast(
      editing
        ? 'Cambios guardados'
        : repeat
          ? `${savedMessage}. Se repetirá cada mes.`
          : savedMessage,
    );
  }

  return (
    <Sheet title={title} onClose={nav.closeSheet}>
      <form className={s.form} onSubmit={submit} noValidate>
        <label htmlFor="f-amount">
          {withInterest ? 'Monto pagado' : 'Monto'}
          <MoneyInput id="f-amount" value={amount} onChange={setAmount} large />
        </label>
        {withInterest && (
          <label htmlFor="f-interest">
            De este pago, intereses (opcional)
            <MoneyInput id="f-interest" value={interest} onChange={setInterest} />
            <span className={s.hint}>
              Si tu banco te dice cuánto fue interés, escríbelo: esa parte cuenta como gasto y el
              resto baja tu deuda.
            </span>
          </label>
        )}
        <div className={s.pair}>
          <label htmlFor="f-acc">
            Sale de
            <select
              id="f-acc"
              className={s.input}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="f-date">
            Fecha
            <input
              id="f-date"
              className={s.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        {!editing && !pending && <RepeatToggle checked={repeat} onChange={setRepeat} date={date} />}
        <FormErrors errors={errors} />
        <button type="submit" className={s.btn}>
          {editing ? 'Guardar cambios' : 'Guardar'}
        </button>
        {editing && <DeleteMovement id={editing.id} />}
      </form>
    </Sheet>
  );
}
