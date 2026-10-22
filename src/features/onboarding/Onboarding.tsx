import { useState, type ReactNode } from 'react';
import { BrandMark } from '../../components/BrandMark';
import { MoneyInput } from '../../components/MoneyInput';
import { useToast } from '../../components/Toast';
import { Segmented } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  accountBalance,
  APPROX_LABEL,
  formatCOP,
  isValidMonth,
  suggestedGoal,
  type AppData,
  type OnboardingAccount,
  type OnboardingAnswers,
  type OnboardingDebt,
  type Profile,
} from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import o from './Onboarding.module.css';

const STEPS = ['nombre', 'ingresos', 'monto', 'cuentas', 'deudas', 'objetivo'] as const;
type Step = (typeof STEPS)[number];

const INCOME_TYPES: [Profile['incomeType'], string, string][] = [
  ['empleado', 'Empleado', 'Con contrato y nómina'],
  ['independiente', 'Independiente', 'Honorarios, ventas o negocio propio'],
  ['ambos', 'Ambos', 'Empleo y algo por mi cuenta'],
];

const GOALS: [Profile['mainGoal'], string, string][] = [
  ['ordenar', 'Ordenar mis gastos', 'Saber a dónde se va la plata'],
  ['ahorrar', 'Ahorrar para algo', 'Un viaje, una moto, un estudio…'],
  ['deudas', 'Pagar mis deudas', 'Un plan para salir de deudas'],
  ['emergencia', 'Fondo de emergencia', 'Un colchón para imprevistos'],
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Respuestas de partida: las de la persona si repite el onboarding, o valores por defecto. */
function initialAnswers(data: AppData, today: string): OnboardingAnswers {
  const balanceOf = (name: string) => {
    const acc = data.accounts.find((a) => !a.archived && a.name === name);
    return acc ? accountBalance(acc, data.transactions) : 0;
  };
  const bank =
    data.accounts.find((a) => !a.archived && a.type === 'banco') ??
    data.accounts.find((a) => a.type === 'banco');
  const salary = data.categories.find((c) => c.name === 'Salario')?.budget ?? 0;
  const fees =
    data.categories.find((c) => c.name === 'Honorarios o trabajo independiente')?.budget ?? 0;
  const income = data.profile.incomeType === 'independiente' ? fees : salary;
  const used = (name: string) => data.accounts.some((a) => !a.archived && a.name === name);
  return {
    name: data.profile.name,
    incomeType: data.profile.incomeType,
    payFrequency: data.profile.payFrequency,
    monthlyIncome: income,
    payDay: 31,
    cesantias: 'fondo',
    socialSecurity: data.categories.some((c) => c.name === 'Seguridad social e impuestos'),
    accounts: [
      { name: 'Efectivo', type: 'efectivo', balance: balanceOf('Efectivo'), use: used('Efectivo') },
      { name: 'Nequi', type: 'billetera', balance: balanceOf('Nequi'), use: used('Nequi') },
      {
        name: 'Daviplata',
        type: 'billetera',
        balance: balanceOf('Daviplata'),
        use: used('Daviplata'),
      },
      {
        ...(bank ? { id: bank.id } : {}),
        name: bank?.name ?? 'Cuenta de ahorros',
        type: 'banco',
        balance: bank ? accountBalance(bank, data.transactions) : 0,
        use: bank ? !bank.archived : true,
      },
    ],
    debts: [],
    mainGoal: data.profile.mainGoal,
    goal: suggestedGoal(data.profile.mainGoal, income, today),
  };
}

/**
 * Onboarding (SPEC 6.1): pantallas cortas, todas con "Saltar" y "Lo ajustas
 * después". Repetirlo desde Ajustes no borra datos.
 */
export function Onboarding({ repeat }: { repeat: boolean }) {
  const { data, today, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const [welcome, setWelcome] = useState(!repeat);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => initialAnswers(data, today));
  const [skipped, setSkipped] = useState<Set<Step>>(new Set());
  const [finishing, setFinishing] = useState(false);
  const [debtDraft, setDebtDraft] = useState<DebtDraft>(EMPTY_DRAFT);
  const [debtError, setDebtError] = useState('');

  const step = STEPS[index]!;
  const set = (changes: Partial<OnboardingAnswers>) => setAnswers((a) => ({ ...a, ...changes }));

  /** Agrega la deuda escrita. Devuelve false si le falta algo (y muestra qué). */
  function addDraftDebt(): boolean {
    const read = readDraft(debtDraft);
    if ('error' in read) {
      setDebtError(read.error);
      return false;
    }
    setAnswers((a) => ({ ...a, debts: [...a.debts, read.debt] }));
    setDebtDraft(EMPTY_DRAFT);
    setDebtError('');
    return true;
  }

  async function finish(skipAll = false) {
    if (finishing) return;
    setFinishing(true);
    const skip = (st: Step) => skipAll || skipped.has(st);
    const final: OnboardingAnswers = {
      ...answers,
      name: skip('nombre') ? data.profile.name : answers.name,
      monthlyIncome: skip('monto') ? 0 : answers.monthlyIncome,
      socialSecurity: skip('monto') ? false : answers.socialSecurity,
      accounts: skip('cuentas') ? null : answers.accounts,
      // "Saltar" en deudas no borra las que ya se agregaron.
      debts: skipAll ? [] : answers.debts.filter((d) => d.name.trim()),
      mainGoal: skip('objetivo') ? data.profile.mainGoal : answers.mainGoal,
      goal: skip('objetivo') ? null : answers.goal,
      ...(skip('ingresos')
        ? { incomeType: data.profile.incomeType, payFrequency: data.profile.payFrequency }
        : {}),
    };
    await actions.completeOnboarding(final);
    nav.setRepeatingOnboarding(false);
    // Recién configurada la app no hay meses con datos: Inicio en "Mes" (Anexo D.17).
    if (!repeat) nav.setPeriod('mes');
    nav.setScreen(skip('objetivo') ? 'inicio' : startTabFor(final.mainGoal));
    toast(skipAll ? 'Listo. Puedes configurar todo en Ajustes.' : '¡Listo! Ya puedes empezar.');
  }

  function next(skip = false) {
    // Una deuda escrita pero sin "Agregar deuda" no se pierde al seguir (hallado en la
    // prueba en celular). Si le falta un dato, se avisa y no se avanza.
    if (step === 'deudas' && !skip && !isEmptyDraft(debtDraft) && !addDraftDebt()) return;
    if (skip) setSkipped((prev) => new Set(prev).add(step));
    else
      setSkipped((prev) => {
        const copy = new Set(prev);
        copy.delete(step);
        return copy;
      });
    if (index < STEPS.length - 1) {
      setIndex(index + 1);
      window.scrollTo(0, 0);
    } else void finish();
  }

  if (welcome) {
    return (
      <main className={o.screen}>
        <div className={o.welcome}>
          <BrandMark variant="vertical" height={150} label="Academia Creativa" />
          <h1>Organiza tu plata en dos minutos</h1>
          <p>Te haremos seis preguntas cortas para dejar la app lista. Todas se pueden saltar.</p>
          <p className={o.privacy}>Tus datos se quedan en tu dispositivo.</p>
          <div className={s.stack}>
            <button type="button" className={s.btn} onClick={() => setWelcome(false)}>
              Empezar
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.ghost}`}
              onClick={async () => {
                await actions.loadDemo();
                // El ejemplo trae 6 meses: Inicio abre en "6 meses" (Anexo D.17).
                nav.setPeriod('6m');
                nav.setScreen('inicio');
                toast('Datos de ejemplo cargados');
              }}
            >
              Ver con datos de ejemplo
            </button>
            <button type="button" className={o.link} onClick={() => void finish(true)}>
              Saltar y empezar sin configurar
            </button>
          </div>
        </div>
        <EducationalNote />
      </main>
    );
  }

  return (
    <main className={o.screen}>
      <header className={o.top}>
        {repeat ? (
          <button
            type="button"
            className={o.link}
            onClick={() => nav.setRepeatingOnboarding(false)}
          >
            Cancelar
          </button>
        ) : (
          <span />
        )}
        <span className={o.progress} aria-live="polite">
          Paso {index + 1} de {STEPS.length}
        </span>
        <button type="button" className={o.link} onClick={() => next(true)}>
          Saltar
        </button>
      </header>
      <div className={o.dots} aria-hidden="true">
        {STEPS.map((st, i) => (
          <i key={st} className={i <= index ? o.on : ''} />
        ))}
      </div>

      <form
        className={o.body}
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
      >
        {step === 'nombre' && (
          <Question title="¿Cómo te llamas?">
            <input
              className={s.input}
              aria-label="Tu nombre"
              maxLength={30}
              autoFocus
              autoComplete="given-name"
              placeholder="Tu nombre"
              value={answers.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Question>
        )}

        {step === 'ingresos' && (
          <Question title="¿Cómo recibes tus ingresos?">
            <Choices
              name="tipo"
              options={INCOME_TYPES}
              value={answers.incomeType}
              onChange={(incomeType) => set({ incomeType })}
            />
            <div className={s.field}>
              ¿Cada cuánto te pagan?
              <Segmented
                label="Frecuencia de pago"
                options={[
                  ['mensual', 'Una vez al mes'],
                  ['quincenal', 'Cada quincena'],
                ]}
                value={answers.payFrequency}
                onChange={(payFrequency) => set({ payFrequency })}
              />
            </div>
          </Question>
        )}

        {step === 'monto' && (
          <Question title="¿Cuánto recibes al mes, más o menos?">
            <label className={s.field} htmlFor="ob-income">
              Ingreso mensual aproximado
              <MoneyInput
                id="ob-income"
                large
                value={answers.monthlyIncome}
                onChange={(monthlyIncome) =>
                  set({
                    monthlyIncome,
                    ...(answers.mainGoal === 'emergencia'
                      ? { goal: suggestedGoal('emergencia', monthlyIncome, today) }
                      : {}),
                  })
                }
              />
            </label>
            {answers.payFrequency === 'quincenal' ? (
              <p className={s.hint}>
                Programaremos dos pagos de {formatCOP(Math.round(answers.monthlyIncome / 2))}: el 15
                y el último día del mes. Cada uno aparece como pendiente para registrarlo con un
                toque.
              </p>
            ) : (
              <label className={s.field} htmlFor="ob-day">
                ¿Qué día te pagan?
                <select
                  id="ob-day"
                  className={s.input}
                  value={answers.payDay}
                  onChange={(e) => set({ payDay: Number(e.target.value) })}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d === 31 ? 'El último día del mes' : `El día ${d}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {answers.incomeType !== 'independiente' && (
              <div className={o.box}>
                <p>
                  <b>Prima y cesantías.</b> Programaremos la prima de junio y de diciembre (medio
                  mes de salario cada una) y los intereses de cesantías en enero.
                </p>
                <div className={s.field}>
                  Tus cesantías…
                  <Choices
                    name="cesantias"
                    options={[
                      [
                        'fondo',
                        'Me las consigna el empleador al fondo',
                        'Solo programamos los intereses',
                      ],
                      ['cuenta', 'Me las paga a mí', 'Las programamos para febrero'],
                    ]}
                    value={answers.cesantias}
                    onChange={(cesantias) => set({ cesantias })}
                  />
                </div>
                <p className={s.hint}>{APPROX_LABEL}</p>
              </div>
            )}
            {answers.incomeType !== 'empleado' && (
              <label className={o.check}>
                <input
                  type="checkbox"
                  checked={answers.socialSecurity}
                  onChange={(e) => set({ socialSecurity: e.target.checked })}
                />
                <span>
                  Quiero apartar para seguridad social e impuestos
                  <span className={s.hint}>
                    Creamos esa factura para que la presupuestes cada mes.
                  </span>
                </span>
              </label>
            )}
          </Question>
        )}

        {step === 'cuentas' && (
          <Question title="¿Dónde guardas tu plata?">
            <p className={s.hint}>Marca las que usas y escribe cuánto tienes hoy (opcional).</p>
            {(answers.accounts ?? []).map((acc, i) => (
              <AccountChoice
                key={i}
                account={acc}
                editableName={acc.type === 'banco'}
                onChange={(changed) =>
                  set({ accounts: answers.accounts!.map((a, j) => (j === i ? changed : a)) })
                }
              />
            ))}
          </Question>
        )}

        {step === 'deudas' && (
          <Question title="¿Tienes deudas?">
            <p className={s.hint}>
              Créditos, tarjetas o préstamos. Con esto armamos tu plan para salir de deudas.
            </p>
            {answers.debts.map((d, i) => (
              <div key={i} className={o.debt}>
                <span>
                  <b>{d.name}</b>
                  <span className={s.sub}>
                    {d.isCard ? 'Tarjeta' : 'Crédito'} · {formatCOP(d.balance)} · {d.rateEA}% EA ·
                    cuota {formatCOP(d.minPayment)}
                  </span>
                </span>
                <button
                  type="button"
                  className={`${s.btn} ${s.line} ${s.sm}`}
                  onClick={() => set({ debts: answers.debts.filter((_, j) => j !== i) })}
                >
                  Quitar
                </button>
              </div>
            ))}
            <DebtForm
              draft={debtDraft}
              onChange={(d) => {
                setDebtDraft(d);
                setDebtError('');
              }}
              error={debtError}
              onAdd={() => void addDraftDebt()}
            />
          </Question>
        )}

        {step === 'objetivo' && (
          <Question title="¿Qué quieres lograr primero?">
            <Choices
              name="objetivo"
              options={GOALS}
              value={answers.mainGoal}
              onChange={(mainGoal) =>
                set({ mainGoal, goal: suggestedGoal(mainGoal, answers.monthlyIncome, today) })
              }
            />
            {answers.goal && (
              <div className={o.box}>
                <b>Tu primera meta</b>
                <label className={s.field} htmlFor="ob-goal">
                  Nombre
                  <input
                    id="ob-goal"
                    className={s.input}
                    maxLength={40}
                    placeholder="Ej. Viaje a Cartagena"
                    value={answers.goal.name}
                    onChange={(e) => set({ goal: { ...answers.goal!, name: e.target.value } })}
                  />
                </label>
                <div className={s.pair}>
                  <label className={s.field} htmlFor="ob-target">
                    Monto
                    <MoneyInput
                      id="ob-target"
                      value={answers.goal.target}
                      onChange={(target) => set({ goal: { ...answers.goal!, target } })}
                    />
                  </label>
                  <label className={s.field} htmlFor="ob-deadline">
                    Para
                    <input
                      id="ob-deadline"
                      className={s.input}
                      type="month"
                      value={answers.goal.deadline}
                      onChange={(e) =>
                        isValidMonth(e.target.value) &&
                        set({ goal: { ...answers.goal!, deadline: e.target.value } })
                      }
                    />
                  </label>
                </div>
                {answers.mainGoal === 'emergencia' && (
                  <p className={s.hint}>Sugerimos tres meses de tu ingreso. Ajústalo a tu caso.</p>
                )}
              </div>
            )}
          </Question>
        )}

        <div className={o.actions}>
          {index > 0 && (
            <button
              type="button"
              className={`${s.btn} ${s.line}`}
              onClick={() => setIndex(index - 1)}
            >
              Atrás
            </button>
          )}
          <button type="submit" className={s.btn} disabled={finishing}>
            {index === STEPS.length - 1 ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
        {index === STEPS.length - 1 && (
          <p className={o.privacy}>Tus datos se quedan en tu dispositivo.</p>
        )}
      </form>
      <EducationalNote />
    </main>
  );
}

function startTabFor(goal: Profile['mainGoal']) {
  return goal === 'deudas' ? 'deudas' : goal === 'ordenar' ? 'inicio' : 'metas';
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={o.question}>
      <h1>{title}</h1>
      <p className={o.later}>Lo ajustas después.</p>
      <div className={s.stack}>{children}</div>
    </section>
  );
}

/** Opciones grandes tipo tarjeta (radios reales, accesibles con teclado). */
function Choices<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: [T, string, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={o.choices} role="radiogroup">
      {options.map(([key, label, hint]) => (
        <label key={key} className={`${o.choice} ${value === key ? o.selected : ''}`}>
          <input type="radio" name={name} checked={value === key} onChange={() => onChange(key)} />
          <span>
            <b>{label}</b>
            <span className={s.sub}>{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function AccountChoice({
  account,
  editableName,
  onChange,
}: {
  account: OnboardingAccount;
  editableName: boolean;
  onChange: (a: OnboardingAccount) => void;
}) {
  return (
    <div className={`${o.account} ${account.use ? o.selected : ''}`}>
      <label className={o.check}>
        <input
          type="checkbox"
          checked={account.use}
          aria-label={`Uso ${account.name}`}
          onChange={(e) => onChange({ ...account, use: e.target.checked })}
        />
        {editableName ? (
          <input
            className={s.input}
            aria-label="Nombre de tu banco"
            placeholder="Ej. Bancolombia"
            value={account.name}
            onChange={(e) => onChange({ ...account, name: e.target.value, use: true })}
          />
        ) : (
          <b>{account.name}</b>
        )}
      </label>
      {account.use && (
        <MoneyInput
          value={account.balance ?? 0}
          ariaLabel={`Saldo de hoy en ${account.name}`}
          placeholder="Saldo de hoy"
          onChange={(balance) => onChange({ ...account, balance })}
        />
      )}
    </div>
  );
}

interface DebtDraft {
  name: string;
  balance: number;
  rate: string;
  minPayment: number;
  isCard: boolean;
}

const EMPTY_DRAFT: DebtDraft = { name: '', balance: 0, rate: '', minPayment: 0, isCard: false };

function isEmptyDraft(d: DebtDraft): boolean {
  return !d.name.trim() && !d.balance && !d.rate && !d.minPayment;
}

/** Convierte el borrador en deuda, o explica qué falta. */
function readDraft(d: DebtDraft): { debt: OnboardingDebt } | { error: string } {
  const rateEA = Number.parseFloat((d.rate || '0').replace(',', '.'));
  if (!d.name.trim() || d.balance <= 0 || d.minPayment <= 0) {
    return { error: 'Escribe el nombre, lo que debes y la cuota mínima.' };
  }
  if (!Number.isFinite(rateEA) || rateEA < 0 || rateEA > 200) {
    return { error: 'La tasa EA debe estar entre 0 y 200.' };
  }
  return {
    debt: {
      name: d.name.trim(),
      balance: d.balance,
      rateEA,
      minPayment: d.minPayment,
      isCard: d.isCard,
    },
  };
}

function DebtForm({
  draft,
  onChange,
  error,
  onAdd,
}: {
  draft: DebtDraft;
  onChange: (draft: DebtDraft) => void;
  error: string;
  onAdd: () => void;
}) {
  const { name, balance, rate, minPayment, isCard } = draft;
  const setName = (v: string) => onChange({ ...draft, name: v });
  const setBalance = (v: number) => onChange({ ...draft, balance: v });
  const setRate = (v: string) => onChange({ ...draft, rate: v });
  const setMinPayment = (v: number) => onChange({ ...draft, minPayment: v });
  const setIsCard = (v: boolean) => onChange({ ...draft, isCard: v });
  return (
    <div className={o.box}>
      <b>Agregar una deuda</b>
      <label className={s.field} htmlFor="ob-debt-name">
        Nombre
        <input
          id="ob-debt-name"
          className={s.input}
          maxLength={40}
          placeholder="Ej. Tarjeta Visa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className={o.check}>
        <input type="checkbox" checked={isCard} onChange={(e) => setIsCard(e.target.checked)} />
        <span>Es una tarjeta de crédito</span>
      </label>
      <div className={s.pair}>
        <label className={s.field} htmlFor="ob-debt-bal">
          Debes hoy
          <MoneyInput id="ob-debt-bal" value={balance} onChange={setBalance} />
        </label>
        <label className={s.field} htmlFor="ob-debt-min">
          Cuota mínima
          <MoneyInput id="ob-debt-min" value={minPayment} onChange={setMinPayment} />
        </label>
      </div>
      <label className={s.field} htmlFor="ob-debt-ea">
        Tasa efectiva anual (% EA)
        <input
          id="ob-debt-ea"
          className={s.input}
          inputMode="decimal"
          placeholder="Ej. 27 (está en tu extracto)"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
        />
      </label>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={`${s.btn} ${s.ghost}`} onClick={onAdd}>
        Agregar deuda
      </button>
      <p className={s.hint}>
        Si tienes varias, agrégalas una por una. Al tocar “Siguiente” guardamos la que esté escrita.
      </p>
    </div>
  );
}

/** Aviso educativo al pie del onboarding (SPEC 13). */
function EducationalNote() {
  return (
    <p className={o.footer}>
      Esta aplicación es una herramienta educativa para organizar tus finanzas. No constituye
      asesoría financiera, legal ni tributaria.
    </p>
  );
}
