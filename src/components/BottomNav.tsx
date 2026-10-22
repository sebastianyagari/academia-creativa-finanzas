import type { Tab, TabId } from '../features/navigation/tabs';
import { Icon } from './Icon';
import styles from './BottomNav.module.css';

interface Props {
  tabs: readonly Tab[];
  current: TabId;
  onSelect: (id: TabId) => void;
}

export function BottomNav({ tabs, current, onSelect }: Props) {
  return (
    <nav className={styles.nav} aria-label="Secciones">
      <div className={styles.inner}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={styles.item}
            aria-current={tab.id === current ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <Icon name={tab.icon} size={23} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
