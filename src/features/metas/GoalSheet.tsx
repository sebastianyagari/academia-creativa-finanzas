import { useState, type FormEvent } from 'react';
import { newId } from '../../engine/id';
import { MoneyInput } from '../../components/MoneyInput';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import s from '../../components/ui.module.css';
import { ConfirmButton } from '../../components/ui';
import { addMonths, formatCOP, goalSaved, isValidMonth, type Goal } from '../../engine';
import { useNav } from '../../state/nav';
import { useStore } from '../../state/store';
import { FormErrors } from '../registrar/TransactionSheet';

/** Crear o editar una meta. "Ya tengo ahorrado" es el total; los aportes registrados se respetan. */
export function GoalSheet({ editId }: { editId?: string }) {
  const { data, currentMonth, actions } = useStore();
  const nav = useNav();
  const toast = useToast();
  const editing = data.goals.find((g) => g.id === editId);
  const contributions = editing ? goalSaved(editing, data.transactions) - editing.openingSaved : 0;

  const [name, setName] = useState(editing?.name ?? '');
  const [target, setTarget] = useState(editing?.target ?? 0);
  const [saved, setSaved] = useState(editing ? editing.openingSaved + contributions : 0);
  const [deadline, setDeadline] = useState(editing?.deadline ?? addMonths(currentMonth, 12));
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    if (!name.trim()) problems.push('Ponle un nombre a la meta.');
    if (target <= 0) problems.push('Escribe el monto de la meta.');
    if (!isValidMonth(deadline)) problems.push('Elige el mes para lograrla.');
    else if (!editing && deadline < currentMonth)
      problems.push('Elige un mes igual o posterior al actual.');
    if (saved < contributions) {
      problems.push(
        `Ya registraste aportes por ${formatCOP(contributions)}; lo ahorrado no puede ser menor.`,
      );
    }
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const goal: Goal = {
      id: editing?.id ?? newId(),
      name: name.trim(),
      target,
      openingSaved: saved - contributions,
      deadline,
      archived: editing?.archived ?? false,
    };
    await actions.saveGoal(goal);
    nav.closeSheet();
    toast(editing ? 'Cambios guardados' : 'Meta creada');
  }

  return (
    <Sheet title={editing ? 'Editar meta' : 'Nueva meta de ahorro'} onClose={nav.closeSheet}>
      <form className={s.form} onSubmit={submit} noValidate>
        <label htmlFor="f-name">
          Nombre
          <input
            id="f-name"
            className={s.input}
            maxLength={40}
            value={name}
            placeholder="Ej. Fondo de emergencia"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className={s.pair}>
          <label htmlFor="f-target">
            Monto de la meta
            <MoneyInput id="f-target" value={target} onChange={setTarget} />
          </label>
          <label htmlFor="f-saved">
            Ya tengo ahorrado
            <MoneyInput id="f-saved" value={saved} onChange={setSaved} />
          </label>
        </div>
        <label htmlFor="f-deadline">
          Mes para lograrla
          <input
            id="f-deadline"
            className={s.input}
            type="month"
            value={deadline}
            placeholder="2027-10"
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        <FormErrors errors={errors} />
        <button type="submit" className={s.btn}>
          {editing ? 'Guardar cambios' : 'Crear meta'}
        </button>
        {editing && (
          // Segunda opción de "Quitar" (Anexo D.6): borra la meta y todos sus aportes.
          <ConfirmButton
            label="Eliminar meta y sus aportes"
            confirmLabel="¿Seguro? Los aportes se borran de tus movimientos"
            onConfirm={async () => {
              await actions.deleteGoalWithContributions(editing.id);
              nav.closeSheet();
              toast('Meta y aportes eliminados');
            }}
          />
        )}
      </form>
    </Sheet>
  );
}
