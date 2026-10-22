import { useToast } from '../../components/Toast';
import { Card, ConfirmButton, Empty } from '../../components/ui';
import s from '../../components/ui.module.css';
import { describeSchedule, formatCOP } from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { accountName } from '../shared/describe';
import { recurringTitle } from '../shared/recurringText';
import a from './Ajustes.module.css';

/** Movimientos que se repiten: lista, pausar, editar y borrar (SPEC 6.8). */
export function Recurrings() {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const list = [...data.recurrings].sort((x, y) =>
    recurringTitle(data, x).localeCompare(recurringTitle(data, y), 'es'),
  );
  return (
    <Card title="Movimientos que se repiten" span2>
      {list.length ? (
        list.map((r) => (
          <div key={r.id} className={`${a.recurring} ${r.active ? '' : a.paused}`}>
            <button
              type="button"
              className={`${s.grow} ${a.recurringOpen}`}
              onClick={() => nav.openSheet({ type: 'recurring', id: r.id })}
              aria-label={`Editar ${recurringTitle(data, r)}`}
            >
              <b>{recurringTitle(data, r)}</b>
              <span className={s.sub}>
                {formatCOP(r.amount)} · {describeSchedule(r)} · {accountName(data, r.accountId)}
                {r.active ? '' : ' · En pausa'}
              </span>
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.ghost} ${s.sm}`}
              onClick={async () => {
                await actions.saveRecurring({ ...r, active: !r.active });
                toast(r.active ? 'En pausa: no aparecerá como pendiente.' : 'Reanudado');
              }}
            >
              {r.active ? 'Pausar' : 'Reanudar'}
            </button>
            <ConfirmButton
              className={`${s.btn} ${s.line} ${s.sm}`}
              label="Borrar"
              confirmLabel="¿Borrar?"
              onConfirm={async () => {
                await actions.deleteRecurring(r.id);
                toast('Borrado. Lo que ya registraste se conserva.');
              }}
            />
          </div>
        ))
      ) : (
        <Empty>
          Cuando registres algo con “Repetir cada mes”, aparecerá aquí y cada mes lo verás como
          pendiente.
        </Empty>
      )}
    </Card>
  );
}
