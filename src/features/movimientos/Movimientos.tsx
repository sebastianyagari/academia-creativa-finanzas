import { useState } from 'react';
import { dayLabel, GROUP_LABEL, KIND, monthLabel } from '../../components/format';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { useToast } from '../../components/Toast';
import { ConfirmButton, Empty, MonthBar, Segmented, Swatch } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  addMonths,
  categoriesOf,
  filterTransactions,
  formatCOP,
  monthRange,
  type Group,
  type Kind,
  type Transaction,
  type TransactionFilter,
} from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { Pendientes } from '../registrar/Pendientes';
import { ScreenTop } from '../shared/ScreenTop';
import { transactionSubtitle, transactionTitle } from '../shared/describe';
import m from './Movimientos.module.css';

type KindFilter = 'todos' | Kind;
const KIND_FILTERS: [KindFilter, string][] = [
  ['todos', 'Todos'],
  ['ingreso', 'Ingresos'],
  ['factura', 'Facturas'],
  ['gasto', 'Gastos'],
  ['ahorro', 'Ahorros'],
  ['pago_deuda', 'Deudas'],
  ['inversion', 'Inversiones'],
  ['transferencia', 'Transferencias'],
];

type Scope = 'mes' | 'todo';
const SCOPES = [
  ['mes', 'Este mes'],
  ['todo', 'Todo el historial'],
] as const satisfies readonly (readonly [Scope, string])[];

const GROUPS: Group[] = ['ingresos', 'facturas', 'gastos', 'inversiones'];

/** Movimientos por día con búsqueda y filtros (SPEC 6.4). */
export function Movimientos() {
  const { data } = useStore();
  const nav = useNav();
  const [kind, setKind] = useState<KindFilter>('todos');
  const [text, setText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [scope, setScope] = useState<Scope>('mes');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(0);

  const extraFilters = [accountId, categoryId, min, max].filter(Boolean).length;
  const filter: TransactionFilter = {
    ...(scope === 'mes' ? { range: monthRange(nav.month) } : {}),
    ...(kind !== 'todos' ? { kind } : {}),
    ...(text.trim() ? { text } : {}),
    ...(accountId ? { accountId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
  };
  const list = filterTransactions(data, filter);
  const searching = Boolean(text.trim()) || extraFilters > 0 || kind !== 'todos';
  const days = new Map<string, Transaction[]>();
  for (const t of list) days.set(t.date, [...(days.get(t.date) ?? []), t]);

  function clear() {
    setText('');
    setKind('todos');
    setAccountId('');
    setCategoryId('');
    setMin(0);
    setMax(0);
    setScope('mes');
  }

  return (
    <>
      <ScreenTop title="Movimientos" />
      {scope === 'mes' && (
        <MonthBar
          label={monthLabel(nav.month)}
          onPrev={() => nav.setMonth(addMonths(nav.month, -1))}
          onNext={() => nav.setMonth(addMonths(nav.month, 1))}
        />
      )}
      <div className={m.searchRow}>
        <label className={m.search}>
          <Icon name="search" size={18} />
          <input
            type="search"
            className={m.searchInput}
            placeholder="Buscar por nota, categoría o cuenta"
            aria-label="Buscar movimientos"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={`${s.btn} ${showFilters || extraFilters ? '' : s.ghost} ${s.sm}`}
          aria-expanded={showFilters}
          aria-controls="filtros"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros{extraFilters ? ` (${extraFilters})` : ''}
        </button>
      </div>
      {showFilters && (
        <section id="filtros" className={`${s.card} ${m.filters}`} aria-label="Filtros">
          <Segmented label="Dónde buscar" options={SCOPES} value={scope} onChange={setScope} />
          <div className={s.form}>
            <div className={s.pair}>
              <label htmlFor="fl-acc">
                Cuenta
                <select
                  id="fl-acc"
                  className={s.input}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.archived ? ' (archivada)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="fl-cat">
                Categoría
                <select
                  id="fl-cat"
                  className={s.input}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={GROUP_LABEL[g]}>
                      {categoriesOf(data.categories, g).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <div className={s.pair}>
              <label htmlFor="fl-min">
                Monto desde
                <MoneyInput id="fl-min" value={min} onChange={setMin} />
              </label>
              <label htmlFor="fl-max">
                Monto hasta
                <MoneyInput id="fl-max" value={max} onChange={setMax} />
              </label>
            </div>
            <button type="button" className={`${s.btn} ${s.line} ${s.sm}`} onClick={clear}>
              Limpiar filtros
            </button>
          </div>
        </section>
      )}
      <div className={s.chips} role="group" aria-label="Filtrar por tipo">
        {KIND_FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={s.filterChip}
            aria-pressed={kind === key}
            onClick={() => setKind(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {scope === 'mes' && !searching && (
        <div className={m.pending}>
          <Pendientes month={nav.month} />
        </div>
      )}
      {searching && (
        <p className={s.hint} aria-live="polite">
          {list.length === 1 ? '1 movimiento' : `${list.length} movimientos`}
          {scope === 'todo'
            ? ' en todo el historial'
            : ` en ${monthLabel(nav.month).toLowerCase()}`}
        </p>
      )}
      {list.length ? (
        [...days].map(([date, txs]) => {
          const label =
            scope === 'todo' ? `${dayLabel(date)} de ${date.slice(0, 4)}` : dayLabel(date);
          return (
            <section key={date} aria-label={label}>
              <h3 className={m.day}>{label}</h3>
              {txs.map((t) => (
                <Row key={t.id} t={t} />
              ))}
            </section>
          );
        })
      ) : searching ? (
        <Empty>
          Nada coincide con tu búsqueda.{' '}
          <button type="button" className={m.linkButton} onClick={clear}>
            Limpiar filtros
          </button>
        </Empty>
      ) : (
        <Empty>
          No hay movimientos en {monthLabel(nav.month).toLowerCase()}. Toca + para registrar uno.
        </Empty>
      )}
    </>
  );
}

function Row({ t }: { t: Transaction }) {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const title = transactionTitle(data, t);
  const open = () => {
    if (t.kind === 'ahorro') nav.openSheet({ type: 'contrib', goalId: t.goalId!, editId: t.id });
    else if (t.kind === 'pago_deuda')
      nav.openSheet({ type: 'debtPay', debtId: t.debtId!, editId: t.id });
    else nav.openSheet({ type: 'tx', editId: t.id });
  };
  const sign = t.kind === 'ingreso' ? '+' : t.kind === 'transferencia' ? '' : '-';
  return (
    <div className={m.tx}>
      <button
        type="button"
        className={m.open}
        onClick={open}
        aria-label={`Editar ${title}, ${formatCOP(t.amount)}`}
      >
        <Swatch color={KIND[t.kind].color} />
        <span className={m.name}>
          <b>{title}</b>
          <span>{transactionSubtitle(data, t)}</span>
        </span>
        <span className={`${m.amount} ${t.kind === 'ingreso' ? m.in : ''}`}>
          {sign}
          {formatCOP(t.amount)}
        </span>
      </button>
      <ConfirmButton
        className={s.iconBtn}
        ariaLabel={`Eliminar ${title}`}
        label={<Icon name="trash" size={18} />}
        confirmLabel="¿Eliminar?"
        onConfirm={async () => {
          await actions.deleteTransaction(t.id);
          toast('Movimiento eliminado');
        }}
      />
    </div>
  );
}
