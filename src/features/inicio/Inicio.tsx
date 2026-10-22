import { Bars, Donut, type MonthBars } from '../../components/Charts';
import { CUBE, monthLabel, OUT_CUBES, rangeLabel, type Cube } from '../../components/format';
import { Icon } from '../../components/Icon';
import {
  Card,
  Chip,
  Empty,
  Money,
  MonthBar,
  ProgressBar,
  Segmented,
  Swatch,
} from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  accountBalance,
  addMonths,
  backupReminder,
  budgetSummary,
  cardDebt,
  categoriesOf,
  categoryActuals,
  dayOf,
  firstSteps,
  formatCOP,
  goalSaved,
  monthRange,
  quincenaRange,
  monthsElapsed,
  netWorth,
  periodMonths,
  periodStep,
  rangeOfMonths,
  scaleBudgets,
  simDebts,
  simulate,
  spendingCheck,
  totalsByMonth,
  totalsFor,
  type AppData,
  type FirstStep,
  type GroupBudgets,
  type PeriodKind,
  type Totals,
} from '../../engine';
import { useNav, type QuincenaView } from '../../state/nav';
import { useStore } from '../../state/store';
import { Pendientes } from '../registrar/Pendientes';
import { ScreenTop } from '../shared/ScreenTop';
import f from './FirstSteps.module.css';
import h from './Hero.module.css';

const PERIODS = [
  ['mes', 'Mes'],
  ['6m', '6 meses'],
  ['anio', 'Año'],
] as const satisfies readonly (readonly [PeriodKind, string])[];

/** Modo quincenal (SPEC 5.5): solo cambia lo que se muestra, no los datos. */
const QUINCENAS = [
  ['0', 'Mes completo'],
  ['1', 'Quincena 1'],
  ['2', 'Quincena 2'],
] as const;

/** ¿Se ve la tarjeta de Primeros pasos? (ya incluye "Haz tu respaldo"). */
function showsFirstSteps(data: AppData): boolean {
  return (
    data.profile.onboardingDone &&
    !data.settings.isDemo &&
    !data.profile.firstStepsDismissed &&
    !firstSteps(data).every((st) => st.done)
  );
}

/** Aviso "Haz tu respaldo" (SPEC 9.1): 30 días sin respaldo, o nunca con movimientos. */
function BackupBanner() {
  const { data, today } = useStore();
  const nav = useNav();
  const reminder = backupReminder(data, today);
  if (data.settings.isDemo || !reminder.show || showsFirstSteps(data)) return null;
  return (
    <div className={s.banner} role="status">
      <span>
        <b>Haz tu respaldo.</b>{' '}
        {reminder.daysSince === null
          ? 'Aún no tienes uno.'
          : `Hace ${reminder.daysSince} días que no lo haces.`}
      </span>
      <button type="button" className={`${s.btn} ${s.sm}`} onClick={() => nav.setScreen('ajustes')}>
        Respaldar
      </button>
    </div>
  );
}

/** Tarjeta "Primeros pasos" (SPEC 6.1): desaparece al completarse o al ocultarla. */
function FirstSteps() {
  const { data, actions } = useStore();
  const nav = useNav();
  if (!showsFirstSteps(data)) return null;
  const steps = firstSteps(data);
  const go: Record<FirstStep['id'], () => void> = {
    'primer-gasto': () => nav.openSheet({ type: 'tx', kind: 'gasto' }),
    presupuesto: () => nav.setScreen('presupuesto'),
    repetido: () => nav.openSheet({ type: 'tx', kind: 'factura' }),
    respaldo: () => nav.setScreen('ajustes'),
  };
  const done = steps.filter((st) => st.done).length;
  return (
    <section className={`${s.card} ${f.firstSteps}`} aria-label="Primeros pasos">
      <div className={s.cardHead}>
        <h2>Primeros pasos</h2>
        <span className={s.sub}>
          {done} de {steps.length}
        </span>
      </div>
      <ol className={f.steps}>
        {steps.map((st) => (
          <li key={st.id} className={st.done ? f.done : ''}>
            <span className={f.mark} aria-hidden="true">
              {st.done ? '✓' : ''}
            </span>
            <span className={`${s.grow} ${f.text}`}>
              {st.label}
              {st.done && <span className="visually-hidden"> (hecho)</span>}
              {st.id === 'repetido' && !st.done && (
                <span className={s.hint}>
                  Registra el arriendo o un servicio con “Repetir cada mes”.
                </span>
              )}
            </span>
            {!st.done && (
              <button type="button" className={`${s.btn} ${s.ghost} ${s.sm}`} onClick={go[st.id]}>
                Ir
              </button>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={f.hide}
        onClick={() => void actions.updateProfile({ firstStepsDismissed: true })}
      >
        Ocultar primeros pasos
      </button>
    </section>
  );
}

export function Inicio() {
  const { data } = useStore();
  const nav = useNav();
  const months = periodMonths(nav.period, nav.month);
  const step = periodStep(nav.period);
  return (
    <>
      <ScreenTop title={data.profile.name ? `Hola, ${data.profile.name}` : 'Mis finanzas'} />
      <BackupBanner />
      <FirstSteps />
      <Segmented label="Período" options={PERIODS} value={nav.period} onChange={nav.setPeriod} />
      <MonthBar
        label={
          nav.period === 'mes'
            ? monthLabel(nav.month)
            : nav.period === 'anio'
              ? nav.month.slice(0, 4)
              : rangeLabel(months)
        }
        onPrev={() => nav.setMonth(addMonths(nav.month, -step))}
        onNext={() => nav.setMonth(addMonths(nav.month, step))}
      />
      {nav.period === 'mes' && data.profile.payFrequency === 'quincenal' && (
        <Segmented
          label="Quincena"
          options={QUINCENAS}
          value={String(nav.quincena) as '0' | '1' | '2'}
          onChange={(v) => nav.setQuincena(Number(v) as QuincenaView)}
        />
      )}
      {nav.period === 'mes' ? <MonthView /> : <PeriodView months={months} />}
    </>
  );
}

function barsFor(data: AppData, months: string[]): MonthBars[] {
  return [...totalsByMonth(data.transactions, months)].map(([month, t]) => ({
    month,
    in: t.ingresos,
    out: t.salidas,
  }));
}

function donutSlices(t: Totals) {
  return OUT_CUBES.map((k) => ({ label: CUBE[k].label, value: t[k], color: CUBE[k].color }));
}

function BudgetVsActual({
  totals,
  budgets,
  note,
}: {
  totals: Totals;
  budgets: GroupBudgets;
  note?: string;
}) {
  const rows = (['ingresos', ...OUT_CUBES] as Cube[]).filter((k) => budgets[k] || totals[k]);
  return (
    <Card title="Presupuesto contra real">
      {rows.length ? (
        rows.map((k) => (
          <ProgressBar
            key={k}
            label={
              <>
                <Swatch color={CUBE[k].color} /> {CUBE[k].label}
              </>
            }
            value={totals[k]}
            total={budgets[k] || totals[k]}
            right={`${formatCOP(totals[k])} de ${formatCOP(budgets[k])}`}
            color={CUBE[k].color}
            over={k !== 'ingresos' && budgets[k] > 0 && totals[k] > budgets[k]}
          />
        ))
      ) : (
        <Empty>Define tu presupuesto en la pestaña Presupuesto para comparar.</Empty>
      )}
      {note && <p className={s.note}>{note}</p>}
    </Card>
  );
}

function MonthView() {
  const { data, currentMonth } = useStore();
  const nav = useNav();
  const m = nav.month;
  // Quincena: lo real de la quincena contra el presupuesto mensual (SPEC 5.5).
  const q = data.profile.payFrequency === 'quincenal' ? nav.quincena : 0;
  const range = q ? quincenaRange(m, q) : monthRange(m);
  const totals = totalsFor(data.transactions, range);
  const { budgets, unassigned } = budgetSummary(data, currentMonth);
  const check = spendingCheck(totals, budgets);
  const where = q
    ? `la quincena ${q} de ${monthLabel(m).toLowerCase()}`
    : monthLabel(m).toLowerCase();

  const hero = (
    <section className={h.hero}>
      <div className={h.label}>Te queda en {where}</div>
      <div className={`${h.big} ${totals.balance < 0 ? h.negative : ''}`}>
        {formatCOP(totals.balance)}
      </div>
      <div className={h.meta}>
        <span>
          Entró <b>{formatCOP(totals.ingresos)}</b>
        </span>
        <span>
          Salió <b>{formatCOP(totals.salidas)}</b>
        </span>
      </div>
      {check.budget > 0 ? (
        <>
          <div className={`${h.bar} ${check.exceeded ? h.over : ''}`}>
            <i style={{ width: `${Math.min(100, check.percent)}%` }} />
          </div>
          <div className={h.foot}>
            <span>
              Facturas y gastos: {formatCOP(check.spent)} de {formatCOP(check.budget)} (
              {check.percent}%)
            </span>
            {check.exceeded ? (
              <span className={h.alert}>
                <Icon name="alert" size={16} />
                Excediste tu presupuesto
              </span>
            ) : (
              <span>Quedan {formatCOP(check.budget - check.spent)}</span>
            )}
          </div>
        </>
      ) : (
        <div className={h.foot}>
          <span>Define tu presupuesto en la pestaña Presupuesto para ver tu avance.</span>
        </div>
      )}
      {budgets.ingresos > 0 && (
        <div className={`${h.foot} ${h.divider}`}>
          <span>
            {unassigned >= 0 ? 'Sin asignar del presupuesto' : 'Te pasaste al presupuestar'}
          </span>
          <b>{formatCOP(Math.abs(unassigned))}</b>
        </div>
      )}
    </section>
  );

  return (
    <div className={`${s.grid} ${s.two}`}>
      <div className={s.span2}>{hero}</div>
      {/* Inicio muestra solo los pendientes del mes actual (Anexo D.10). */}
      {m === currentMonth && <Pendientes month={m} span2 />}
      <Bills month={m} quincena={q} />
      <Card title="A dónde va mi dinero">
        <Donut slices={donutSlices(totals)} />
      </Card>
      <BudgetVsActual totals={totals} budgets={budgets} />
      <Accounts />
      <GoalsSummary />
      <DebtsSummary />
      <Card title="Últimos 6 meses" span2>
        <Bars data={barsFor(data, periodMonths('6m', m))} />
      </Card>
    </div>
  );
}

/** Facturas del mes con su estado (SPEC 6.2). */
function Bills({ month: m, quincena }: { month: string; quincena: QuincenaView }) {
  const { data, today, currentMonth } = useStore();
  const nav = useNav();
  const actuals = categoryActuals(data.transactions, monthRange(m));
  const bills = categoriesOf(data.categories, 'facturas')
    .filter((c) => c.dueDay && !c.archived)
    // Cada factura va a la quincena de su día de vencimiento (SPEC 5.5).
    .filter((c) => !quincena || (quincena === 1 ? c.dueDay! <= 15 : c.dueDay! > 15))
    .sort((a, b) => a.dueDay! - b.dueDay!);
  const day = dayOf(today);
  return (
    <Card title="Facturas del mes">
      {bills.length ? (
        bills.map((c) => {
          const paid = (actuals.get(c.id) ?? 0) > 0;
          const diff = c.dueDay! - day;
          let chip;
          if (paid) chip = <Chip tone="ok">Pagada</Chip>;
          else if (m < currentMonth) chip = <Chip tone="bad">Sin pagar</Chip>;
          else if (m > currentMonth || diff > 5) chip = <Chip>Día {c.dueDay}</Chip>;
          else if (diff < 0)
            chip = <Chip tone="bad">Vencida hace {-diff === 1 ? '1 día' : `${-diff} días`}</Chip>;
          else if (diff === 0) chip = <Chip tone="warn">Vence hoy</Chip>;
          else chip = <Chip tone="warn">Vence en {diff === 1 ? '1 día' : `${diff} días`}</Chip>;
          return (
            <div className={s.listRow} key={c.id}>
              <Swatch color="var(--c-fac)" />
              <div className={s.grow}>
                <b>{c.name}</b>
                <span className={s.sub}>{c.budget ? formatCOP(c.budget) : 'Sin monto'}</span>
              </div>
              {chip}
              {!paid && (
                <button
                  type="button"
                  className={`${s.btn} ${s.ghost} ${s.sm}`}
                  onClick={() =>
                    nav.openSheet({
                      type: 'tx',
                      kind: 'factura',
                      preset: { categoryId: c.id, amount: c.budget },
                    })
                  }
                >
                  Pagar
                </button>
              )}
            </div>
          );
        })
      ) : (
        <Empty>
          Agrega el día de vencimiento a tus facturas en Presupuesto y aquí verás cuáles vencen
          pronto.
        </Empty>
      )}
    </Card>
  );
}

function Accounts() {
  const { data } = useStore();
  const nw = netWorth(data);
  const accounts = data.accounts.filter((a) => !a.archived);
  const cards = accounts.filter((a) => a.type === 'tarjeta_credito');
  const cardTotal = cards.reduce((sum, a) => sum + cardDebt(a, data.transactions), 0);
  const loans = nw.liabilities - cardTotal;
  return (
    <Card title="Cuentas y patrimonio">
      {accounts.map((a) => {
        const card = a.type === 'tarjeta_credito';
        const value = card ? -cardDebt(a, data.transactions) : accountBalance(a, data.transactions);
        return (
          <div className={s.listRow} key={a.id}>
            <span className={s.grow}>
              {a.name}
              {card && <span className={s.sub}> · tarjeta</span>}
            </span>
            <b className={s.money} style={card && value < 0 ? { color: 'var(--bad)' } : undefined}>
              {formatCOP(value)}
            </b>
          </div>
        );
      })}
      {loans > 0 && (
        <div className={s.listRow}>
          <span className={s.grow}>Créditos y préstamos</span>
          <b className={s.money} style={{ color: 'var(--bad)' }}>
            {formatCOP(-loans)}
          </b>
        </div>
      )}
      <div className={`${s.sumRow} ${s.total}`}>
        <span>Patrimonio neto</span>
        <Money value={nw.netWorth} />
      </div>
    </Card>
  );
}

function GoalsSummary() {
  const { data } = useStore();
  const nav = useNav();
  const goals = data.goals.filter((g) => !g.archived).slice(0, 3);
  return (
    <Card
      title="Metas"
      action={
        <button
          type="button"
          className={`${s.btn} ${s.ghost} ${s.sm}`}
          onClick={() => nav.setScreen('metas')}
        >
          Ver
        </button>
      }
    >
      {goals.length ? (
        goals.map((g) => {
          const saved = goalSaved(g, data.transactions);
          return (
            <ProgressBar
              key={g.id}
              label={g.name}
              value={saved}
              total={g.target}
              right={`${formatCOP(saved)} / ${formatCOP(g.target)}`}
              color="var(--c-aho)"
            />
          );
        })
      ) : (
        <Empty>Crea tu primera meta de ahorro.</Empty>
      )}
    </Card>
  );
}

function DebtsSummary() {
  const { data, currentMonth } = useStore();
  const nav = useNav();
  const debts = simDebts(data);
  const sim = simulate(debts, data.settings.strategy, data.settings.extraPayment);
  const pending = debts.some((d) => d.balance > 0.5);
  return (
    <Card
      title="Deudas"
      action={
        <button
          type="button"
          className={`${s.btn} ${s.ghost} ${s.sm}`}
          onClick={() => nav.setScreen('deudas')}
        >
          Ver
        </button>
      }
    >
      {!debts.length ? (
        <Empty>Sin deudas registradas.</Empty>
      ) : !pending ? (
        <Chip tone="ok">Sin saldo pendiente</Chip>
      ) : sim.finished ? (
        <>
          <div className={s.sub}>Libre de deudas en</div>
          <div className={s.bigNumber}>{monthLabel(addMonths(currentMonth, sim.months!))}</div>
          <div className={s.sub}>Intereses estimados: {formatCOP(sim.interest)}</div>
        </>
      ) : (
        <Chip tone="bad">Con estos pagos las deudas no se terminan de pagar</Chip>
      )}
    </Card>
  );
}

function PeriodView({ months }: { months: string[] }) {
  const { data, currentMonth } = useStore();
  const nav = useNav();
  const range = rangeOfMonths(months);
  const totals = totalsFor(data.transactions, range);
  const byMonth = totalsByMonth(data.transactions, months);
  const active = months.filter((m) => {
    const t = byMonth.get(m)!;
    return t.ingresos > 0 || t.salidas > 0;
  });
  const n = Math.max(1, active.length);
  const saved = totals.ahorros + totals.inversiones;
  const rate = totals.ingresos > 0 ? Math.round((saved / totals.ingresos) * 100) : 0;
  const elapsed = monthsElapsed(months, currentMonth);
  const budgets = scaleBudgets(budgetSummary(data, currentMonth).budgets, elapsed);

  const actuals = categoryActuals(data.transactions, range);
  const spent = totals.facturas + totals.gastos;
  const top = data.categories
    .filter((c) => c.group === 'facturas' || c.group === 'gastos')
    .map((c) => ({ c, v: actuals.get(c.id) ?? 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);

  const rows = nav.period === 'anio' ? active : months;
  const title =
    nav.period === 'anio'
      ? `Balance de ${nav.month.slice(0, 4)}`
      : 'Balance de los últimos 6 meses';

  return (
    <div className={`${s.grid} ${s.two}`}>
      <section className={`${h.hero} ${s.span2}`}>
        <div className={h.label}>{title}</div>
        <div className={`${h.big} ${totals.balance < 0 ? h.negative : ''}`}>
          {formatCOP(totals.balance)}
        </div>
        <div className={h.meta}>
          <span>
            Entró <b>{formatCOP(totals.ingresos)}</b>
          </span>
          <span>
            Salió <b>{formatCOP(totals.salidas)}</b>
          </span>
        </div>
        <div className={h.foot}>
          <span>
            Ahorro e inversión: <b>{formatCOP(saved)}</b> ({rate}% de lo que entró)
          </span>
        </div>
        <div className={h.foot}>
          <span>
            Promedio al mes: entran {formatCOP(totals.ingresos / n)} · salen{' '}
            {formatCOP(totals.salidas / n)}
          </span>
        </div>
      </section>
      <Card title="Mes a mes" span2>
        <Bars data={barsFor(data, months)} />
      </Card>
      <Card title="A dónde fue mi dinero">
        <Donut slices={donutSlices(totals)} />
      </Card>
      <Card title="Dónde más gasté">
        {top.length ? (
          top.map((x) => (
            <ProgressBar
              key={x.c.id}
              label={x.c.name}
              value={x.v}
              total={top[0]!.v}
              right={`${formatCOP(x.v)} · ${Math.round((x.v / spent) * 100)}%`}
              color={x.c.group === 'facturas' ? 'var(--c-fac)' : 'var(--c-gas)'}
            />
          ))
        ) : (
          <Empty>Aún no hay facturas ni gastos en este período.</Empty>
        )}
      </Card>
      <BudgetVsActual
        totals={totals}
        budgets={budgets}
        note={`El presupuesto se multiplica por ${elapsed} ${elapsed === 1 ? 'mes transcurrido' : 'meses transcurridos'}.`}
      />
      <Card title="Detalle por mes" span2>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Mes</th>
                <th className={s.r}>Entró</th>
                <th className={s.r}>Salió</th>
                <th className={s.r}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((m) => {
                  const t = byMonth.get(m)!;
                  return (
                    <tr key={m}>
                      <td>{monthLabel(m)}</td>
                      <td className={s.r}>{formatCOP(t.ingresos)}</td>
                      <td className={s.r}>{formatCOP(t.salidas)}</td>
                      <td className={s.r}>{formatCOP(t.balance)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4}>Sin movimientos</td>
                </tr>
              )}
              <tr className={s.totalRow}>
                <td>Total</td>
                <td className={s.r}>{formatCOP(totals.ingresos)}</td>
                <td className={s.r}>{formatCOP(totals.salidas)}</td>
                <td className={s.r}>{formatCOP(totals.balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={s.note}>Cifras en pesos colombianos (COP).</p>
      </Card>
    </div>
  );
}
