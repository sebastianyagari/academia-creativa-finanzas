import { dayLabel, KIND, monthLabel } from '../../components/format';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmButton, Empty, MonthBar, Swatch } from '../../components/ui';
import s from '../../components/ui.module.css';
import { addMonths, formatCOP, monthOf, type Kind, type Transaction } from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { ScreenTop } from '../shared/ScreenTop';
import { transactionSubtitle, transactionTitle } from '../shared/describe';
import m from './Movimientos.module.css';
import { useState } from 'react';

type Filter = 'todos' | Kind;
const FILTERS: [Filter, string][] = [
  ['todos', 'Todos'],
  ['ingreso', 'Ingresos'],
  ['factura', 'Facturas'],
  ['gasto', 'Gastos'],
  ['ahorro', 'Ahorros'],
  ['pago_deuda', 'Deudas'],
  ['inversion', 'Inversiones'],
  ['transferencia', 'Transferencias'],
];

/** Lista por día del mes, con filtro por tipo (SPEC 6.4). Búsqueda y más filtros: Fase 3. */
export function Movimientos() {
  const { data } = useStore();
  const nav = useNav();
  const [filter, setFilter] = useState<Filter>('todos');

  const list = data.transactions
    .filter((t) => monthOf(t.date) === nav.month && (filter === 'todos' || t.kind === filter))
    .sort((a, b) => b.date.localeCompare(a.date));
  const days = new Map<string, Transaction[]>();
  for (const t of list) days.set(t.date, [...(days.get(t.date) ?? []), t]);

  return (
    <>
      <ScreenTop title="Movimientos" />
      <MonthBar
        label={monthLabel(nav.month)}
        onPrev={() => nav.setMonth(addMonths(nav.month, -1))}
        onNext={() => nav.setMonth(addMonths(nav.month, 1))}
      />
      <div className={s.chips} role="group" aria-label="Filtrar por tipo">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={s.filterChip}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        [...days].map(([date, txs]) => (
          <section key={date} aria-label={dayLabel(date)}>
            <h3 className={m.day}>{dayLabel(date)}</h3>
            {txs.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </section>
        ))
      ) : (
        <Empty>
          No hay movimientos en {monthLabel(nav.month).toLowerCase()}
          {filter !== 'todos' ? ' para este filtro' : ''}. Toca + para registrar uno.
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
