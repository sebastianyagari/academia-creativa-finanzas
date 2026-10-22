// Capa de datos local (IndexedDB con Dexie), respaldo y migraciones.
export { FinanzasDB, DB_NAME, isInitialized, loadAll, replaceAll } from './database';
export {
  BACKUP_APP_ID,
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupFile,
  type ParseResult,
} from './backup';
export { migrate, MIGRATIONS, MigrationError, type Migration } from './migrations';
export { appDataSchema } from './schema';
