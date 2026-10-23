import { BottomNav } from './components/BottomNav';
import { Icon } from './components/Icon';
import { ToastProvider } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Ajustes } from './features/ajustes/Ajustes';
import { RecurringSheet } from './features/ajustes/RecurringSheet';
import { DebtSheet } from './features/deudas/DebtSheet';
import { Deudas } from './features/deudas/Deudas';
import { Inicio } from './features/inicio/Inicio';
import { GoalSheet } from './features/metas/GoalSheet';
import { Metas } from './features/metas/Metas';
import { Movimientos } from './features/movimientos/Movimientos';
import { TABS } from './features/navigation/tabs';
import { Presupuesto } from './features/presupuesto/Presupuesto';
import { ContributionSheet, DebtPaymentSheet } from './features/registrar/SimpleMovementSheet';
import { TransactionSheet } from './features/registrar/TransactionSheet';
import { Onboarding } from './features/onboarding/Onboarding';
import { NavProvider, useNav, type SheetState } from './state/nav';
import { StoreProvider, useStore } from './state/store';
import styles from './App.module.css';

export function App() {
  return (
    <StoreProvider>
      <NavProvider>
        <ToastProvider>
          <Shell />
          <UpdatePrompt />
        </ToastProvider>
      </NavProvider>
    </StoreProvider>
  );
}

const SCREENS = {
  inicio: Inicio,
  movimientos: Movimientos,
  presupuesto: Presupuesto,
  metas: Metas,
  deudas: Deudas,
  ajustes: Ajustes,
};

function Shell() {
  const { data } = useStore();
  const nav = useNav();
  // Primera vez (sin ejemplo cargado) o repetido desde Ajustes (SPEC 6.1).
  if ((!data.profile.onboardingDone && !data.settings.isDemo) || nav.repeatingOnboarding) {
    return <Onboarding repeat={nav.repeatingOnboarding} />;
  }
  const Screen = SCREENS[nav.screen];
  return (
    <>
      <main className={styles.app}>
        <Screen />
      </main>
      {!nav.sheet && (
        <button
          type="button"
          className={styles.fab}
          aria-label="Registrar movimiento"
          onClick={() => nav.openSheet({ type: 'tx' })}
        >
          <Icon name="plus" size={28} />
          <i aria-hidden="true" />
        </button>
      )}
      <BottomNav
        tabs={TABS}
        current={nav.screen === 'ajustes' ? null : nav.screen}
        onSelect={nav.setScreen}
      />
      {nav.sheet && <OpenSheet sheet={nav.sheet} />}
    </>
  );
}

function OpenSheet({ sheet }: { sheet: SheetState }) {
  // La key fuerza un formulario nuevo al abrir otra hoja.
  const key = JSON.stringify(sheet);
  switch (sheet.type) {
    case 'tx':
      return (
        <TransactionSheet
          key={key}
          editId={sheet.editId}
          kind={sheet.kind}
          preset={sheet.preset}
          pending={sheet.pending}
        />
      );
    case 'contrib':
      return (
        <ContributionSheet
          key={key}
          goalId={sheet.goalId}
          editId={sheet.editId}
          pending={sheet.pending}
        />
      );
    case 'debtPay':
      return (
        <DebtPaymentSheet
          key={key}
          debtId={sheet.debtId}
          editId={sheet.editId}
          pending={sheet.pending}
        />
      );
    case 'recurring':
      return <RecurringSheet key={key} id={sheet.id} />;
    case 'goal':
      return <GoalSheet key={key} editId={sheet.editId} />;
    case 'debt':
      return <DebtSheet key={key} editId={sheet.editId} />;
  }
}
