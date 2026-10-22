/**
 * Orden de cuentas y categorías (Anexo D.23). Las cuentas forman una sola
 * lista; las categorías se ordenan dentro de su grupo y "Otros" va siempre al final.
 */
import type { Account, Category, Group } from './types';

interface Ordered {
  id: string;
  order: number;
}

/** Copia ordenada por `order`; a igual orden, por nombre (estable y predecible). */
export function sortByOrder<T extends Ordered & { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
}

/** Categorías de un grupo en el orden en que se muestran: "Otros" siempre al final. */
export function categoriesOf(categories: readonly Category[], group: Group): Category[] {
  const inGroup = sortByOrder(categories.filter((c) => c.group === group));
  return [...inGroup.filter((c) => !c.isOther), ...inGroup.filter((c) => c.isOther)];
}

/** Posición para una cuenta nueva: al final de la lista. */
export function nextAccountOrder(accounts: readonly Account[]): number {
  return accounts.reduce((max, a) => Math.max(max, a.order), -1) + 1;
}

/**
 * Agrega una categoría al final de su grupo, justo antes de "Otros".
 * Devuelve la lista completa con las posiciones del grupo renumeradas.
 */
export function insertCategory(categories: readonly Category[], created: Category): Category[] {
  const group = categoriesOf(categories, created.group);
  const others = group.filter((c) => c.isOther);
  const regular = group.filter((c) => !c.isOther);
  return renumber(categories, [...regular, created, ...others]);
}

/**
 * Mueve un elemento a otra posición dentro de su lista (cuentas, o categorías
 * de un mismo grupo) y renumera esa lista. "Otros" no se mueve: sigue al final.
 */
export function moveCategory(
  categories: readonly Category[],
  id: string,
  toIndex: number,
): Category[] {
  const moving = categories.find((c) => c.id === id);
  if (!moving || moving.isOther) return [...categories];
  const regular = categoriesOf(categories, moving.group).filter((c) => !c.isOther);
  const others = categories.filter((c) => c.group === moving.group && c.isOther);
  return renumber(categories, [...moveIn(regular, id, toIndex), ...others]);
}

export function moveAccount(accounts: readonly Account[], id: string, toIndex: number): Account[] {
  return renumber(accounts, moveIn(sortByOrder(accounts), id, toIndex));
}

function moveIn<T extends Ordered>(list: T[], id: string, toIndex: number): T[] {
  const from = list.findIndex((x) => x.id === id);
  if (from < 0) return list;
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(toIndex, out.length)), 0, item!);
  return out;
}

/** Asigna order = posición a los elementos de `sequence` y deja el resto igual. */
function renumber<T extends Ordered>(all: readonly T[], sequence: T[]): T[] {
  const position = new Map(sequence.map((x, i) => [x.id, i]));
  const byId = new Map(sequence.map((x) => [x.id, x]));
  const out = all.map((x) => {
    const i = position.get(x.id);
    return i === undefined ? x : { ...x, order: i };
  });
  // Agrega lo que venga en `sequence` y aún no esté en la lista (una categoría nueva).
  for (const [itemId, item] of byId) {
    if (!all.some((x) => x.id === itemId)) out.push({ ...item, order: position.get(itemId)! });
  }
  return out;
}
