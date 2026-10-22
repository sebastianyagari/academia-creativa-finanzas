import { useState } from 'react';
import { newId } from '../../engine/id';
import { CUBE, GROUP_LABEL, monthLabel, OUT_CUBES } from '../../components/format';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { useToast } from '../../components/Toast';
import { Card, ConfirmButton, Empty, MonthBar, ProgressBar, Swatch } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  addMonths,
  budgetSummary,
  categoriesOf,
  categoryActuals,
  debtBalance,
  formatCOP,
  goalProgress,
  goalSaved,
  insertCategory,
  monthRange,
  moveCategory,
  type Category,
  type Group,
} from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { Reorder } from '../shared/Reorder';
import { ScreenTop } from '../shared/ScreenTop';
import p from './Presupuesto.module.css';

const GROUPS: Group[] = ['ingresos', 'facturas', 'gastos', 'inversiones'];

/** Presupuesto mensual por categoría contra lo real del mes visto (SPEC 6.5). */
export function Presupuesto() {
  const { data, currentMonth } = useStore();
  const nav = useNav();
  const { budgets, unassigned } = budgetSummary(data, currentMonth);
  return (
    <>
      <ScreenTop title="Presupuesto" />
      <MonthBar
        label={monthLabel(nav.month)}
        onPrev={() => nav.setMonth(addMonths(nav.month, -1))}
        onNext={() => nav.setMonth(addMonths(nav.month, 1))}
      />
      <div className={`${s.grid} ${s.two}`}>
        <Card title="Resumen del presupuesto" span2>
          <div className={s.sumRow}>
            <span>Ingresos esperados</span>
            <b className={s.money}>{formatCOP(budgets.ingresos)}</b>
          </div>
          {OUT_CUBES.map((k) => (
            <div className={s.sumRow} key={k}>
              <span>
                <Swatch color={CUBE[k].color} /> {CUBE[k].label}
              </span>
              <span className={s.money}>{formatCOP(budgets[k])}</span>
            </div>
          ))}
          <div className={`${s.sumRow} ${s.total}`}>
            <span>{unassigned >= 0 ? 'Falta por presupuestar' : 'Te pasaste por'}</span>
            <span className={s.money} style={unassigned < 0 ? { color: 'var(--bad)' } : undefined}>
              {formatCOP(Math.abs(unassigned))}
            </span>
          </div>
          <p className={s.note}>
            Los montos de presupuesto aplican a todos los meses. Lo real se muestra para{' '}
            {monthLabel(nav.month).toLowerCase()}.
          </p>
        </Card>
        {GROUPS.map((g) => (
          <GroupCard key={g} group={g} />
        ))}
        <SavingsCard />
        <DebtsCard />
      </div>
    </>
  );
}

function GroupCard({ group }: { group: Group }) {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [sorting, setSorting] = useState(false);
  const actuals = categoryActuals(data.transactions, monthRange(nav.month));
  const all = categoriesOf(data.categories, group);
  const categories = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const movable = categories.filter((c) => !c.isOther);
  const color = CUBE[group].color;

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const created: Category = {
      id: newId(),
      group,
      name,
      budget: 0,
      isOther: false,
      isSystem: false,
      archived: false,
      order: 0,
    };
    await actions.saveCategories(insertCategory(data.categories, created));
    setNewName('');
    toast('Categoría agregada');
  }

  return (
    <Card
      title={GROUP_LABEL[group]}
      action={
        <span className={p.cardActions}>
          {movable.length > 1 && (
            <button
              type="button"
              className={`${s.btn} ${s.ghost} ${s.sm}`}
              aria-label={
                sorting
                  ? `Terminar de ordenar ${GROUP_LABEL[group]}`
                  : `Ordenar ${GROUP_LABEL[group]}`
              }
              onClick={() => setSorting(!sorting)}
            >
              {sorting ? 'Listo' : 'Ordenar'}
            </button>
          )}
          <Swatch color={color} />
        </span>
      }
    >
      {sorting ? (
        <>
          <Reorder
            items={movable}
            onMove={(id, to) => actions.saveCategories(moveCategory(data.categories, id, to))}
          />
          <p className={s.note}>“{categories.find((c) => c.isOther)?.name}” siempre va al final.</p>
        </>
      ) : (
        categories.map((c) => (
          <CategoryRow key={c.id} category={c} actual={actuals.get(c.id) ?? 0} color={color} />
        ))
      )}
      {archived.length > 0 && !sorting && (
        <details className={p.archived}>
          <summary>Archivadas ({archived.length})</summary>
          {archived.map((c) => (
            <div className={s.sumRow} key={c.id}>
              <span>{c.name}</span>
              <button
                type="button"
                className={`${s.btn} ${s.line} ${s.sm}`}
                onClick={async () => {
                  await actions.saveCategories([{ ...c, archived: false }]);
                  toast('Categoría restaurada');
                }}
              >
                Restaurar
              </button>
            </div>
          ))}
        </details>
      )}
      <form
        className={p.add}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          className={s.input}
          placeholder="Nueva categoría"
          maxLength={40}
          value={newName}
          aria-label={`Nueva categoría de ${GROUP_LABEL[group].toLowerCase()}`}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className={`${s.btn} ${s.sm}`}>
          Agregar
        </button>
      </form>
    </Card>
  );
}

function CategoryRow({
  category: c,
  actual,
  color,
}: {
  category: Category;
  actual: number;
  color: string;
}) {
  const { data, actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState(c.name);
  const fixed = c.isOther || c.isSystem;
  const used =
    data.transactions.some((t) => t.categoryId === c.id) ||
    data.recurrings.some((r) => r.categoryId === c.id);
  const over = c.group !== 'ingresos' && c.budget > 0 && actual > c.budget;

  const save = (changes: Partial<Category>) => actions.saveCategories([{ ...c, ...changes }]);

  return (
    <div className={p.row}>
      <div className={p.head}>
        {fixed ? (
          <b className={p.fixedName}>{c.name}</b>
        ) : (
          <input
            className={p.rename}
            value={name}
            maxLength={40}
            aria-label={`Nombre de la categoría ${c.name}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim();
              if (next && next !== c.name) void save({ name: next });
              else setName(c.name);
            }}
          />
        )}
        <div className={p.fields}>
          <span className={`${s.sub} ${p.fieldLabel}`} aria-hidden="true">
            Presupuesto al mes
          </span>
          <MoneyInput
            className={p.budget}
            value={c.budget}
            ariaLabel={`Presupuesto de ${c.name}`}
            onCommit={(v) => {
              if (v !== c.budget) void save({ budget: v });
            }}
          />
          {!fixed &&
            (used ? (
              <ConfirmButton
                className={s.iconBtn}
                ariaLabel={`Archivar ${c.name}`}
                label={<Icon name="trash" size={18} />}
                confirmLabel="¿Archivar?"
                onConfirm={async () => {
                  await save({ archived: true });
                  toast('Categoría archivada. Sus movimientos se conservan.');
                }}
              />
            ) : (
              <ConfirmButton
                className={s.iconBtn}
                ariaLabel={`Eliminar ${c.name}`}
                label={<Icon name="trash" size={18} />}
                confirmLabel="¿Quitar?"
                onConfirm={async () => {
                  if (await actions.deleteCategory(c.id)) toast('Categoría eliminada');
                }}
              />
            ))}
        </div>
      </div>
      {c.group === 'facturas' && (
        <label className={p.due}>
          <span className={s.sub}>Vence el día</span>
          <input
            className={`${s.input} ${p.dayInput}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            defaultValue={c.dueDay ?? ''}
            aria-label={`Día de vencimiento de ${c.name}`}
            onBlur={(e) => {
              const d = Number.parseInt(e.target.value, 10);
              const dueDay = d >= 1 && d <= 31 ? d : undefined;
              if (dueDay !== c.dueDay) {
                const { dueDay: _old, ...rest } = c;
                void actions.saveCategories([dueDay ? { ...rest, dueDay } : rest]);
              }
            }}
          />
        </label>
      )}
      <ProgressBar
        label={<span className={s.sub}>Real</span>}
        value={actual}
        total={c.budget || actual}
        right={`${formatCOP(actual)}${c.budget ? ` de ${formatCOP(c.budget)}` : ''}`}
        color={color}
        over={over}
      />
    </div>
  );
}

/** Ahorros y deudas en solo lectura: vienen de Metas y Deudas (SPEC 6.5). */
function SavingsCard() {
  const { data, currentMonth } = useStore();
  const goals = data.goals.filter((g) => !g.archived);
  return (
    <Card title="Ahorros" action={<Swatch color="var(--c-aho)" />}>
      {goals.length ? (
        goals.map((g) => (
          <div className={s.sumRow} key={g.id}>
            <b>{g.name}</b>
            <span className={s.money}>
              {formatCOP(goalProgress(g, goalSaved(g, data.transactions), currentMonth).suggested)}
              /mes
            </span>
          </div>
        ))
      ) : (
        <Empty>Crea metas en la pestaña Metas. El aporte mensual se calcula solo.</Empty>
      )}
    </Card>
  );
}

function DebtsCard() {
  const { data } = useStore();
  const debts = data.debts.filter((d) => !d.archived && debtBalance(d, data) > 0);
  const loans = debts.filter((d) => d.type !== 'tarjeta_credito');
  return (
    <Card title="Deudas" action={<Swatch color="var(--c-deu)" />}>
      {debts.length ? (
        <>
          {debts.map((d) => (
            <div className={s.sumRow} key={d.id}>
              <b>{d.name}</b>
              <span className={s.money}>{formatCOP(d.minPayment)}/mes</span>
            </div>
          ))}
          {loans.length > 0 && data.settings.extraPayment > 0 && (
            <div className={s.sumRow}>
              <b>Abono extra</b>
              <span className={s.money}>{formatCOP(data.settings.extraPayment)}/mes</span>
            </div>
          )}
          {debts.some((d) => d.type === 'tarjeta_credito') && (
            <p className={s.note}>
              La cuota de las tarjetas no suma al presupuesto: lo que compras con ellas ya está en
              tus gastos.
            </p>
          )}
        </>
      ) : (
        <Empty>Registra tus deudas en la pestaña Deudas.</Empty>
      )}
    </Card>
  );
}
