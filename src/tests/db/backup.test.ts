import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  backupFileName,
  createBackup,
  FinanzasDB,
  isInitialized,
  loadAll,
  parseBackup,
  replaceAll,
  restoreBackup,
  serializeBackup,
} from '../../db';
import { CURRENT_SCHEMA_VERSION, createDefaultData, type AppData } from '../../engine';
import fixture from '../fixtures/backup-v1.json';
import { idGen, tx } from '../helpers';

let db: FinanzasDB;
let n = 0;

beforeEach(async () => {
  db = new FinanzasDB(`prueba-${++n}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

/** IndexedDB devuelve las filas ordenadas por clave: se compara sin importar el orden. */
function normalized(data: AppData) {
  const byKey = <T>(rows: T[], key: (r: T) => string) =>
    [...rows].sort((a, b) => key(a).localeCompare(key(b)));
  return {
    ...data,
    accounts: byKey(data.accounts, (r) => r.id),
    categories: byKey(data.categories, (r) => r.id),
    transactions: byKey(data.transactions, (r) => r.id),
    recurrings: byKey(data.recurrings, (r) => r.id),
    recurringSkips: byKey(data.recurringSkips, (r) => `${r.recurringId}|${r.month}|${r.day}`),
    goals: byKey(data.goals, (r) => r.id),
    debts: byKey(data.debts, (r) => r.id),
  };
}

function sampleData(): AppData {
  const data = createDefaultData(idGen('x'));
  const bank = data.accounts[3]!.id;
  data.transactions = [
    tx({
      id: 't-b',
      kind: 'ingreso',
      date: '2026-10-15',
      amount: 1_700_000,
      accountId: bank,
      categoryId: data.categories[0]!.id,
    }),
    tx({
      id: 't-a',
      kind: 'gasto',
      date: '2026-09-02',
      amount: 35_000,
      accountId: bank,
      categoryId: data.categories[20]!.id,
      note: 'Café',
    }),
  ];
  data.goals = [
    {
      id: 'g',
      name: 'Viaje',
      target: 2_500_000,
      openingSaved: 0,
      deadline: '2027-04',
      archived: false,
    },
  ];
  data.recurringSkips = [{ recurringId: 'r', month: '2026-10', day: 15 }];
  data.profile = { ...data.profile, name: 'Ana', onboardingDone: true };
  return data;
}

describe('base local', () => {
  it('guarda y lee todos los datos', async () => {
    expect(await isInitialized(db)).toBe(false);
    const data = sampleData();
    await replaceAll(db, data);
    expect(await isInitialized(db)).toBe(true);
    const loaded = await loadAll(db);
    expect(normalized(loaded)).toEqual(normalized(data));
    // Los movimientos salen ordenados por fecha.
    expect(loaded.transactions.map((t) => t.date)).toEqual(['2026-09-02', '2026-10-15']);
  });

  it('reemplazar es todo o nada: un dato inválido no deja la base a medias', async () => {
    const first = sampleData();
    await replaceAll(db, first);
    const broken = sampleData();
    broken.accounts.push({ ...broken.accounts[0]! }); // id repetido → bulkAdd falla
    broken.profile = { ...broken.profile, name: 'Otra' };
    await expect(replaceAll(db, broken)).rejects.toThrow();
    expect((await loadAll(db)).profile.name).toBe('Ana');
  });
});

describe('respaldo (SPEC 14, punto 10)', () => {
  it('ida y vuelta: exportar y restaurar da los mismos datos', async () => {
    const data = sampleData();
    await replaceAll(db, data);
    const text = serializeBackup(createBackup(await loadAll(db), new Date('2026-10-21T23:00:00Z')));

    const other = new FinanzasDB(`prueba-otra-${n}`);
    await replaceAll(other, createDefaultData());
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toEqual({ transactions: 2, lastDate: '2026-10-15' });
    await restoreBackup(other, parsed.data);
    expect(normalized(await loadAll(other))).toEqual(normalized(data));
    await other.delete();
  });

  it('el archivo trae la envoltura de la SPEC 9.1 con hora de Colombia', () => {
    const file = createBackup(sampleData(), new Date('2026-10-21T23:00:00Z'));
    expect(file.app).toBe('academia-creativa-finanzas');
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(file.exportedAt).toBe('2026-10-21T18:00:00-05:00');
    expect(backupFileName(new Date('2026-10-22T03:00:00Z'))).toBe(
      'academia-finanzas-2026-10-21.json',
    );
  });

  it('restaurar devuelve una copia de lo anterior para deshacer', async () => {
    const before = sampleData();
    await replaceAll(db, before);
    const parsed = parseBackup(JSON.stringify(fixture));
    if (!parsed.ok) throw new Error(parsed.message);
    const previous = await restoreBackup(db, parsed.data);
    expect((await loadAll(db)).profile.name).toBe('Sebastián');
    await replaceAll(db, previous);
    expect((await loadAll(db)).profile.name).toBe('Ana');
  });

  it('archivo corrupto: no es JSON', () => {
    expect(parseBackup('{esto no es json')).toMatchObject({ ok: false, reason: 'ilegible' });
  });

  it('archivo de otra app', () => {
    expect(parseBackup(JSON.stringify({ hola: 1 }))).toMatchObject({
      ok: false,
      reason: 'otra_app',
    });
    expect(parseBackup(JSON.stringify({ ...fixture, app: 'otra' }))).toMatchObject({
      ok: false,
      reason: 'otra_app',
    });
  });

  it('archivo con datos dañados: monto con decimales o campo faltante', () => {
    const decimals = structuredClone(fixture);
    decimals.data.transactions[0]!.amount = 1500.5;
    expect(parseBackup(JSON.stringify(decimals))).toMatchObject({ ok: false, reason: 'invalido' });

    const missing = structuredClone(fixture) as { data: Record<string, unknown> };
    delete missing.data.accounts;
    expect(parseBackup(JSON.stringify(missing))).toMatchObject({ ok: false, reason: 'invalido' });
  });

  it('archivo de una versión más nueva: "Actualiza la app para abrir este respaldo"', () => {
    const newer = { ...fixture, schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(parseBackup(JSON.stringify(newer))).toEqual({
      ok: false,
      reason: 'version_nueva',
      message: 'Actualiza la app para abrir este respaldo.',
    });
  });
});
