import { describe, expect, it } from 'vitest';
import { goalProgress, type Goal } from '../../engine';

const goal: Goal = {
  id: 'g',
  name: 'Fondo de emergencia',
  target: 6_000_000,
  openingSaved: 0,
  deadline: '2027-08',
  archived: false,
};

describe('metas de ahorro (SPEC 14, punto 6)', () => {
  it('aporte sugerido redondeado hacia arriba a miles', () => {
    // Faltan 4.100.000 en 10 meses → 410.000.
    expect(goalProgress(goal, 1_900_000, '2026-10')).toEqual({
      saved: 1_900_000,
      remaining: 4_100_000,
      monthsLeft: 10,
      suggested: 410_000,
      status: 'en_curso',
    });
    // Faltan 1.000.000 en 3 meses → 333.333,33 → 334.000.
    expect(goalProgress({ ...goal, deadline: '2027-01' }, 5_000_000, '2026-10').suggested).toBe(
      334_000,
    );
  });

  it('meta cumplida: aporte 0', () => {
    const p = goalProgress(goal, 6_500_000, '2026-10');
    expect(p.status).toBe('cumplida');
    expect(p.remaining).toBe(0);
    expect(p.suggested).toBe(0);
  });

  it('en el mes límite todavía se sugiere aportar lo que falta', () => {
    const p = goalProgress({ ...goal, deadline: '2026-10' }, 5_500_000, '2026-10');
    expect(p).toMatchObject({ status: 'en_curso', monthsLeft: 1, suggested: 500_000 });
  });

  it('fecha pasada: "Fecha vencida", sin aporte sugerido (Anexo D.15)', () => {
    const p = goalProgress({ ...goal, deadline: '2026-09' }, 1_000_000, '2026-10');
    expect(p).toMatchObject({
      status: 'vencida',
      remaining: 5_000_000,
      suggested: 0,
      monthsLeft: 0,
    });
  });
});
