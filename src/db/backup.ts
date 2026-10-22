/**
 * Respaldo y restauración en archivo (SPEC 9.1 y 9.2).
 */
import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION, todayInColombia, type AppData } from '../engine';
import { loadAll, replaceAll, type FinanzasDB } from './database';
import { migrate } from './migrations';
import { appDataSchema } from './schema';

export const BACKUP_APP_ID = 'academia-creativa-finanzas';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
}

/** Nombre del archivo: academia-finanzas-AAAA-MM-DD.json (fecha de Colombia). */
export function backupFileName(now: Date = new Date()): string {
  return `academia-finanzas-${todayInColombia(now)}.json`;
}

/** Fecha y hora de Colombia con su desfase: 2026-10-21T18:00:00-05:00. */
function colombiaTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  // Colombia no tiene horario de verano: el desfase es siempre -05:00.
  return `${todayInColombia(now)}T${parts.replace(/^24/, '00')}-05:00`;
}

export function createBackup(data: AppData, now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: colombiaTimestamp(now),
    data,
  };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

export type ParseResult =
  | { ok: true; data: AppData; summary: { transactions: number; lastDate: string | null } }
  | { ok: false; reason: 'ilegible' | 'otra_app' | 'version_nueva' | 'invalido'; message: string };

const envelopeSchema = z.object({
  app: z.string(),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  data: z.unknown(),
});

/**
 * Lee un respaldo: valida, migra si es de una versión anterior y resume
 * ("Este respaldo trae N movimientos, hasta <fecha>").
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      reason: 'ilegible',
      message: 'El archivo no se puede leer. ¿Seguro que es un respaldo?',
    };
  }
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success || envelope.data.app !== BACKUP_APP_ID) {
    return {
      ok: false,
      reason: 'otra_app',
      message: 'Este archivo no es un respaldo de Academia Creativa Finanzas.',
    };
  }
  if (envelope.data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'version_nueva',
      message: 'Actualiza la app para abrir este respaldo.',
    };
  }
  let migrated: unknown;
  try {
    migrated = migrate(envelope.data.data, envelope.data.schemaVersion);
  } catch {
    return { ok: false, reason: 'invalido', message: 'El respaldo está dañado o incompleto.' };
  }
  const parsed = appDataSchema.safeParse(migrated);
  if (!parsed.success) {
    return { ok: false, reason: 'invalido', message: 'El respaldo está dañado o incompleto.' };
  }
  const data: AppData = {
    ...parsed.data,
    settings: { ...parsed.data.settings, schemaVersion: CURRENT_SCHEMA_VERSION },
  };
  const lastDate = data.transactions.reduce<string | null>(
    (max, t) => (max === null || t.date > max ? t.date : max),
    null,
  );
  return { ok: true, data, summary: { transactions: data.transactions.length, lastDate } };
}

/**
 * Reemplaza los datos actuales por los del respaldo. Devuelve una copia de lo
 * que había antes, para poder deshacer durante la sesión (SPEC 9.2 paso 4).
 */
export async function restoreBackup(db: FinanzasDB, data: AppData): Promise<AppData> {
  const previous = await loadAll(db);
  await replaceAll(db, data);
  return previous;
}
