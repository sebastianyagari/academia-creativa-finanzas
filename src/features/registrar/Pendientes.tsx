import { dayLabel, KIND } from '../../components/format';
import { newId } from '../../engine/id';
import { useToast } from '../../components/Toast';
import { Card, Chip, Swatch } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  formatCOP,
  pendingFor,
  skipFor,
  transactionFromPending,
  validateTransaction,
  type Pending,
} from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { accountName } from '../shared/describe';
import { recurringTitle } from '../shared/recurringText';
import f from './Form.module.css';

/**
 * "Pendientes del mes" (SPEC 5.4): movimientos que se repiten y aún no se han
 * registrado. Nada se anota solo: "Registrar" lo hace con un toque; tocar el
 * nombre permite ajustar monto o fecha antes.
 */
export function Pendientes({ month, span2 }: { month: string; span2?: boolean }) {
  const { data } = useStore();
  if (!data.recurrings.some((r) => r.active)) return null;
  const list = pendingFor(data, month);
  return (
    <Card title="Pendientes del mes" span2={span2}>
      {list.length ? (
        list.map((p) => <PendingRow key={`${p.recurringId}|${p.scheduledDate}`} pending={p} />)
      ) : (
        <Chip tone="ok">Todo al día este mes</Chip>
      )}
    </Card>
  );
}

function PendingRow({ pending: p }: { pending: Pending }) {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const r = p.recurring;
  const title = recurringTitle(data, r);
  const ref = { recurringId: p.recurringId, scheduledDate: p.scheduledDate };

  function adjust() {
    if (r.kind === 'ahorro' && r.goalId)
      nav.openSheet({ type: 'contrib', goalId: r.goalId, pending: ref });
    else if (r.kind === 'pago_deuda' && r.debtId)
      nav.openSheet({ type: 'debtPay', debtId: r.debtId, pending: ref });
    else nav.openSheet({ type: 'tx', pending: ref });
  }

  async function register() {
    const tx = transactionFromPending(p, newId());
    // Si algo ya no es válido (p. ej. la cuenta se archivó), se abre el formulario para corregir.
    if (validateTransaction(tx, data).length) {
      adjust();
      return;
    }
    await actions.saveTransaction(tx);
    toast(`${title} registrado`);
  }

  return (
    <div className={f.pendingRow}>
      <button
        type="button"
        className={f.pendingOpen}
        onClick={adjust}
        aria-label={`Ajustar y registrar ${title}`}
      >
        <Swatch color={KIND[r.kind].color} />
        <span>
          <b>{title}</b>
          <span className={s.sub}>
            {formatCOP(r.amount)} · {dayLabel(p.scheduledDate)} · {accountName(data, r.accountId)}
          </span>
        </span>
      </button>
      <div className={f.pendingActions}>
        <button
          type="button"
          className={`${s.btn} ${s.line} ${s.sm}`}
          aria-label={`Omitir ${title} este mes`}
          onClick={async () => {
            await actions.skipPending(skipFor(p));
            toast('Omitido este mes');
          }}
        >
          Omitir
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.sm}`}
          aria-label={`Registrar ${title}`}
          onClick={() => void register()}
        >
          Registrar
        </button>
      </div>
    </div>
  );
}
