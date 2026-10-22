import styles from './BrandMark.module.css';

/**
 * Isotipo de Academia Creativa. Morado en modo claro y blanco en modo oscuro;
 * el cambio lo hace el CSS para respetar tanto el sistema como data-theme.
 */
export function BrandMark({ height = 22 }: { height?: number }) {
  const width = Math.round((height * 111) / 72);
  return (
    <span className={styles.mark} aria-hidden="true">
      <img
        className={styles.light}
        src="/brand/isotipo-morado.svg"
        alt=""
        width={width}
        height={height}
      />
      <img
        className={styles.dark}
        src="/brand/isotipo-blanco.svg"
        alt=""
        width={width}
        height={height}
      />
    </span>
  );
}
