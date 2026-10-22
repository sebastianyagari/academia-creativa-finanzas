/** Textos de fechas y montos para la interfaz (español de Colombia). */
import type { Group, Kind } from '../engine';

export const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-10' → 'Octubre 2026'. */
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

/** '2026-10' → 'oct'. */
export function shortMonth(month: string): string {
  return SHORT[Number(month.slice(5)) - 1]!;
}

/** '2026-10-21' → '21 de octubre'. */
export function dayLabel(date: string): string {
  return `${Number(date.slice(8))} de ${MONTHS[Number(date.slice(5, 7)) - 1]!.toLowerCase()}`;
}

/** Etiqueta de un rango de meses: 'may – oct 2026' o 'nov 2026 – abr 2027'. */
export function rangeLabel(months: string[]): string {
  const a = months[0]!;
  const b = months[months.length - 1]!;
  if (a.slice(0, 4) === b.slice(0, 4))
    return `${shortMonth(a)} – ${shortMonth(b)} ${b.slice(0, 4)}`;
  return `${shortMonth(a)} ${a.slice(0, 4)} – ${shortMonth(b)} ${b.slice(0, 4)}`;
}

/** Monto corto para ejes y centros de gráficos: '$ 2,35 M' o '450 mil'. */
export function compactMoney(n: number): string {
  if (Math.abs(n) >= 1e6) return `$ ${(n / 1e6).toFixed(2).replace('.', ',')} M`;
  return `$ ${Math.round(n / 1000)} mil`;
}

export function axisLabel(n: number): string {
  if (n === 0) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', ',')} M`;
  return `${n / 1000} mil`;
}

/** Grupos de salida en el orden de los seis cubos. */
export type Cube = 'ingresos' | 'facturas' | 'gastos' | 'ahorros' | 'deudas' | 'inversiones';
export const OUT_CUBES: Exclude<Cube, 'ingresos'>[] = [
  'facturas',
  'gastos',
  'ahorros',
  'deudas',
  'inversiones',
];

export const CUBE: Record<Cube, { label: string; color: string }> = {
  ingresos: { label: 'Ingresos', color: 'var(--c-ing)' },
  facturas: { label: 'Facturas', color: 'var(--c-fac)' },
  gastos: { label: 'Gastos', color: 'var(--c-gas)' },
  ahorros: { label: 'Ahorros', color: 'var(--c-aho)' },
  deudas: { label: 'Deudas', color: 'var(--c-deu)' },
  inversiones: { label: 'Inversiones', color: 'var(--c-inv)' },
};

export const GROUP_LABEL: Record<Group, string> = {
  ingresos: 'Ingresos',
  facturas: 'Facturas',
  gastos: 'Gastos',
  inversiones: 'Inversiones',
};

export const KIND: Record<Kind, { label: string; color: string }> = {
  ingreso: { label: 'Ingreso', color: 'var(--c-ing)' },
  factura: { label: 'Factura', color: 'var(--c-fac)' },
  gasto: { label: 'Gasto', color: 'var(--c-gas)' },
  inversion: { label: 'Inversión', color: 'var(--c-inv)' },
  ahorro: { label: 'Ahorro', color: 'var(--c-aho)' },
  pago_deuda: { label: 'Pago de deuda', color: 'var(--c-deu)' },
  transferencia: { label: 'Transferencia', color: 'var(--muted)' },
};
