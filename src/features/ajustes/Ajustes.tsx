import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { useToast } from '../../components/Toast';
import { Card, ConfirmButton, Segmented } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  accountBalance,
  cardDebt,
  formatCOP,
  nextAccountOrder,
  type Account,
  type AccountType,
  type Settings,
} from '../../engine';
import { rulesFor } from '../../rules';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import a from './Ajustes.module.css';

const THEMES = [
  ['sistema', 'Sistema'],
  ['claro', 'Claro'],
  ['oscuro', 'Oscuro'],
] as const satisfies readonly (readonly [Settings['theme'], string])[];

const NEW_ACCOUNT_TYPES: [Exclude<AccountType, 'tarjeta_credito'>, string][] = [
  ['banco', 'Banco'],
  ['billetera', 'Billetera (Nequi, Daviplata)'],
  ['efectivo', 'Efectivo'],
];

/** Ajustes (SPEC 6.8). Respaldo y exportación llegan en la Fase 5. */
export function Ajustes() {
  const { data, actions } = useStore();
  const nav = useNav();
  return (
    <>
      <header className={a.top}>
        <button
          type="button"
          className={a.back}
          onClick={() => nav.setScreen('inicio')}
          aria-label="Volver"
        >
          <Icon name="back" size={22} />
        </button>
        <h1>Ajustes</h1>
      </header>
      <div className={`${s.grid} ${s.two}`}>
        <Card title="Perfil">
          <label className={s.field} htmlFor="f-uname">
            ¿Cómo te llamas?
            <input
              id="f-uname"
              className={s.input}
              maxLength={30}
              defaultValue={data.profile.name}
              placeholder="Tu nombre"
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name !== data.profile.name) void actions.updateProfile({ name });
              }}
            />
          </label>
        </Card>
        <Card title="Tema">
          <Segmented
            label="Tema"
            options={THEMES}
            value={data.settings.theme}
            onChange={(theme) => void actions.updateSettings({ theme })}
          />
        </Card>
        <Accounts />
        <DataCard />
        <About />
      </div>
    </>
  );
}

function Accounts() {
  const { data, actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<Exclude<AccountType, 'tarjeta_credito'>>('banco');
  const accounts = data.accounts.filter((x) => !x.archived);

  const save = (account: Account) => actions.saveAccounts([account]);

  return (
    <Card title="Cuentas" span2>
      <p className={s.hint}>Ajusta el nombre y cuánto tienes hoy en cada una.</p>
      {accounts.map((acc) => {
        const isCard = acc.type === 'tarjeta_credito';
        const balance = isCard
          ? cardDebt(acc, data.transactions)
          : accountBalance(acc, data.transactions);
        return (
          <div className={a.account} key={acc.id}>
            <input
              className={s.input}
              maxLength={30}
              defaultValue={acc.name}
              aria-label={`Nombre de la cuenta ${acc.name}`}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== acc.name) void save({ ...acc, name: next });
                else e.target.value = acc.name;
              }}
            />
            {isCard ? (
              <span className={`${s.sub} ${a.cardDebt}`}>Debes {formatCOP(balance)}</span>
            ) : (
              <MoneyInput
                value={balance}
                ariaLabel={`Saldo de ${acc.name}`}
                onCommit={(v) => {
                  if (v === balance) return;
                  // Corrige el saldo de partida; los movimientos no cambian (SPEC 6.8).
                  void save({ ...acc, openingBalance: acc.openingBalance + (v - balance) });
                  toast('Saldo corregido. Tus movimientos no cambian.');
                }}
              />
            )}
            <ConfirmButton
              className={s.iconBtn}
              ariaLabel={`Archivar ${acc.name}`}
              label={<Icon name="trash" size={18} />}
              confirmLabel="¿Archivar?"
              onConfirm={async () => {
                await save({ ...acc, archived: true });
                toast('Cuenta archivada. Sus movimientos se conservan.');
              }}
            />
          </div>
        );
      })}
      <p className={s.note}>
        Al corregir un saldo cambia tu saldo de partida; tus movimientos no cambian.
      </p>
      <form
        className={a.add}
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          await save({
            id: crypto.randomUUID(),
            name: trimmed,
            type,
            openingBalance: 0,
            archived: false,
            order: nextAccountOrder(data.accounts),
          });
          setName('');
          toast('Cuenta agregada');
        }}
      >
        <input
          className={s.input}
          maxLength={30}
          placeholder="Nueva cuenta"
          aria-label="Nombre de la nueva cuenta"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className={s.input}
          aria-label="Tipo de la nueva cuenta"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {NEW_ACCOUNT_TYPES.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={`${s.btn} ${s.ghost}`}>
          Agregar
        </button>
      </form>
    </Card>
  );
}

/** Datos de ejemplo y borrar todo, con doble confirmación (SPEC 6.8). */
function DataCard() {
  const { data, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const [wipe, setWipe] = useState(false);
  return (
    <Card title="Tus datos">
      <div className={s.stack}>
        {data.settings.isDemo ? (
          <ConfirmButton
            className={`${s.btn} ${s.ghost}`}
            label="Empezar con mis datos"
            confirmLabel="Sí, borrar el ejemplo"
            onConfirm={async () => {
              await actions.startFresh();
              toast('Listo. Empieza registrando tus ingresos.');
              nav.setScreen('inicio');
            }}
          />
        ) : wipe ? (
          <div className={a.danger}>
            <p>
              Se borran todos tus movimientos, cuentas, metas y deudas de este dispositivo. No se
              puede deshacer.
            </p>
            <div className={s.row}>
              <button type="button" className={`${s.btn} ${s.line}`} onClick={() => setWipe(false)}>
                Cancelar
              </button>
              <ConfirmButton
                className={`${s.btn} ${s.danger}`}
                label="Sí, borrar todo"
                confirmLabel="Toca otra vez para borrar"
                onConfirm={async () => {
                  await actions.startFresh();
                  setWipe(false);
                  toast('Todo borrado.');
                  nav.setScreen('inicio');
                }}
              />
            </div>
          </div>
        ) : (
          <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => setWipe(true)}>
            Borrar todo y empezar de cero
          </button>
        )}
        <ConfirmButton
          className={`${s.btn} ${s.line}`}
          label="Cargar datos de ejemplo"
          confirmLabel={
            data.settings.isDemo ? 'Recargar el ejemplo' : 'Esto reemplaza tus datos. ¿Seguro?'
          }
          onConfirm={async () => {
            await actions.loadDemo();
            toast('Datos de ejemplo cargados');
            nav.setScreen('inicio');
          }}
        />
      </div>
    </Card>
  );
}

function About() {
  const { today } = useStore();
  const { rules, isFallback } = rulesFor(Number(today.slice(0, 4)));
  return (
    <Card title="Acerca de">
      <div className={s.sumRow}>
        <span>Versión de la app</span>
        <b>{__APP_VERSION__}</b>
      </div>
      <div className={s.sumRow}>
        <span>Parámetros de Colombia</span>
        <b>{rules.version}</b>
      </div>
      {isFallback && (
        <p className={s.note}>
          Aún no hay parámetros de {today.slice(0, 4)}; se usan los de {rules.year}.
        </p>
      )}
      <p className={s.note}>
        Esta aplicación es una herramienta educativa para organizar tus finanzas. No constituye
        asesoría financiera, legal ni tributaria.
      </p>
      <p className={s.note}>
        Tus datos se guardan solo en este dispositivo. Academia Creativa no los recibe ni los
        almacena. Si borras los datos del navegador o cambias de dispositivo sin respaldo, los
        pierdes.
      </p>
    </Card>
  );
}
