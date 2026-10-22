import { describe, expect, it } from 'vitest';
import {
  categoriesOf,
  createDefaultData,
  insertCategory,
  moveAccount,
  moveCategory,
  nextAccountOrder,
  sortByOrder,
  type Category,
} from '../../engine';
import { idGen, makeData } from '../helpers';

const names = (list: { name: string }[]) => list.map((x) => x.name);

describe('orden por defecto (SPEC 4.4)', () => {
  it('las categorías salen en el orden de la SPEC, con "Otros" al final', () => {
    const data = createDefaultData(idGen('c'));
    expect(names(categoriesOf(data.categories, 'ingresos'))).toEqual([
      'Salario',
      'Honorarios o trabajo independiente',
      'Ventas',
      'Prima de servicios',
      'Cesantías e intereses',
      'Ingresos extra',
      'Otros ingresos',
    ]);
    expect(names(categoriesOf(data.categories, 'gastos')).slice(-2)).toEqual([
      'Intereses y cuotas de manejo',
      'Otros gastos',
    ]);
  });

  it('el orden no depende de los ids ni del orden en que llegan', () => {
    const data = createDefaultData(() => crypto.randomUUID());
    const shuffled = [...data.categories].reverse();
    expect(names(categoriesOf(shuffled, 'inversiones'))).toEqual([
      'CDT',
      'Fondo de inversión',
      'Acciones o ETF',
      'Otras inversiones',
    ]);
    expect(names(sortByOrder([...data.accounts].reverse()))).toEqual([
      'Efectivo',
      'Nequi',
      'Daviplata',
      'Cuenta de ahorros',
    ]);
  });
});

describe('agregar', () => {
  it('una categoría nueva queda al final de su grupo, antes de "Otros"', () => {
    const data = createDefaultData(idGen('c'));
    const created: Category = {
      id: 'nueva',
      group: 'inversiones',
      name: 'Criptomonedas',
      budget: 0,
      isOther: false,
      isSystem: false,
      archived: false,
      order: 0,
    };
    const updated = insertCategory(data.categories, created);
    expect(updated).toHaveLength(data.categories.length + 1);
    expect(names(categoriesOf(updated, 'inversiones'))).toEqual([
      'CDT',
      'Fondo de inversión',
      'Acciones o ETF',
      'Criptomonedas',
      'Otras inversiones',
    ]);
    // Otros grupos no cambian.
    expect(categoriesOf(updated, 'gastos')).toEqual(categoriesOf(data.categories, 'gastos'));
  });

  it('una cuenta nueva va al final', () => {
    expect(nextAccountOrder(makeData().accounts)).toBe(3);
    expect(nextAccountOrder([])).toBe(0);
  });
});

describe('reordenar (Anexo D.23)', () => {
  it('mueve una categoría dentro de su grupo', () => {
    const data = createDefaultData(idGen('c'));
    const mercado = data.categories.find((c) => c.name === 'Mercado')!;
    const moved = moveCategory(data.categories, mercado.id, 3);
    expect(names(categoriesOf(moved, 'gastos')).slice(0, 4)).toEqual([
      'Vivienda o arriendo',
      'Transporte',
      'Comida fuera',
      'Mercado',
    ]);
    expect(categoriesOf(moved, 'facturas')).toEqual(categoriesOf(data.categories, 'facturas'));
  });

  it('"Otros" no se mueve y nada puede pasar detrás de él', () => {
    const data = createDefaultData(idGen('c'));
    const otros = data.categories.find((c) => c.name === 'Otros ingresos')!;
    expect(categoriesOf(moveCategory(data.categories, otros.id, 0), 'ingresos')).toEqual(
      categoriesOf(data.categories, 'ingresos'),
    );
    const salario = data.categories.find((c) => c.name === 'Salario')!;
    const last = names(categoriesOf(moveCategory(data.categories, salario.id, 99), 'ingresos'));
    expect(last.slice(-2)).toEqual(['Salario', 'Otros ingresos']);
  });

  it('mueve una cuenta y renumera la lista', () => {
    const moved = moveAccount(makeData().accounts, 'visa', 0);
    expect(sortByOrder(moved).map((a) => [a.id, a.order])).toEqual([
      ['visa', 0],
      ['banco', 1],
      ['nequi', 2],
    ]);
  });

  it('un id que no existe no cambia nada', () => {
    const accounts = makeData().accounts;
    expect(moveAccount(accounts, 'no-existe', 0)).toEqual(accounts);
  });
});
