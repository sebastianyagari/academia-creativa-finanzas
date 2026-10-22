import { useState, type FormEvent } from 'react';
import { MONTHS } from '../../components/format';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import s from '../../components/ui.module.css';
import { APPROX_LABEL, type Recurring, type Schedule } from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { FormErrors } from '../registrar/TransactionSheet';
import { accountsFor } from '../shared/describe';
import { recurringTitle } from '../shared/recurringText';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function DaySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (d: number) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <select
        id={id}
        className={s.input}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d === 31 ? 'Último día del mes' : `Día ${d}`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Editar un movimiento que se repite: monto, cuenta, días y nota. */
export function RecurringSheet({ id }: { id: string }) {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const recurring = data.recurrings.find((r) => r.id === id);
  const [amount, setAmount] = useState(recurring?.amount ?? 0);
  const [accountId, setAccountId] = useState(recurring?.accountId ?? '');
  const [schedule, setSchedule] = useState<Schedule>(
    recurring?.schedule ?? { type: 'mensual', day: 1 },
  );
  const [note, setNote] = useState(recurring?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  if (!recurring) return null;

  // Prima y cesantías son montos sugeridos por la app (SPEC 7.2).
  const categoryName = data.categories.find((c) => c.id === recurring.categoryId)?.name;
  const isLegalEstimate =
    categoryName === 'Prima de servicios' || categoryName === 'Cesantías e intereses';
  const accounts = accountsFor(data, recurring.kind, recurring.accountId).filter(
    (a) => a.id !== recurring.toAccountId,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      setErrors(['Escribe un monto mayor a 0.']);
      return;
    }
    const { note: _note, ...rest } = recurring!;
    const updated: Recurring = {
      ...rest,
      amount,
      accountId,
      schedule,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    await actions.saveRecurring(updated);
    nav.closeSheet();
    toast('Cambios guardados. Aplican a los próximos pendientes.');
  }

  return (
    <Sheet title={recurringTitle(data, recurring)} onClose={nav.closeSheet}>
      <form className={s.form} onSubmit={submit} noValidate>
        <label htmlFor="f-amount">
          Monto
          <MoneyInput id="f-amount" value={amount} onChange={setAmount} large />
        </label>
        <label htmlFor="f-acc">
          {recurring.kind === 'ingreso' ? 'Entra a' : 'Sale de'}
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
        {schedule.type === 'mensual' && (
          <DaySelect
            id="f-day"
            label="Cada mes, el"
            value={schedule.day}
            onChange={(day) => setSchedule({ type: 'mensual', day })}
          />
        )}
        {schedule.type === 'quincenal' && (
          <div className={s.pair}>
            <DaySelect
              id="f-day1"
              label="Primera quincena"
              value={schedule.days[0]}
              onChange={(d) => setSchedule({ type: 'quincenal', days: [d, schedule.days[1]] })}
            />
            <DaySelect
              id="f-day2"
              label="Segunda quincena"
              value={schedule.days[1]}
              onChange={(d) => setSchedule({ type: 'quincenal', days: [schedule.days[0], d] })}
            />
          </div>
        )}
        {schedule.type === 'anual' && (
          <div className={s.pair}>
            <label htmlFor="f-month">
              Cada año, en
              <select
                id="f-month"
                className={s.input}
                value={schedule.month}
                onChange={(e) => setSchedule({ ...schedule, month: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <DaySelect
              id="f-day"
              label="El día"
              value={schedule.day}
              onChange={(day) => setSchedule({ ...schedule, day })}
            />
          </div>
        )}
        <label htmlFor="f-note">
          Nota (opcional)
          <input
            id="f-note"
            className={s.input}
            maxLength={60}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className={s.hint}>
          Los cambios aplican a los próximos pendientes; lo ya registrado no cambia.
        </p>
        {isLegalEstimate && <p className={s.hint}>{APPROX_LABEL}</p>}
        <FormErrors errors={errors} />
        <button type="submit" className={s.btn}>
          Guardar cambios
        </button>
      </form>
    </Sheet>
  );
}
