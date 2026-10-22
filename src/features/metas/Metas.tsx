import { monthLabel } from '../../components/format';
import { useToast } from '../../components/Toast';
import { Chip, ConfirmButton, Empty } from '../../components/ui';
import s from '../../components/ui.module.css';
import { formatCOP, goalProgress, goalSaved, type Goal } from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { ScreenTop } from '../shared/ScreenTop';
import g from './Metas.module.css';

/** Metas de ahorro (SPEC 6.6). */
export function Metas() {
  const { data } = useStore();
  const nav = useNav();
  const goals = data.goals.filter((x) => !x.archived);
  return (
    <>
      <ScreenTop title="Metas de ahorro" />
      <div className={`${s.row} ${g.intro}`}>
        <span className={s.sub}>Cada aporte sale de una de tus cuentas.</span>
        <button
          type="button"
          className={`${s.btn} ${s.sm}`}
          onClick={() => nav.openSheet({ type: 'goal' })}
        >
          Nueva meta
        </button>
      </div>
      {goals.length ? (
        <div className={`${s.grid} ${s.two}`}>
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      ) : (
        <Empty>
          Aún no tienes metas. Crea una con monto y fecha, y la app calcula cuánto aportar por mes.
        </Empty>
      )}
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { data, currentMonth, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const saved = goalSaved(goal, data.transactions);
  const p = goalProgress(goal, saved, currentMonth);
  const pct = Math.min(100, Math.round((saved / goal.target) * 100));
  const hasContributions = data.transactions.some((t) => t.goalId === goal.id);

  const chip =
    p.status === 'cumplida' ? (
      <Chip tone="ok">Meta cumplida</Chip>
    ) : p.status === 'vencida' ? (
      <Chip tone="bad">Fecha vencida</Chip>
    ) : (
      <Chip>
        {p.monthsLeft === 1 ? '1 mes' : `${p.monthsLeft} meses`} para{' '}
        {monthLabel(goal.deadline).toLowerCase()}
      </Chip>
    );

  return (
    <section className={s.card}>
      <div className={`${s.row} ${g.top}`}>
        <div>
          <h3>{goal.name}</h3>
          <div className={g.chip}>{chip}</div>
        </div>
        <div className={g.actions}>
          <button
            type="button"
            className={`${s.btn} ${s.ghost} ${s.sm}`}
            onClick={() => nav.openSheet({ type: 'goal', editId: goal.id })}
          >
            Editar
          </button>
          {/* Quitar: archiva si tiene aportes; si no, elimina (Anexo D.6). */}
          <ConfirmButton
            className={`${s.btn} ${s.line} ${s.sm}`}
            label="Quitar"
            confirmLabel={hasContributions ? '¿Archivar?' : '¿Eliminar?'}
            onConfirm={async () => {
              if (hasContributions) {
                await actions.saveGoal({ ...goal, archived: true });
                toast('Meta archivada. Sus aportes se conservan.');
              } else {
                await actions.deleteGoalWithContributions(goal.id);
                toast('Meta eliminada');
              }
            }}
          />
        </div>
      </div>
      <div className={g.amounts}>
        <span className={s.bigNumber}>{formatCOP(saved)}</span>
        <span className={s.sub}>
          de {formatCOP(goal.target)} · {pct}%
        </span>
      </div>
      <div className={`${s.track} ${g.track}`}>
        <i style={{ width: `${pct}%`, background: 'var(--c-aho)' }} />
      </div>
      <div className={`${s.row} ${s.wrap} ${g.bottom}`}>
        <div className={s.sub}>
          {p.status === 'cumplida' ? (
            'Ya llegaste.'
          ) : p.status === 'vencida' ? (
            <>Falta {formatCOP(p.remaining)}. Cambia la fecha para ver cuánto aportar.</>
          ) : (
            <>
              Falta {formatCOP(p.remaining)}. Aporta{' '}
              <b className={g.strong}>{formatCOP(p.suggested)}</b> al mes para llegar a tiempo.
            </>
          )}
        </div>
        <button
          type="button"
          className={`${s.btn} ${s.sm}`}
          onClick={() => nav.openSheet({ type: 'contrib', goalId: goal.id })}
        >
          Aportar
        </button>
      </div>
    </section>
  );
}
