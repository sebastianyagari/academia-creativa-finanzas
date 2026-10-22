/** Gráficos SVG propios, como en el prototipo (SPEC 3: sin librería de gráficos). */
import { formatCOP } from '../engine';
import { axisLabel, compactMoney, monthLabel, shortMonth } from './format';
import { Empty, Swatch } from './ui';
import styles from './Charts.module.css';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Donut "A dónde va mi dinero": cada segmento con su leyenda en texto y porcentaje. */
export function Donut({ slices, center = 'Salió' }: { slices: Slice[]; center?: string }) {
  const items = slices.filter((x) => x.value > 0);
  const total = items.reduce((sum, x) => sum + x.value, 0);
  if (!total) {
    return <Empty>Aún no hay salidas en este período. Registra la primera con el botón +.</Empty>;
  }
  const R = 52;
  const C = 2 * Math.PI * R;
  // Largo de cada segmento y dónde empieza (suma de los anteriores).
  const lengths = items.map((x) => (C * x.value) / total);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className={styles.donutWrap}>
      <svg
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Distribución de salidas: ${formatCOP(total)}`}
      >
        {items.map((x, i) => (
          <circle
            key={x.label}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            strokeWidth="22"
            style={{ stroke: x.color }}
            strokeDasharray={`${Math.max(lengths[i]! - 1.5, 0.5)} ${C}`}
            strokeDashoffset={-starts[i]!}
            transform="rotate(-90 70 70)"
          >
            <title>{`${x.label}: ${formatCOP(x.value)}`}</title>
          </circle>
        ))}
        <text x="70" y="66" textAnchor="middle" className={styles.centerLabel}>
          {center}
        </text>
        <text x="70" y="84" textAnchor="middle" className={styles.centerValue}>
          {compactMoney(total)}
        </text>
      </svg>
      <div className={styles.legend}>
        {items.map((x) => (
          <div key={x.label}>
            <Swatch color={x.color} />
            <span>{x.label}</span>
            <span className={styles.value}>{formatCOP(x.value)}</span>
            <span className={styles.pct}>{Math.round((x.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface MonthBars {
  month: string;
  in: number;
  out: number;
}

/** Barras de entró y salió por mes. */
export function Bars({ data }: { data: MonthBars[] }) {
  const max = Math.max(0, ...data.map((d) => Math.max(d.in, d.out)));
  if (!max) {
    return (
      <Empty>
        Cuando registres movimientos verás aquí cómo cambian tus ingresos y salidas mes a mes.
      </Empty>
    );
  }
  const step = max > 4e6 ? 1e6 : 500_000;
  const top = Math.ceil(max / step) * step;
  const x0 = 50;
  const x1 = 336;
  const y0 = 14;
  const y1 = 134;
  const w = (x1 - x0) / data.length;
  const bw = data.length > 6 ? 9 : 16;
  return (
    <div className={styles.chartWrap}>
      <svg viewBox="0 0 340 158" role="img" aria-label="Ingresos y salidas por mes">
        {[0, 0.5, 1].map((f) => {
          const y = y1 - (y1 - y0) * f;
          return (
            <g key={f}>
              <line x1={x0} x2={x1} y1={y} y2={y} className={styles.grid} />
              <text x={x0 - 6} y={y + 3.5} textAnchor="end" className={styles.axis}>
                {axisLabel(top * f)}
              </text>
            </g>
          );
        })}
        {data.map((d, k) => {
          const bx = x0 + k * w + w / 2 - bw - 1;
          const hi = ((y1 - y0) * d.in) / top;
          const ho = ((y1 - y0) * d.out) / top;
          return (
            <g key={d.month}>
              <rect
                x={bx}
                y={y1 - hi}
                width={bw}
                height={hi}
                rx="2.5"
                style={{ fill: 'var(--c-ing)' }}
              >
                <title>{`${monthLabel(d.month)} · Entró ${formatCOP(d.in)}`}</title>
              </rect>
              <rect
                x={bx + bw + 2}
                y={y1 - ho}
                width={bw}
                height={ho}
                rx="2.5"
                style={{ fill: 'var(--accent)' }}
              >
                <title>{`${monthLabel(d.month)} · Salió ${formatCOP(d.out)}`}</title>
              </rect>
              <text x={bx + bw + 1} y="150" textAnchor="middle" className={styles.axis}>
                {shortMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.key}>
        <span>
          <Swatch color="var(--c-ing)" />
          Entró
        </span>
        <span>
          <Swatch color="var(--accent)" />
          Salió
        </span>
      </div>
    </div>
  );
}
