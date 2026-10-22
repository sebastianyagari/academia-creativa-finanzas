/**
 * Migraciones de datos (SPEC 9.5). Cada cambio de estructura sube
 * CURRENT_SCHEMA_VERSION y agrega aquí `migrate_vN_to_vN+1`, con su prueba
 * usando un respaldo real de la versión N en /src/tests/fixtures.
 *
 * Corren al restaurar un respaldo (y, cuando exista la v2, al abrir la app vía
 * el .upgrade() de Dexie, que debe llamar a la misma función).
 */
import { CURRENT_SCHEMA_VERSION } from '../../engine';

/** Recibe los datos de la versión N y devuelve los de la N+1. Nunca borra campos sin migrarlos. */
export type Migration = (data: unknown) => unknown;

/** Clave = versión de origen. Hoy vacío: la v1 es la primera. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export class MigrationError extends Error {}

/** Lleva datos de `fromVersion` a `toVersion` aplicando cada paso en orden. */
export function migrate(
  data: unknown,
  fromVersion: number,
  toVersion: number = CURRENT_SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): unknown {
  if (fromVersion > toVersion) {
    throw new MigrationError(`No se puede bajar de la versión ${fromVersion} a la ${toVersion}`);
  }
  let current = data;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrations[v];
    if (!step) throw new MigrationError(`Falta la migración de la versión ${v} a la ${v + 1}`);
    current = step(current);
  }
  return current;
}
