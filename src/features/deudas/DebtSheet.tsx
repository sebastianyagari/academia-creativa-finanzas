import { useState, type FormEvent } from 'react';
import { newId } from '../../engine/id';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { ConfirmButton, Segmented } from '../../components/ui';
import s from '../../components/ui.module.css';
import { debtBalance, formatCOP, type Debt, type DebtType } from '../../engine';
import { rulesFor } from '../../rules';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { FormErrors } from '../registrar/TransactionSheet';

const TYPES = [
  ['credito', 'Crédito'],
  ['otro', 'Otro (p. ej. familiar)'],
] as const satisfies readonly (readonly [Exclude<DebtType, 'tarjeta_credito'>, string])[];

function parseRate(text: string): number {
  return Number.parseFloat(text.replace(',', '.'));
}

/**
 * Crear o editar una deuda. "Saldo actual" es lo que se debe hoy: al editar se
 * ajusta el saldo inicial para respetar los pagos ya registrados. El saldo de
 * una tarjeta viene de su cuenta (Anexo D.5) y aquí no se edita.
 */
export function DebtSheet({ editId }: { editId?: string }) {
  const { data, today, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const editing = data.debts.find((x) => x.id === editId);
  const isCard = editing?.type === 'tarjeta_credito';
  const currentBalance = editing ? debtBalance(editing, data) : 0;
  const paidCapital = editing && !isCard ? editing.openingBalance - currentBalance : 0;

  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState<Exclude<DebtType, 'tarjeta_credito'>>(
    editing && editing.type !== 'tarjeta_credito' ? editing.type : 'credito',
  );
  const [balance, setBalance] = useState(currentBalance);
  const [minPayment, setMinPayment] = useState(editing?.minPayment ?? 0);
  const [rate, setRate] = useState(editing ? String(editing.rateEA).replace('.', ',') : '');
  const [errors, setErrors] = useState<string[]>([]);

  const usura = rulesFor(Number(today.slice(0, 4))).rules.usuraEA;
  const rateValue = parseRate(rate || '0');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    if (!name.trim()) problems.push('Ponle un nombre a la deuda.');
    if (!isCard && balance <= 0) problems.push('Escribe el saldo actual.');
    if (minPayment <= 0) problems.push('Escribe la cuota mínima mensual.');
    if (!Number.isFinite(rateValue) || rateValue < 0 || rateValue > 200) {
      problems.push('La tasa EA debe estar entre 0 y 200.');
    }
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const debt: Debt = {
      id: editing?.id ?? newId(),
      name: name.trim(),
      type: isCard ? 'tarjeta_credito' : type,
      // Saldo inicial = lo que se debe hoy + el capital ya abonado.
      openingBalance: isCard ? 0 : balance + Math.max(0, paidCapital),
      rateEA: rateValue,
      minPayment,
      archived: editing?.archived ?? false,
    };
    await actions.saveDebt(debt);
    nav.closeSheet();
    toast(editing ? 'Cambios guardados' : 'Deuda agregada');
  }

  return (
    <Sheet title={editing ? 'Editar deuda' : 'Nueva deuda'} onClose={nav.closeSheet}>
      <form className={s.form} onSubmit={submit} noValidate>
        <label htmlFor="f-name">
          Nombre
          <input
            id="f-name"
            className={s.input}
            maxLength={40}
            value={name}
            placeholder="Ej. Crédito Bancolombia"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {!isCard && (
          <div className={s.field}>
            Tipo
            <Segmented label="Tipo de deuda" options={TYPES} value={type} onChange={setType} />
          </div>
        )}
        <div className={s.pair}>
          {isCard ? (
            <div className={s.field}>
              Saldo actual
              <span className={s.hint}>
                {formatCOP(currentBalance)}. Sale de las compras y pagos de la tarjeta.
              </span>
            </div>
          ) : (
            <label htmlFor="f-bal">
              Saldo actual
              <MoneyInput id="f-bal" value={balance} onChange={setBalance} />
            </label>
          )}
          <label htmlFor="f-min">
            Cuota mínima al mes
            <MoneyInput id="f-min" value={minPayment} onChange={setMinPayment} />
          </label>
        </div>
        <label htmlFor="f-ea">
          Tasa efectiva anual (% EA)
          <input
            id="f-ea"
            className={s.input}
            inputMode="decimal"
            value={rate}
            placeholder="Ej. 27"
            onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          {usura !== null && rateValue > usura && (
            // Nota informativa, no bloquea (SPEC 7.2).
            <span className={s.hint}>
              Esta tasa es mayor que la tasa de usura vigente ({String(usura).replace('.', ',')}%
              EA). Revisa el dato con tu banco.
            </span>
          )}
        </label>
        <FormErrors errors={errors} />
        <button type="submit" className={s.btn}>
          {editing ? 'Guardar cambios' : 'Agregar deuda'}
        </button>
        {editing && !isCard && (
          <ConfirmButton
            label="Eliminar deuda y sus pagos"
            confirmLabel="¿Seguro? Los pagos se borran de tus movimientos"
            onConfirm={async () => {
              await actions.deleteDebtWithPayments(editing.id);
              nav.closeSheet();
              toast('Deuda y pagos eliminados');
            }}
          />
        )}
      </form>
    </Sheet>
  );
}
