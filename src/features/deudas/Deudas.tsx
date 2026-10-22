import { monthLabel } from '../../components/format';
import { MoneyInput } from '../../components/MoneyInput';
import { useToast } from '../../components/Toast';
import { Card, Chip, ConfirmButton, Empty, Segmented } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  addMonths,
  debtBalance,
  formatCOP,
  monthlyInterest,
  paymentBelowInterest,
  priorityDebtId,
  simDebts,
  simulate,
  type Debt,
  type SimulationResult,
  type Strategy,
} from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import h from '../inicio/Hero.module.css';
import { ScreenTop } from '../shared/ScreenTop';
import d from './Deudas.module.css';

const STRATEGIES = [
  ['avalancha', 'Avalancha'],
  ['bola', 'Bola de nieve'],
] as const satisfies readonly (readonly [Strategy, string])[];

/** Deudas con plan bola de nieve / avalancha (SPEC 6.7). */
export function Deudas() {
  const { data, currentMonth, actions } = useStore();
  const nav = useNav();
  const { strategy, extraPayment } = data.settings;
  const debts = simDebts(data);
  const pending = debts.filter((x) => x.balance > 0.5);
  const sim = simulate(debts, strategy, extraPayment);
  const avalancha = simulate(debts, 'avalancha', extraPayment);
  const bola = simulate(debts, 'bola', extraPayment);
  const target = priorityDebtId(debts, strategy);
  const total = pending.reduce((sum, x) => sum + x.balance, 0);

  const active = data.debts
    .filter((x) => !x.archived)
    .sort((a, b) => {
      const pa = sim.paidMonth[a.id] ?? 9999;
      const pb = sim.paidMonth[b.id] ?? 9999;
      return pa - pb || debtBalance(a, data) - debtBalance(b, data);
    });

  return (
    <>
      <ScreenTop title="Deudas" />
      <section className={h.hero}>
        <div className={h.label}>Libre de deudas en</div>
        {!active.length ? (
          <>
            <div className={h.big}>—</div>
            <div className={h.foot}>
              <span>Registra tus deudas y la app arma el plan de pago.</span>
            </div>
          </>
        ) : !pending.length ? (
          <>
            <div className={h.big}>¡Ya estás libre!</div>
            <div className={h.foot}>
              <span>No tienes saldo pendiente.</span>
            </div>
          </>
        ) : !sim.finished ? (
          <>
            <div className={`${h.big} ${h.negative}`}>Sin fecha</div>
            <div className={h.foot}>
              <span>Con estos pagos las deudas no se terminan. Sube el abono extra.</span>
            </div>
          </>
        ) : (
          <>
            <div className={h.big}>{monthLabel(addMonths(currentMonth, sim.months!))}</div>
            <div className={h.meta}>
              <span>
                <b>{sim.months}</b> {sim.months === 1 ? 'mes' : 'meses'}
              </span>
              <span>
                Debes <b>{formatCOP(total)}</b>
              </span>
              <span>
                Intereses <b>{formatCOP(sim.interest)}</b>
              </span>
            </div>
          </>
        )}
      </section>

      <div className={`${s.grid} ${s.two} ${d.body}`}>
        {pending.length > 0 && (
          <Card title="Tu plan">
            <div className={s.form}>
              <div className={s.field}>
                Estrategia
                <Segmented
                  label="Estrategia"
                  options={STRATEGIES}
                  value={strategy}
                  onChange={(v) => void actions.updateSettings({ strategy: v })}
                />
              </div>
              <label htmlFor="f-extra">
                Abono extra al mes
                <MoneyInput
                  id="f-extra"
                  value={extraPayment}
                  onCommit={(v) => {
                    if (v !== extraPayment) void actions.updateSettings({ extraPayment: v });
                  }}
                />
              </label>
              <p className={s.hint}>
                Las tasas se piden como efectiva anual (EA), como las publica tu banco. La app la
                convierte a tasa mensual.
              </p>
            </div>
          </Card>
        )}
        {pending.length > 0 && <Comparison avalancha={avalancha} bola={bola} strategy={strategy} />}
        <div className={`${s.span2} ${s.row}`}>
          <h2 className={d.listTitle}>Mis deudas</h2>
          <button
            type="button"
            className={`${s.btn} ${s.sm}`}
            onClick={() => nav.openSheet({ type: 'debt' })}
          >
            Agregar deuda
          </button>
        </div>
        {active.length ? (
          active.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              paidMonth={sim.paidMonth[debt.id] ?? null}
              isTarget={debt.id === target}
            />
          ))
        ) : (
          <div className={s.span2}>
            <Empty>No tienes deudas registradas.</Empty>
          </div>
        )}
      </div>
    </>
  );
}

function Comparison({
  avalancha,
  bola,
  strategy,
}: {
  avalancha: SimulationResult;
  bola: SimulationResult;
  strategy: Strategy;
}) {
  const rows = [
    ['bola', 'Bola de nieve', bola],
    ['avalancha', 'Avalancha', avalancha],
  ] as const;
  const diff = bola.interest - avalancha.interest;
  return (
    <Card title="Bola de nieve o avalancha">
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Estrategia</th>
              <th>Libre en</th>
              <th>Intereses</th>
              <th>1ª deuda</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label, r]) => (
              <tr key={key} className={strategy === key ? s.selected : undefined}>
                <td>
                  {label}
                  {strategy === key && <span className="visually-hidden"> (elegida)</span>}
                </td>
                <td>{r.finished ? `${r.months} meses` : 'Sin fecha'}</td>
                <td>{formatCOP(r.interest)}</td>
                <td>{r.firstPaidMonth === null ? '—' : `mes ${r.firstPaidMonth}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.note}>
        {avalancha.finished && bola.finished && diff > 1000
          ? `Avalancha (primero la tasa más alta) te ahorra ${formatCOP(diff)} en intereses. Bola de nieve (primero el saldo más pequeño) libera la primera deuda antes y da más motivación.`
          : 'Con tus deudas actuales las dos estrategias cuestan casi lo mismo.'}
      </p>
    </Card>
  );
}

function DebtCard({
  debt,
  paidMonth,
  isTarget,
}: {
  debt: Debt;
  paidMonth: number | null;
  isTarget: boolean;
}) {
  const { data, currentMonth, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const balance = debtBalance(debt, data);
  const paid = balance <= 0;
  const isCard = debt.type === 'tarjeta_credito';
  const card = isCard ? data.accounts.find((a) => a.debtId === debt.id) : undefined;
  const sim = { id: debt.id, balance, rateEA: debt.rateEA, minPayment: debt.minPayment };
  const lowPayment = paymentBelowInterest(sim);
  const hasPayments = data.transactions.some(
    (t) => t.debtId === debt.id || (card && t.toAccountId === card.id),
  );
  const progress =
    !isCard && debt.openingBalance > 0
      ? ((debt.openingBalance - balance) / debt.openingBalance) * 100
      : null;

  function registerPayment() {
    // Las tarjetas se pagan con una transferencia hacia la tarjeta (Anexo D.1).
    if (card)
      nav.openSheet({
        type: 'tx',
        kind: 'transferencia',
        preset: { toAccountId: card.id, amount: debt.minPayment },
      });
    else nav.openSheet({ type: 'debtPay', debtId: debt.id });
  }

  return (
    <section className={s.card}>
      <div className={`${s.row} ${d.top}`}>
        <div>
          <h3>{debt.name}</h3>
          <div className={d.chips}>
            {paid ? (
              <Chip tone="ok">Pagada</Chip>
            ) : (
              isTarget && <Chip tone="warn">Abono extra aquí</Chip>
            )}
            <Chip>{String(debt.rateEA).replace('.', ',')}% EA</Chip>
            {isCard && <Chip>Tarjeta</Chip>}
          </div>
        </div>
        <div className={d.actions}>
          <button
            type="button"
            className={`${s.btn} ${s.ghost} ${s.sm}`}
            onClick={() => nav.openSheet({ type: 'debt', editId: debt.id })}
          >
            Editar
          </button>
          <ConfirmButton
            className={`${s.btn} ${s.line} ${s.sm}`}
            label="Quitar"
            confirmLabel={hasPayments ? '¿Archivar?' : '¿Eliminar?'}
            onConfirm={async () => {
              if (hasPayments || isCard) {
                await actions.saveDebt({ ...debt, archived: true });
                toast('Deuda archivada. Sus pagos se conservan.');
              } else {
                await actions.deleteDebtWithPayments(debt.id);
                toast('Deuda eliminada');
              }
            }}
          />
        </div>
      </div>
      <div className={d.amounts}>
        <span className={s.bigNumber}>{formatCOP(balance)}</span>
        <span className={s.sub}>Cuota mínima {formatCOP(debt.minPayment)}</span>
      </div>
      {progress !== null && (
        <div className={s.track}>
          <i
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: 'var(--c-deu)',
            }}
          />
        </div>
      )}
      {lowPayment && (
        <p className={`${s.chip} ${s.chipBad} ${s.chipWrap} ${d.warning}`}>
          La cuota no cubre ni los intereses del mes ({formatCOP(monthlyInterest(sim))}). La deuda
          no baja.
        </p>
      )}
      <div className={`${s.row} ${s.wrap} ${d.bottom}`}>
        <span className={s.sub}>
          {paid
            ? ''
            : paidMonth !== null
              ? `Se paga en ${monthLabel(addMonths(currentMonth, paidMonth)).toLowerCase()}`
              : 'Sin fecha de pago'}
        </span>
        {!paid && (
          <button type="button" className={`${s.btn} ${s.sm}`} onClick={registerPayment}>
            Registrar pago
          </button>
        )}
      </div>
    </section>
  );
}
