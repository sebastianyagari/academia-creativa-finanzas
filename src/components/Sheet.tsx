import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Sheet.module.css';

/**
 * Hoja inferior para formularios (SPEC 6.3). En escritorio se centra.
 * Cierra con Escape, con la X o tocando fuera. Enfoca el primer campo vacío.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([disabled]), select, textarea',
    );
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <div className={styles.head}>
          <h2>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
