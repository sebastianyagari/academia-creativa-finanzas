/**
 * Aporte a una meta (Metas → Aportar) y pago de un crédito (Deudas → Registrar pago).
 * Comparten forma: monto, cuenta de origen, fecha; el pago agrega "intereses".
 */
import { useState, type FormEvent } from 'react';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import s from '../../components/ui.module.css';
import { goalProgress, goalSaved, validateTransaction, type Transaction } from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { accountsFor } from '../shared/describe';
import { DeleteMovement, FormErrors } from './TransactionSheet';

export function ContributionSheet({ goalId, editId }: { goalId: string; editId?: string }) {
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
      defaultAmount={suggested}
      savedMessage="Aporte registrado"
    />
  );
}

export function DebtPaymentSheet({ debtId, editId }: { debtId: string; editId?: string }) {
  const { data } = useStore();
  const debt = data.debts.find((d) => d.id === debtId);
  return (
    <MovementForm
      kind="pago_deuda"
      title={`${editId ? 'Editar pago a' : 'Pago a'} ${debt?.name ?? 'deuda'}`}
      link={{ debtId }}
      editId={editId}
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
  defaultAmount,
  savedMessage,
  withInterest,
}: {
  kind: 'ahorro' | 'pago_deuda';
  title: string;
  link: { goalId: string } | { debtId: string };
  editId?: string;
  defaultAmount: number;
  savedMessage: string;
  withInterest?: boolean;
}) {
  const { data, today, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const editing = data.transactions.find((t) => t.id === editId);
  const accounts = accountsFor(data, kind, editing?.accountId);

  const [amount, setAmount] = useState(editing?.amount ?? defaultAmount);
  const [interest, setInterest] = useState(editing?.interestPart ?? 0);
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? '');
  const [date, setDate] = useState(editing?.date ?? today);
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tx: Transaction = {
      id: editing?.id ?? crypto.randomUUID(),
      kind,
      date,
      amount,
      accountId,
      ...link,
      ...(withInterest && interest > 0 ? { interestPart: interest } : {}),
      ...(editing?.note ? { note: editing.note } : {}),
    };
    const problems = validateTransaction(tx, data);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    await actions.saveTransaction(tx);
    nav.closeSheet();
    toast(editing ? 'Cambios guardados' : savedMessage);
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
        <FormErrors errors={errors} />
        <button type="submit" className={s.btn}>
          {editing ? 'Guardar cambios' : 'Guardar'}
        </button>
        {editing && <DeleteMovement id={editing.id} />}
      </form>
    </Sheet>
  );
}
