/** Estado de navegación: pestaña, mes y período seleccionados, y la hoja abierta. */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { defaultPeriod, type Kind, type PeriodKind, type TabId } from '../engine';
import { useStore } from './store';

export type SheetState =
  | {
      type: 'tx';
      editId?: string;
      kind?: Kind;
      preset?: { categoryId?: string; amount?: number; toAccountId?: string };
    }
  | { type: 'contrib'; goalId: string; editId?: string }
  | { type: 'debtPay'; debtId: string; editId?: string }
  | { type: 'goal'; editId?: string }
  | { type: 'debt'; editId?: string };

export type Screen = TabId | 'ajustes';

interface NavValue {
  screen: Screen;
  setScreen(screen: Screen): void;
  month: string;
  setMonth(month: string): void;
  period: PeriodKind;
  setPeriod(period: PeriodKind): void;
  sheet: SheetState | null;
  openSheet(sheet: SheetState): void;
  closeSheet(): void;
}

const NavContext = createContext<NavValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const { data, currentMonth } = useStore();
  // Al abrir: la pestaña elegida en el onboarding; Inicio en 6 meses si hay datos
  // de más de un mes (Anexo D.17).
  const [screen, setScreen] = useState<Screen>(() => data.profile.startTab ?? 'inicio');
  const [month, setMonth] = useState(currentMonth);
  const [period, setPeriod] = useState<PeriodKind>(() => defaultPeriod(data.transactions));
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const value = useMemo<NavValue>(
    () => ({
      screen,
      setScreen: (s) => {
        setScreen(s);
        window.scrollTo(0, 0);
      },
      month,
      setMonth,
      period,
      setPeriod,
      sheet,
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
    }),
    [screen, month, period, sheet],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const value = useContext(NavContext);
  if (!value) throw new Error('useNav debe usarse dentro de NavProvider');
  return value;
}
