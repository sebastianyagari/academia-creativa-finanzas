import type { IconName } from '../../components/Icon';

export type TabId = 'inicio' | 'movimientos' | 'presupuesto' | 'metas' | 'deudas';

export interface Tab {
  id: TabId;
  label: string;
  /** Título de la cabecera cuando la pestaña está activa. */
  title: string;
  icon: IconName;
  /** Frase del estado vacío mientras la pantalla no existe (Fase 0). */
  empty: string;
}

// Navegación inferior de 5 pestañas (SPEC 6).
export const TABS: readonly Tab[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    title: 'Mis finanzas',
    icon: 'home',
    empty: 'Aquí verás cuánto te queda en el mes, tus pendientes y a dónde va tu dinero.',
  },
  {
    id: 'movimientos',
    label: 'Movimientos',
    title: 'Movimientos',
    icon: 'list',
    empty: 'Aquí verás tus ingresos, gastos y transferencias de cada mes.',
  },
  {
    id: 'presupuesto',
    label: 'Presupuesto',
    title: 'Presupuesto',
    icon: 'pie',
    empty: 'Aquí defines cuánto quieres gastar en cada categoría.',
  },
  {
    id: 'metas',
    label: 'Metas',
    title: 'Metas de ahorro',
    icon: 'target',
    empty: 'Aquí crearás tus metas de ahorro y verás cuánto aportar cada mes.',
  },
  {
    id: 'deudas',
    label: 'Deudas',
    title: 'Deudas',
    icon: 'debt',
    empty: 'Aquí armarás tu plan para salir de deudas con bola de nieve o avalancha.',
  },
];
