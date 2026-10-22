import type { IconName } from '../../components/Icon';
import type { TabId } from '../../engine';

export type { TabId };

export interface Tab {
  id: TabId;
  label: string;
  icon: IconName;
}

// Navegación inferior de 5 pestañas (SPEC 6).
export const TABS: readonly Tab[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'movimientos', label: 'Movimientos', icon: 'list' },
  { id: 'presupuesto', label: 'Presupuesto', icon: 'pie' },
  { id: 'metas', label: 'Metas', icon: 'target' },
  { id: 'deudas', label: 'Deudas', icon: 'debt' },
];
