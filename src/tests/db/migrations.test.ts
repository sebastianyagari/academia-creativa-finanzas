import { describe, expect, it } from 'vitest';
import { migrate, MigrationError, parseBackup } from '../../db';
import {
  CURRENT_SCHEMA_VERSION,
  debtBalance,
  netWorth,
  simDebts,
  simulate,
  totalsFor,
  monthRange,
} from '../../engine';
import v1 from '../fixtures/backup-v1.json';

// Un respaldo real por cada versión anterior. Al crear la v2, agregar aquí backup-v2.json.
const FIXTURES = { 1: v1 } as const;

describe('migraciones (SPEC 14, punto 11)', () => {
  for (const [version, fixture] of Object.entries(FIXTURES)) {
    it(`un respaldo de la versión ${version} abre en la versión actual y sus cálculos funcionan`, () => {
      const parsed = parseBackup(JSON.stringify(fixture));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const data = parsed.data;
      expect(data.settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

      // Cálculos sobre los datos migrados: los mismos que prueba el engine.
      const oct = totalsFor(data.transactions, monthRange('2026-10'));
      expect(oct).toMatchObject({
        ingresos: 1_700_000,
        facturas: 750_000,
        gastos: 120_000 + 75_000,
        ahorros: 200_000,
        deudas: 185_000,
      });
      const visa = data.debts.find((d) => d.id === 'd-visa')!;
      expect(debtBalance(visa, data)).toBe(3_200_000 + 120_000 - 400_000);
      expect(netWorth(data).netWorth).toBeTypeOf('number');
      expect(
        simulate(simDebts(data), data.settings.strategy, data.settings.extraPayment).finished,
      ).toBe(true);
    });
  }
});

describe('ejecutor de migraciones', () => {
  const steps = {
    1: (d: unknown) => ({ ...(d as object), paso1: true }),
    2: (d: unknown) => ({ ...(d as object), paso2: true }),
  };

  it('aplica cada paso en orden', () => {
    expect(migrate({ a: 1 }, 1, 3, steps)).toEqual({ a: 1, paso1: true, paso2: true });
  });

  it('misma versión: no cambia nada', () => {
    const data = { a: 1 };
    expect(migrate(data, 3, 3, steps)).toBe(data);
  });

  it('falla si falta un paso o si se pide bajar de versión', () => {
    expect(() => migrate({}, 1, 4, steps)).toThrow(MigrationError);
    expect(() => migrate({}, 3, 2, steps)).toThrow(MigrationError);
  });
});
