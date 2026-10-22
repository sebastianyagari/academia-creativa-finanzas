/**
 * Parámetros legales de Colombia por año (SPEC 7.3): se usa el archivo del año
 * en curso; si no existe, el último disponible, y se indica en Ajustes > Acerca de.
 */
import type { ColombiaRules } from './co/types';

const FILES = import.meta.glob<{ default: ColombiaRules }>('./co/*.json', { eager: true });
const ALL = Object.values(FILES)
  .map((m) => m.default)
  .sort((a, b) => a.year - b.year);

export interface LoadedRules {
  rules: ColombiaRules;
  /** true si no hay archivo del año pedido y se usa el último disponible. */
  isFallback: boolean;
}

export function rulesFor(year: number): LoadedRules {
  const exact = ALL.find((r) => r.year === year);
  if (exact) return { rules: exact, isFallback: false };
  const previous = ALL.filter((r) => r.year < year).at(-1) ?? ALL.at(-1);
  if (!previous) throw new Error('No hay archivos de parámetros de Colombia');
  return { rules: previous, isFallback: true };
}

export type { ColombiaRules };
