import { useState, type FormEvent } from 'react';
import { newId } from '../../engine/id';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { useToast } from '../../components/Toast';
import { Card, ConfirmButton } from '../../components/ui';
import s from '../../components/ui.module.css';
import {
  accountBalance,
  cardDebt,
  createCard,
  moveAccount,
  nextAccountOrder,
  type Account,
  type AccountType,
} from '../../engine';
import { useStore } from '../../state/store';
import { FormErrors } from '../registrar/TransactionSheet';
import { Reorder } from '../shared/Reorder';
import a from './Ajustes.module.css';

const NEW_ACCOUNT_TYPES: [AccountType, string][] = [
  ['banco', 'Banco'],
  ['billetera', 'Billetera (Nequi, Daviplata)'],
  ['efectivo', 'Efectivo'],
  ['tarjeta_credito', 'Tarjeta de crédito'],
];

/** Cuentas en Ajustes (SPEC 6.8): renombrar, corregir saldo, archivar, ordenar y crear (incluye tarjetas). */
export function Accounts() {
  const { data, actions } = useStore();
  const [sorting, setSorting] = useState(false);
  const accounts = data.accounts.filter((x) => !x.archived);

  return (
    <Card
      title="Cuentas"
      span2
      action={
        accounts.length > 1 && (
          <button
            type="button"
            className={`${s.btn} ${s.ghost} ${s.sm}`}
            onClick={() => setSorting(!sorting)}
          >
            {sorting ? 'Listo' : 'Ordenar'}
          </button>
        )
      }
    >
      {sorting ? (
        <Reorder
          items={accounts}
          onMove={(id, to) => actions.saveAccounts(moveAccount(accounts, id, to))}
        />
      ) : (
        <>
          <p className={s.hint}>Ajusta el nombre y cuánto tienes hoy en cada una.</p>
          {accounts.map((acc) => (
            <AccountRow key={acc.id} account={acc} />
          ))}
          <p className={s.note}>
            Al corregir un saldo cambia tu saldo de partida; tus movimientos no cambian.
          </p>
          <NewAccount />
        </>
      )}
    </Card>
  );
}

function AccountRow({ account: acc }: { account: Account }) {
  const { data, actions } = useStore();
  const toast = useToast();
  const isCard = acc.type === 'tarjeta_credito';
  const balance = isCard
    ? cardDebt(acc, data.transactions)
    : accountBalance(acc, data.transactions);
  return (
    <div className={a.account}>
      <input
        className={s.input}
        maxLength={30}
        defaultValue={acc.name}
        aria-label={`Nombre de la cuenta ${acc.name}`}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next && next !== acc.name) void actions.saveAccounts([{ ...acc, name: next }]);
          else e.target.value = acc.name;
        }}
      />
      <label className={a.balance}>
        <span className={s.sub}>{isCard ? 'Debes' : 'Tienes'}</span>
        <MoneyInput
          value={Math.max(0, balance)}
          ariaLabel={isCard ? `Deuda de ${acc.name}` : `Saldo de ${acc.name}`}
          onCommit={(v) => {
            if (v === balance) return;
            // Corrige el saldo de partida; los movimientos no cambian (SPEC 6.8).
            void actions.saveAccounts([
              { ...acc, openingBalance: acc.openingBalance + (v - balance) },
            ]);
            toast('Saldo corregido. Tus movimientos no cambian.');
          }}
        />
      </label>
      <ConfirmButton
        className={s.iconBtn}
        ariaLabel={`Archivar ${acc.name}`}
        label={<Icon name="trash" size={18} />}
        confirmLabel="¿Archivar?"
        onConfirm={async () => {
          await actions.archiveAccount(acc.id);
          toast(
            isCard
              ? 'Tarjeta archivada junto con su deuda.'
              : 'Cuenta archivada. Sus movimientos se conservan.',
          );
        }}
      />
    </div>
  );
}

/** Crear cuenta. Una tarjeta de crédito pide además su deuda, tasa EA y cuota mínima (SPEC 4.3). */
function NewAccount() {
  const { data, actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('banco');
  const [debt, setDebt] = useState(0);
  const [rate, setRate] = useState('');
  const [minPayment, setMinPayment] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const isCard = type === 'tarjeta_credito';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const rateEA = Number.parseFloat((rate || '0').replace(',', '.'));
    const problems: string[] = [];
    if (!trimmed) problems.push('Ponle un nombre a la cuenta.');
    if (isCard && (!Number.isFinite(rateEA) || rateEA < 0 || rateEA > 200)) {
      problems.push('La tasa EA debe estar entre 0 y 200.');
    }
    if (isCard && minPayment <= 0) problems.push('Escribe la cuota mínima mensual.');
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const order = nextAccountOrder(data.accounts);
    if (isCard) {
      const card = createCard({ name: trimmed, currentDebt: debt, rateEA, minPayment, order }, () =>
        newId(),
      );
      await actions.createCard(card.account, card.debt);
      toast('Tarjeta agregada. También aparece en Deudas.');
    } else {
      await actions.saveAccounts([
        { id: newId(), name: trimmed, type, openingBalance: 0, archived: false, order },
      ]);
      toast('Cuenta agregada');
    }
    setName('');
    setDebt(0);
    setRate('');
    setMinPayment(0);
    setErrors([]);
  }

  return (
    <form className={a.newAccount} onSubmit={submit} noValidate>
      <div className={a.add}>
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
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          {NEW_ACCOUNT_TYPES.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {isCard && (
        <div className={a.cardFields}>
          <label className={s.field}>
            Debes hoy
            <MoneyInput value={debt} onChange={setDebt} ariaLabel="Deuda actual de la tarjeta" />
          </label>
          <label className={s.field}>
            Tasa (% EA)
            <input
              className={s.input}
              inputMode="decimal"
              placeholder="Ej. 28"
              aria-label="Tasa efectiva anual de la tarjeta"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </label>
          <label className={s.field}>
            Cuota mínima
            <MoneyInput
              value={minPayment}
              onChange={setMinPayment}
              ariaLabel="Cuota mínima de la tarjeta"
            />
          </label>
        </div>
      )}
      <FormErrors errors={errors} />
      <button type="submit" className={`${s.btn} ${s.ghost}`}>
        {isCard ? 'Agregar tarjeta' : 'Agregar cuenta'}
      </button>
    </form>
  );
}
