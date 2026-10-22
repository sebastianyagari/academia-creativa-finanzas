import { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { EmptyState } from './components/EmptyState';
import { TABS, type TabId } from './features/navigation/tabs';
import styles from './App.module.css';

// Esqueleto de la Fase 0: cabecera, pestañas y estados vacíos. Las pantallas
// reales llegan en la Fase 2.
export function App() {
  const [current, setCurrent] = useState<TabId>('inicio');
  const tab = TABS.find((t) => t.id === current) ?? TABS[0]!;

  return (
    <>
      <main className={styles.app}>
        <AppHeader title={tab.title} onSettings={() => undefined} />
        <EmptyState>{tab.empty}</EmptyState>
      </main>
      <BottomNav
        tabs={TABS}
        current={current}
        onSelect={(id) => {
          setCurrent(id);
          window.scrollTo(0, 0);
        }}
      />
    </>
  );
}
