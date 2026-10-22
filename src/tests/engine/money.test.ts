import { describe, expect, it } from 'vitest';
import { formatCOP, formatPlain, parseMoney } from '../../engine';

describe('formatCOP (SPEC 14, punto 12)', () => {
  it('agrupa miles con puntos y antepone "$ "', () => {
    expect(formatCOP(1234567)).toBe('$ 1.234.567');
    expect(formatCOP(1000)).toBe('$ 1.000');
    expect(formatCOP(999)).toBe('$ 999');
    expect(formatCOP(1_000_000_000)).toBe('$ 1.000.000.000');
  });

  it('muestra el cero sin signo', () => {
    expect(formatCOP(0)).toBe('$ 0');
    expect(formatCOP(-0)).toBe('$ 0');
    expect(formatCOP(-0.4)).toBe('$ 0');
  });

  it('pone el signo de los negativos antes del "$"', () => {
    expect(formatCOP(-5000)).toBe('-$ 5.000');
    expect(formatCOP(-1234567)).toBe('-$ 1.234.567');
  });

  it('redondea decimales solo al mostrar (intereses simulados)', () => {
    expect(formatCOP(1143933.6)).toBe('$ 1.143.934');
    expect(formatCOP(1143934.4)).toBe('$ 1.143.934');
    expect(formatCOP(-2.5)).toBe('-$ 3');
  });

  it('rechaza montos no numéricos', () => {
    expect(() => formatCOP(Number.NaN)).toThrow(RangeError);
    expect(() => formatCOP(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatPlain', () => {
  it('formatea sin "$" para los campos de monto', () => {
    expect(formatPlain(1234567)).toBe('1.234.567');
    expect(formatPlain(0)).toBe('0');
    expect(formatPlain(-5000)).toBe('-5.000');
  });
});

describe('parseMoney', () => {
  it('lee montos con o sin puntos y con "$"', () => {
    expect(parseMoney('1.234.567')).toBe(1234567);
    expect(parseMoney('$ 1.234.567')).toBe(1234567);
    expect(parseMoney('1234567')).toBe(1234567);
  });

  it('descarta la parte decimal después de la coma', () => {
    expect(parseMoney('1.234,50')).toBe(1234);
    expect(parseMoney('0,99')).toBe(0);
  });

  it('devuelve 0 para texto vacío o sin dígitos', () => {
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('$ ')).toBe(0);
    expect(parseMoney('abc')).toBe(0);
  });

  it('nunca devuelve negativos ni decimales', () => {
    expect(parseMoney('-5.000')).toBe(5000);
    expect(Number.isInteger(parseMoney('12.345,67'))).toBe(true);
  });

  it('ida y vuelta con formatCOP', () => {
    for (const n of [0, 7, 1000, 1234567, 98765432]) {
      expect(parseMoney(formatCOP(n))).toBe(n);
    }
  });
});
