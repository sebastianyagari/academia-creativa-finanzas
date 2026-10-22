import { describe, expect, it } from 'vitest';
import type { ColombiaRules } from '../../rules/co/types';

// Cada archivo /src/rules/co/AAAA.json debe coincidir con su año y no traer
// cifras legales sin fuente (SPEC 7.1 y 17.4).
const files = import.meta.glob<{ default: ColombiaRules }>('../../rules/co/*.json', {
  eager: true,
});

describe('parámetros de Colombia', () => {
  it('existe al menos un archivo de año', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  for (const [path, mod] of Object.entries(files)) {
    const rules = mod.default;
    const fileYear = Number(path.match(/(\d{4})\.json$/)?.[1]);

    it(`${fileYear}: el año del archivo coincide con su contenido`, () => {
      expect(rules.year).toBe(fileYear);
      expect(rules.version.startsWith(String(fileYear))).toBe(true);
    });

    it(`${fileYear}: toda cifra legal tiene fuente y fecha de verificación`, () => {
      const legal = [rules.smmlv, rules.auxilioTransporte, rules.uvt, rules.usuraEA];
      if (legal.some((v) => v !== null)) {
        expect(rules.sources.length).toBeGreaterThan(0);
        expect(rules.verifiedAt).not.toBeNull();
      }
    });
  }
});
