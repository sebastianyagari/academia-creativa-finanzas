/** Metas de ahorro (SPEC 5.2 y Anexo D.15). */
import { monthsBetween } from './dates';
import type { Goal } from './types';

export type GoalStatus = 'en_curso' | 'cumplida' | 'vencida';

export interface GoalProgress {
  saved: number;
  remaining: number;
  /** Meses hasta la fecha límite, contando el actual (mínimo 1); 0 si venció. */
  monthsLeft: number;
  /** Aporte mensual sugerido, redondeado hacia arriba a miles. 0 si cumplida o vencida. */
  suggested: number;
  status: GoalStatus;
}

export function goalProgress(goal: Goal, saved: number, currentMonth: string): GoalProgress {
  const remaining = Math.max(0, goal.target - saved);
  if (remaining === 0) return { saved, remaining, monthsLeft: 0, suggested: 0, status: 'cumplida' };
  // La meta vence cuando su mes límite ya pasó; durante ese mes aún se puede aportar.
  if (goal.deadline < currentMonth)
    return { saved, remaining, monthsLeft: 0, suggested: 0, status: 'vencida' };
  const monthsLeft = Math.max(1, monthsBetween(currentMonth, goal.deadline));
  const suggested = Math.ceil(remaining / monthsLeft / 1000) * 1000;
  return { saved, remaining, monthsLeft, suggested, status: 'en_curso' };
}
