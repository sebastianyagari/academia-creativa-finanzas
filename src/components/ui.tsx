/** Piezas pequeñas de interfaz reutilizables. */
import { useEffect, useState, type ReactNode } from 'react';
import { formatCOP } from '../engine';
import { Icon } from './Icon';
import s from './ui.module.css';

export function Card({
  title,
  action,
  span2,
  children,
}: {
  title?: string;
  action?: ReactNode;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`${s.card} ${span2 ? s.span2 : ''}`}>
      {title && action ? (
        <div className={s.cardHead}>
          <h2>{title}</h2>
          {action}
        </div>
      ) : (
        title && <h2>{title}</h2>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className={s.empty}>{children}</div>;
}

export function Swatch({ color }: { color: string }) {
  return <i className={s.swatch} style={{ background: color }} aria-hidden="true" />;
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad';
const TONE: Record<Tone, string> = {
  neutral: '',
  ok: s.chipOk!,
  warn: s.chipWarn!,
  bad: s.chipBad!,
};

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${s.chip} ${TONE[tone]}`}>{children}</span>;
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={`${s.money} ${className ?? ''}`}>{formatCOP(value)}</span>;
}

export function ProgressBar({
  label,
  value,
  total,
  right,
  color,
  over,
}: {
  label: ReactNode;
  value: number;
  total: number;
  right: ReactNode;
  color?: string;
  over?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className={s.pb}>
      <div className={s.pbHead}>
        <span>{label}</span>
        <span>{right}</span>
      </div>
      <div className={s.track}>
        <i
          style={{ width: `${pct}%`, background: over ? 'var(--bad)' : (color ?? 'var(--accent)') }}
        />
      </div>
    </div>
  );
}

export function MonthBar({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className={s.monthbar}>
      <button type="button" onClick={onPrev} aria-label="Anterior">
        <Icon name="left" size={20} />
      </button>
      <strong aria-live="polite">{label}</strong>
      <button type="button" onClick={onNext} aria-label="Siguiente">
        <Icon name="right" size={20} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * Botón con confirmación en la misma pantalla (SPEC 8.3: sin confirm()).
 * El primer toque cambia el texto; el segundo ejecuta. Se desarma al salir.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  ariaLabel,
}: {
  label: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className ?? `${s.btn} ${s.line}`} ${armed ? s.sure : ''}`}
      aria-label={armed ? confirmLabel : ariaLabel}
      onBlur={() => setArmed(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
