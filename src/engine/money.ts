/**
 * Dinero en pesos colombianos (COP), siempre enteros (SPEC secciones 1 y 2).
 * Formato: `$ 1.234.567`, puntos como separador de miles, sin decimales.
 */

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

/** Agrupa un entero no negativo con puntos: 1234567 → "1.234.567". */
function group(n: number): string {
  return String(n).replace(THOUSANDS, '.');
}

/**
 * Formatea un monto en pesos: 1234567 → "$ 1.234.567", -5000 → "-$ 5.000".
 * Valores con decimales (p. ej. intereses simulados) se redondean solo al mostrar.
 * Un monto que redondea a cero se muestra "$ 0", sin signo.
 */
export function formatCOP(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Monto inválido: ${amount}`);
  }
  const abs = Math.round(Math.abs(amount));
  const sign = amount < 0 && abs !== 0 ? '-' : '';
  return `${sign}$ ${group(abs)}`;
}

/** Igual que formatCOP pero sin "$": para campos de monto mientras se escribe. */
export function formatPlain(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Monto inválido: ${amount}`);
  }
  const abs = Math.round(Math.abs(amount));
  return (amount < 0 && abs !== 0 ? '-' : '') + group(abs);
}

/**
 * Lee lo que la persona escribe en un campo de monto y devuelve pesos enteros.
 * Los puntos son separadores de miles y se ignoran; la coma es separador decimal,
 * así que todo lo que va después de la primera coma se descarta ("1.234,50" → 1234).
 * Texto vacío o sin dígitos → 0. Nunca devuelve negativos.
 */
export function parseMoney(text: string): number {
  const integerPart = text.split(',')[0] ?? '';
  const digits = integerPart.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}
