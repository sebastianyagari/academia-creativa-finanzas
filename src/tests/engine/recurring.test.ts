import { describe, expect, it } from 'vitest';
import {
  occurrences,
  pendingFor,
  skipFor,
  transactionFromPending,
  type AppData,
  type Recurring,
} from '../../engine';

function rec(fields: Partial<Recurring> & Pick<Recurring, 'schedule'>): Recurring {
  return {
    id: 'r1',
    kind: 'ingreso',
    amount: 1_500_000,
    accountId: 'banco',
    categoryId: 'salario',
    active: true,
    startMonth: '2026-01',
    ...fields,
  };
}

function state(
  recurrings: Recurring[],
): Pick<AppData, 'recurrings' | 'recurringSkips' | 'transactions'> {
  return { recurrings, recurringSkips: [], transactions: [] };
}

describe('fechas programadas (SPEC 14, punto 7)', () => {
  it('mensual', () => {
    expect(occurrences(rec({ schedule: { type: 'mensual', day: 5 } }), '2026-10')).toEqual([
      '2026-10-05',
    ]);
  });

  it('quincenal: 15 y último día del mes (Anexo D.8)', () => {
    const r = rec({ schedule: { type: 'quincenal', days: [15, 31] } });
    expect(occurrences(r, '2026-10')).toEqual(['2026-10-15', '2026-10-31']);
    expect(occurrences(r, '2026-11')).toEqual(['2026-11-15', '2026-11-30']);
    expect(occurrences(r, '2027-02')).toEqual(['2027-02-15', '2027-02-28']);
    expect(occurrences(r, '2028-02')).toEqual(['2028-02-15', '2028-02-29']);
  });

  it('anual: solo en su mes (prima de junio y de diciembre como dos plantillas)', () => {
    const junio = rec({ id: 'pj', schedule: { type: 'anual', month: 6, day: 30 } });
    const diciembre = rec({ id: 'pd', schedule: { type: 'anual', month: 12, day: 20 } });
    expect(occurrences(junio, '2026-06')).toEqual(['2026-06-30']);
    expect(occurrences(junio, '2026-07')).toEqual([]);
    expect(occurrences(diciembre, '2026-12')).toEqual(['2026-12-20']);
  });

  it('día 31 en febrero cae el último día', () => {
    expect(occurrences(rec({ schedule: { type: 'mensual', day: 31 } }), '2026-02')).toEqual([
      '2026-02-28',
    ]);
  });

  it('no genera antes del mes de inicio ni si está pausada', () => {
    expect(
      occurrences(rec({ startMonth: '2026-11', schedule: { type: 'mensual', day: 1 } }), '2026-10'),
    ).toEqual([]);
    expect(
      occurrences(rec({ active: false, schedule: { type: 'mensual', day: 1 } }), '2026-10'),
    ).toEqual([]);
  });
});

describe('pendientes', () => {
  const quincenal = rec({ schedule: { type: 'quincenal', days: [15, 31] } });

  it('muestra un pendiente por fecha programada del mes', () => {
    const p = pendingFor(state([quincenal]), '2026-10');
    expect(p.map((x) => x.scheduledDate)).toEqual(['2026-10-15', '2026-10-31']);
  });

  it('registrar quita el pendiente aunque se cambie la fecha (Anexo D.9)', () => {
    const s = state([quincenal]);
    const [first] = pendingFor(s, '2026-10');
    const t = transactionFromPending(first!, 'tx-1', { date: '2026-10-14', amount: 1_480_000 });
    expect(t).toMatchObject({
      kind: 'ingreso',
      date: '2026-10-14',
      amount: 1_480_000,
      fromRecurringId: 'r1',
      scheduledDate: '2026-10-15',
      categoryId: 'salario',
    });
    s.transactions.push(t);
    expect(pendingFor(s, '2026-10').map((x) => x.scheduledDate)).toEqual(['2026-10-31']);
  });

  it('no duplica: un movimiento manual sin plantilla no cuenta como registrado', () => {
    const s = state([rec({ schedule: { type: 'mensual', day: 5 } })]);
    s.transactions.push({
      id: 'manual',
      kind: 'ingreso',
      date: '2026-10-05',
      amount: 1_500_000,
      accountId: 'banco',
      categoryId: 'salario',
    });
    expect(pendingFor(s, '2026-10')).toHaveLength(1);
  });

  it('registrar en un mes no afecta al mes siguiente', () => {
    const s = state([rec({ schedule: { type: 'mensual', day: 5 } })]);
    s.transactions.push(transactionFromPending(pendingFor(s, '2026-10')[0]!, 'tx-1'));
    expect(pendingFor(s, '2026-10')).toHaveLength(0);
    expect(pendingFor(s, '2026-11')).toHaveLength(1);
  });

  it('omitir este mes', () => {
    const s = state([quincenal]);
    const [, second] = pendingFor(s, '2026-10');
    s.recurringSkips.push(skipFor(second!));
    expect(s.recurringSkips[0]).toEqual({ recurringId: 'r1', month: '2026-10', day: 31 });
    expect(pendingFor(s, '2026-10').map((x) => x.scheduledDate)).toEqual(['2026-10-15']);
  });

  it('copia la nota y los datos de la plantilla', () => {
    const t = transactionFromPending(
      {
        recurringId: 't1',
        scheduledDate: '2026-10-20',
        recurring: rec({
          id: 't1',
          kind: 'transferencia',
          accountId: 'banco',
          toAccountId: 'visa',
          categoryId: undefined,
          note: 'Pago tarjeta',
          schedule: { type: 'mensual', day: 20 },
        }),
      },
      'tx-9',
    );
    expect(t).toEqual({
      id: 'tx-9',
      kind: 'transferencia',
      date: '2026-10-20',
      amount: 1_500_000,
      accountId: 'banco',
      toAccountId: 'visa',
      note: 'Pago tarjeta',
      fromRecurringId: 't1',
      scheduledDate: '2026-10-20',
    });
  });
});
