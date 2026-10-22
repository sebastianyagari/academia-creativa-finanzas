/**
 * Parámetros legales de Colombia para un año (SPEC sección 7.1).
 * Los valores en `null` se completan solo con fuentes oficiales verificadas;
 * nunca se inventan ni se recuerdan.
 */
export interface ColombiaRules {
  year: number;
  version: string;
  verifiedAt: string | null;
  sources: string[];
  smmlv: number | null;
  auxilioTransporte: number | null;
  uvt: number | null;
  usuraEA: number | null;
  primaFechas: { semestre1: string; semestre2: string };
  cesantias: { consignacionFondo: string; interesesAnuales: number; pagoIntereses: string };
}
