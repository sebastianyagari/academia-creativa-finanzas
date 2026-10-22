import styles from './EmptyState.module.css';

// Estado vacío: siempre una frase útil, nunca una pantalla en blanco (SPEC 8.3).
export function EmptyState({ children }: { children: string }) {
  return <div className={styles.empty}>{children}</div>;
}
