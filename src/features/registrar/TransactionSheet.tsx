import { useState, type FormEvent } from 'react';
import { KIND } from '../../components/format';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { ConfirmButton } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  categoriesOf,
  monthOf,
  validateTransaction,
  type Group,
  type Kind,
  type Transaction,
} from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { accountsFor, isCard } from '../shared/describe';

/** Tipos que se registran desde el botón + (SPEC 6.3). Ahorro y pago de deuda van desde Metas y Deudas. */
const KINDS = ['gasto', 'ingreso', 'factura', 'inversion', 'transferencia'] as const;
type SheetKind = (typeof KINDS)[number];

const GROUP: Record<Exclude<SheetKind, 'transferencia'>, Group> = {
  gasto: 'gastos',
  ingreso: 'ingresos',
  factura: 'facturas',
  inversion: 'inversiones',
};

/** Fecha por defecto: hoy si se está viendo el mes actual; si no, el día 1 del mes visto. */
function defaultDate(today: string, viewedMonth: string): string {
  return monthOf(today) === viewedMonth ? today : `${viewedMonth}-01`;
}

export function TransactionSheet({
  editId,
  kind: initialKind,
  preset,
}: {
  editId?: string;
  kind?: Kind;
  preset?: { categoryId?: string; amount?: number; toAccountId?: string };
}) {
  const { data, today, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const editing = data.transactions.find((t) => t.id === editId);

  const [kind, setKind] = useState<SheetKind>(
    (editing?.kind ?? initialKind ?? 'gasto') as SheetKind,
  );
  const [amount, setAmount] = useState(editing?.amount ?? preset?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? preset?.categoryId ?? '');
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? accountsFor(data, editing?.kind ?? initialKind ?? 'gasto')[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? preset?.toAccountId ?? '');
  const [date, setDate] = useState(editing?.date ?? defaultDate(today, nav.month));
  const [note, setNote] = useState(editing?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const isTransfer = kind === 'transferencia';
  const categories = isTransfer
    ? []
    : categoriesOf(data.categories, GROUP[kind]).filter(
        (c) => !c.archived || c.id === editing?.categoryId,
      );
  const origins = accountsFor(data, kind, editing?.accountId);
  const destinations = data.accounts.filter(
    (a) => (!a.archived || a.id === editing?.toAccountId) && a.id !== accountId,
  );

  function changeKind(next: SheetKind) {
    setKind(next);
    setCategoryId('');
    setErrors([]);
    const allowed = accountsFor(data, next);
    if (!allowed.some((a) => a.id === accountId)) setAccountId(allowed[0]?.id ?? '');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const tx: Transaction = {
      ...(editing?.fromRecurringId ? { fromRecurringId: editing.fromRecurringId } : {}),
      ...(editing?.scheduledDate ? { scheduledDate: editing.scheduledDate } : {}),
      id: editing?.id ?? crypto.randomUUID(),
      kind,
      date,
      amount,
      accountId,
      ...(isTransfer ? { toAccountId } : { categoryId }),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const problems = validateTransaction(tx, data);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    await actions.saveTransaction(tx);
    nav.setMonth(monthOf(date));
    nav.closeSheet();
    toast(editing ? 'Cambios guardados' : 'Guardado');
  }

  const title = editing ? 'Editar movimiento' : 'Registrar movimiento';
  return (
    <Sheet title={title} onClose={nav.closeSheet}>
      <form className={s.form} onSubmit={submit} noValidate>
        <div className={s.chips} role="group" aria-label="Tipo de movimiento">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={s.filterChip}
              aria-pressed={kind === k}
              onClick={() => changeKind(k)}
            >
              {KIND[k].label}
            </button>
          ))}
        </div>
        <label htmlFor="f-amount">
          Monto
          <MoneyInput id="f-amount" value={amount} onChange={setAmount} large />
        </label>
        {isTransfer ? (
          <div className={s.pair}>
            <label htmlFor="f-from">
              Sale de
              <select
                id="f-from"
                className={s.input}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {origins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="f-to">
              {isCard(data, toAccountId) ? 'Pago de tarjeta' : 'Entra a'}
              <select
                id="f-to"
                className={s.input}
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                <option value="">Elige la cuenta</option>
                {destinations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <label htmlFor="f-cat">
            Categoría
            <select
              id="f-cat"
              className={s.input}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Elige una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={s.pair}>
          {!isTransfer && (
            <label htmlFor="f-acc">
              {kind === 'ingreso' ? 'Entra a' : 'Sale de'}
              <select
                id="f-acc"
                className={s.input}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {origins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
        <label htmlFor="f-note">
          Nota (opcional)
          <input
            id="f-note"
            className={s.input}
            maxLength={60}
            value={note}
            placeholder="Ej. Almuerzo con el equipo"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <FormErrors errors={errors} />
        <button type="submit" className={s.btn}>
          {editing ? 'Guardar cambios' : 'Guardar'}
        </button>
        {editing && <DeleteMovement id={editing.id} />}
      </form>
    </Sheet>
  );
}

export function FormErrors({ errors }: { errors: string[] }) {
  return (
    <div className={s.error} role="alert">
      {errors.map((e) => (
        <div key={e}>{e}</div>
      ))}
    </div>
  );
}

/** "Eliminar movimiento" con confirmación en la misma hoja (SPEC 6.4). */
export function DeleteMovement({ id }: { id: string }) {
  const { actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  return (
    <ConfirmButton
      label="Eliminar movimiento"
      confirmLabel="¿Seguro? Toca para eliminar"
      onConfirm={async () => {
        await actions.deleteTransaction(id);
        nav.closeSheet();
        toast('Movimiento eliminado');
      }}
    />
  );
}
