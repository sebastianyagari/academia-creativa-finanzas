import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FinanzasDB, loadAll, replaceAll, repo } from '../../db';
import { createCard, createDefaultData, pendingFor, repeatMonthly } from '../../engine';
import { idGen, tx } from '../helpers';

let db: FinanzasDB;
let n = 0;

beforeEach(async () => {
  db = new FinanzasDB(`repo-${++n}`);
  await replaceAll(db, createDefaultData(idGen('d')));
});

afterEach(async () => {
  await db.delete();
});

describe('escrituras de la Fase 3', () => {
  it('guarda un movimiento con su plantilla mensual en una sola operación', async () => {
    const data = await loadAll(db);
    const bank = data.accounts[3]!.id;
    const { transaction, recurring } = repeatMonthly(
      tx({
        id: 't1',
        kind: 'ingreso',
        date: '2026-10-15',
        amount: 1_700_000,
        accountId: bank,
        categoryId: data.categories[0]!.id,
      }),
      'r1',
    );
    await repo.putTransaction(db, transaction, recurring);
    const after = await loadAll(db);
    expect(after.recurrings).toEqual([recurring]);
    expect(pendingFor(after, '2026-10')).toEqual([]);
    expect(pendingFor(after, '2026-11')).toHaveLength(1);
  });

  it('borrar una plantilla borra sus omisiones y conserva los movimientos', async () => {
    const data = await loadAll(db);
    const bank = data.accounts[3]!.id;
    const { transaction, recurring } = repeatMonthly(
      tx({
        id: 't2',
        kind: 'gasto',
        date: '2026-10-01',
        amount: 50_000,
        accountId: bank,
        categoryId: data.categories[10]!.id,
      }),
      'r2',
    );
    await repo.putTransaction(db, transaction, recurring);
    await repo.putSkip(db, { recurringId: 'r2', month: '2026-11', day: 1 });
    await repo.deleteRecurring(db, 'r2');
    const after = await loadAll(db);
    expect(after.recurrings).toEqual([]);
    expect(after.recurringSkips).toEqual([]);
    expect(after.transactions.map((t) => t.id)).toEqual(['t2']);
  });

  it('crea una tarjeta y al archivarla archiva también su deuda', async () => {
    const { account, debt } = createCard(
      { name: 'Visa', currentDebt: 500_000, rateEA: 27, minPayment: 40_000, order: 4 },
      idGen('c'),
    );
    await repo.createCard(db, account, debt);
    let data = await loadAll(db);
    expect(data.accounts.at(-1)).toEqual(account);
    expect(data.debts).toEqual([debt]);

    await repo.archiveAccount(db, account.id);
    data = await loadAll(db);
    expect(data.accounts.find((a) => a.id === account.id)?.archived).toBe(true);
    expect(data.debts[0]?.archived).toBe(true);
  });
});
