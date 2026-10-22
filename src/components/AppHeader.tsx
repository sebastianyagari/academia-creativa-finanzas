import { BrandMark } from './BrandMark';
import { Icon } from './Icon';
import styles from './AppHeader.module.css';

export function AppHeader({ title, onSettings }: { title: string; onSettings: () => void }) {
  return (
    <header className={styles.top}>
      <div>
        <div className={styles.brand}>
          <BrandMark height={18} />
          <span>Academia Creativa</span>
          <i className={styles.dot} aria-hidden="true" />
        </div>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <button type="button" className={styles.icon} onClick={onSettings} aria-label="Ajustes">
        <Icon name="gear" size={21} />
      </button>
    </header>
  );
}
