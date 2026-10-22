import { useState, type FormEvent } from 'react';
import { KIND } from '../../components/format';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { ConfirmButton } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  categoriesOf,
  insertCategory,
  monthOf,
  repeatMonthly,
  suggestedCategoryId,
  validateTransaction,
  type Category,
  type Group,
  type Kind,
  type Transaction,
} from '../../engine';
import { useNav, type PendingRef } from '../../state/nav';
import { useStore } from '../../state/store';
import { accountsFor, isCard } from '../shared/describe';
import f from './Form.module.css';

/** Tipos que se registran desde el botón + (SPEC 6.3). Ahorro y pago de deuda van desde Metas y Deudas. */
const KINDS = ['gasto', 'ingreso', 'factura', 'inversion', 'transferencia'] as const;
type SheetKind = (typeof KINDS)[number];

const GROUP: Record<Exclude<SheetKind, 'transferencia'>, Group> = {
  gasto: 'gastos',
  ingreso: 'ingresos',
  factura: 'facturas',
  inversion: 'inversiones',
};

const NEW_CATEGORY = '__nueva__';

/** Fecha por defecto: hoy si se está viendo el mes actual; si no, el día 1 del mes visto. */
function defaultDate(today: string, viewedMonth: string): string {
  return monthOf(today) === viewedMonth ? today : `${viewedMonth}-01`;
}

export function TransactionSheet({
  editId,
  kind: initialKind,
  preset,
  pending,
}: {
  editId?: string;
  kind?: Kind;
  preset?: { categoryId?: string; amount?: number; toAccountId?: string };
  /** Registrar un pendiente con ajustes: se prellena con su plantilla. */
  pending?: PendingRef;
}) {
  const { data, today, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const editing = data.transactions.find((t) => t.id === editId);
  const template = pending ? data.recurrings.find((r) => r.id === pending.recurringId) : undefined;
  const base = editing ?? template;

  const startKind = (base?.kind ?? initialKind ?? 'gasto') as SheetKind;
  const [kind, setKind] = useState<SheetKind>(startKind);
  const [amount, setAmount] = useState(base?.amount ?? preset?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(
    base?.categoryId ?? preset?.categoryId ?? suggestedCategoryId(data, startKind) ?? '',
  );
  const [accountId, setAccountId] = useState(
    base?.accountId ?? accountsFor(data, startKind)[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(base?.toAccountId ?? preset?.toAccountId ?? '');
  const [date, setDate] = useState(
    editing?.date ?? pending?.scheduledDate ?? defaultDate(today, nav.month),
  );
  const [note, setNote] = useState(base?.note ?? '');
  const [repeat, setRepeat] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const isTransfer = kind === 'transferencia';
  const categories = isTransfer
    ? []
    : categoriesOf(data.categories, GROUP[kind]).filter(
        (c) => (!c.archived && !c.isSystem) || c.id === base?.categoryId,
      );
  const origins = accountsFor(data, kind, base?.accountId);
  const destinations = data.accounts.filter(
    (a) => (!a.archived || a.id === base?.toAccountId) && a.id !== accountId,
  );

  function changeKind(next: SheetKind) {
    setKind(next);
    setCategoryId(suggestedCategoryId(data, next) ?? '');
    setNewCategory(null);
    setErrors([]);
    const allowed = accountsFor(data, next);
    if (!allowed.some((a) => a.id === accountId)) setAccountId(allowed[0]?.id ?? '');
  }

  /** "+ Crear categoría" sin salir del registro (SPEC 6.3). Entra antes de "Otros". */
  async function createCategory() {
    const name = (newCategory ?? '').trim();
    if (isTransfer || !name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      setNewCategory(null);
      return;
    }
    const created: Category = {
      id: crypto.randomUUID(),
      group: GROUP[kind],
      name,
      budget: 0,
      isOther: false,
      isSystem: false,
      archived: false,
      order: 0,
    };
    await actions.saveCategories(insertCategory(data.categories, created));
    setCategoryId(created.id);
    setNewCategory(null);
    toast('Categoría creada');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Un movimiento editado conserva su enlace; uno desde un pendiente lo crea.
    const link: { fromRecurringId?: string; scheduledDate?: string } =
      editing ??
      (pending
        ? { fromRecurringId: pending.recurringId, scheduledDate: pending.scheduledDate }
        : {});
    let tx: Transaction = {
      ...(link.fromRecurringId ? { fromRecurringId: link.fromRecurringId } : {}),
      ...(link.scheduledDate ? { scheduledDate: link.scheduledDate } : {}),
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
    if (repeat) {
      const linked = repeatMonthly(tx, crypto.randomUUID());
      tx = linked.transaction;
      await actions.saveTransaction(tx, linked.recurring);
    } else {
      await actions.saveTransaction(tx);
    }
    nav.setMonth(monthOf(date));
    nav.closeSheet();
    toast(editing ? 'Cambios guardados' : repeat ? 'Guardado. Se repetirá cada mes.' : 'Guardado');
  }

  const title = editing
    ? 'Editar movimiento'
    : pending
      ? 'Registrar pendiente'
      : 'Registrar movimiento';
  return (
    <Sheet title={title} onClose={nav.closeSheet}>
      <form className={s.form} onSubmit={submit} noValidate>
        {!pending && (
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
        )}
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
        ) : newCategory !== null ? (
          <div className={s.field}>
            <label htmlFor="f-newcat">Nueva categoría de {GROUP[kind]}</label>
            <div className={f.inline}>
              <input
                id="f-newcat"
                className={s.input}
                maxLength={40}
                value={newCategory}
                placeholder="Ej. Gimnasio"
                autoFocus
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void createCategory();
                  }
                }}
              />
              <button
                type="button"
                className={`${s.btn} ${s.sm}`}
                onClick={() => void createCategory()}
              >
                Crear
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.line} ${s.sm}`}
                onClick={() => setNewCategory(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor="f-cat">
            Categoría
            <select
              id="f-cat"
              className={s.input}
              value={categoryId}
              onChange={(e) => {
                if (e.target.value === NEW_CATEGORY) setNewCategory('');
                else setCategoryId(e.target.value);
              }}
            >
              <option value="">Elige una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Crear categoría</option>
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

/** Interruptor "Repetir cada mes" (SPEC 5.4): crea la plantilla, nunca anota sola. */
export function RepeatToggle({
  checked,
  onChange,
  date,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  date: string;
}) {
  return (
    <label className={f.switchRow}>
      <input
        type="checkbox"
        role="switch"
        className={f.switch}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <b>Repetir cada mes</b>
        <span className={s.hint}>
          {checked
            ? `Cada mes, el día ${Number(date.slice(8)) || '…'}, lo verás como pendiente para registrarlo con un toque.`
            : 'Para arriendo, servicios, nómina y todo lo que se repite.'}
        </span>
      </span>
    </label>
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
