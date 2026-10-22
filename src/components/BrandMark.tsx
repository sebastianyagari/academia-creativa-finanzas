import styles from './BrandMark.module.css';

const VARIANTS = {
  // Isotipo: el cerebro solo (proporción 111 × 72).
  isotipo: { file: 'isotipo', ratio: 111 / 72 },
  // Logo vertical: cerebro con "Academia Creativa" debajo (cuadrado).
  vertical: { file: 'logo-vertical', ratio: 1 },
} as const;

/**
 * Logo de Academia Creativa. Morado en modo claro y blanco en modo oscuro;
 * el cambio lo hace el CSS para respetar tanto el sistema como data-theme.
 */
export function BrandMark({
  height = 22,
  variant = 'isotipo',
  label,
}: {
  height?: number;
  variant?: keyof typeof VARIANTS;
  /** Texto alternativo; sin él, el logo es decorativo. */
  label?: string;
}) {
  const { file, ratio } = VARIANTS[variant];
  const width = Math.round(height * ratio);
  return (
    <span
      className={styles.mark}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        className={styles.light}
        src={`/brand/${file}-morado.svg`}
        alt=""
        width={width}
        height={height}
      />
      <img
        className={styles.dark}
        src={`/brand/${file}-blanco.svg`}
        alt=""
        width={width}
        height={height}
      />
    </span>
  );
}
