import { expect, test, type Page } from '@playwright/test';
import { openDemo } from './helpers';

// Cada prueba abre un navegador limpio con los datos de ejemplo.

async function tab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name }).click();
}

function card(page: Page, heading: string) {
  return page.locator('section', {
    has: page.getByRole('heading', { name: heading, exact: true }),
  });
}

async function openRegister(page: Page) {
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  return page.getByRole('dialog', { name: 'Registrar movimiento' });
}

test('una transferencia mueve saldo entre cuentas sin cambiar los totales (SPEC 4.2)', async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Mes', exact: true }).click();
  const hero = page.locator('section', { hasText: 'Te queda en' });
  const before = await hero.innerText();
  const accounts = card(page, 'Cuentas y patrimonio');
  await expect(accounts).toContainText('Nequi$ 420.000');

  const sheet = await openRegister(page);
  await sheet.getByRole('button', { name: 'Transferencia' }).click();
  await sheet.getByLabel('Monto').fill('100000');
  await sheet.getByLabel('Sale de').selectOption({ label: 'Bancolombia ahorros' });
  await sheet.getByLabel('Entra a').selectOption({ label: 'Nequi' });
  await sheet.getByRole('button', { name: 'Guardar' }).click();

  await expect(accounts).toContainText('Nequi$ 520.000');
  await expect(accounts).toContainText('Bancolombia ahorros$ 2.250.000');
  expect(await hero.innerText()).toBe(before);
});

test('tarjeta de crédito: crear, comprar y pagar con transferencia (SPEC 4.3)', async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByLabel('Nombre de la nueva cuenta').fill('Visa Prueba');
  await page.getByLabel('Tipo de la nueva cuenta').selectOption({ label: 'Tarjeta de crédito' });
  await page.getByLabel('Tasa efectiva anual de la tarjeta').fill('28');
  await page.getByLabel('Cuota mínima de la tarjeta').fill('50000');
  await page.getByRole('button', { name: 'Agregar tarjeta' }).click();
  await expect(page.getByRole('status')).toContainText('Tarjeta agregada');

  // Compra con la tarjeta: sube la deuda.
  const sheet = await openRegister(page);
  await sheet.getByLabel('Monto').fill('200000');
  await sheet.getByLabel('Categoría').selectOption({ label: 'Ropa' });
  await sheet.getByLabel('Sale de').selectOption({ label: 'Visa Prueba' });
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet).toBeHidden();

  await tab(page, 'Deudas');
  const visa = card(page, 'Visa Prueba');
  await expect(visa).toContainText('$ 200.000');
  await expect(visa).toContainText('28% EA');

  // "Registrar pago" de una tarjeta abre una transferencia hacia ella (Anexo D.1).
  await visa.getByRole('button', { name: 'Registrar pago' }).click();
  const pay = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await expect(pay.getByLabel('Pago de tarjeta')).toHaveValue(/.+/);
  await pay.getByLabel('Monto').fill('200000');
  await pay.getByRole('button', { name: 'Guardar' }).click();
  await expect(visa).toContainText('Pagada');
});

test('con tarjeta no se pueden registrar ingresos', async ({ page }) => {
  await openDemo(page);
  const sheet = await openRegister(page);
  await sheet.getByRole('button', { name: 'Ingreso' }).click();
  const options = await sheet.getByLabel('Entra a').locator('option').allInnerTexts();
  expect(options).not.toContain('Tarjeta de crédito');
});

test('repetir cada mes crea un pendiente que se registra con un toque (SPEC 5.4)', async ({
  page,
}) => {
  await openDemo(page);
  const sheet = await openRegister(page);
  await sheet.getByLabel('Monto').fill('90000');
  await sheet.getByLabel('Categoría').selectOption({ label: 'Mascotas' });
  await sheet.getByLabel('Nota (opcional)').fill('Concentrado');
  await sheet.getByRole('switch', { name: /Repetir cada mes/ }).check();
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toContainText('Se repetirá cada mes');

  // Este mes ya está registrado; el próximo aparece como pendiente.
  await tab(page, 'Movimientos');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const pending = card(page, 'Pendientes del mes');
  await expect(pending).toContainText('Mascotas');
  await pending.getByRole('button', { name: 'Registrar Mascotas', exact: true }).click();
  // Sale de pendientes (los del ejemplo siguen ahí) y queda registrado.
  await expect(pending).not.toContainText('Mascotas');
  await expect(page.locator('button', { hasText: 'Concentrado' })).toContainText('-$ 90.000');

  // Aparece en Ajustes y se puede pausar.
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const repeating = card(page, 'Movimientos que se repiten');
  await expect(repeating).toContainText('Mascotas');
});

test('omitir un pendiente este mes', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'Movimientos');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const pending = card(page, 'Pendientes del mes');
  // El ejemplo trae cuatro movimientos que se repiten.
  await expect(pending.getByRole('button', { name: /^Omitir / })).toHaveCount(4);
  await pending.getByRole('button', { name: 'Omitir Internet y celular este mes' }).click();
  await expect(pending.getByRole('button', { name: /^Omitir / })).toHaveCount(3);
  await expect(pending).not.toContainText('Internet y celular');
});

test('crear una categoría sin salir del registro (SPEC 6.3)', async ({ page }) => {
  await openDemo(page);
  const sheet = await openRegister(page);
  await sheet.getByLabel('Monto').fill('60000');
  await sheet.getByLabel('Categoría').selectOption({ label: '+ Crear categoría' });
  await sheet.getByLabel('Nueva categoría de gastos').fill('Gimnasio');
  await sheet.getByRole('button', { name: 'Crear' }).click();
  await expect(sheet.getByLabel('Categoría')).toHaveValue(/.+/);
  await expect(sheet.getByLabel('Categoría').locator('option:checked')).toHaveText('Gimnasio');
  await sheet.getByRole('button', { name: 'Guardar' }).click();

  await tab(page, 'Presupuesto');
  const gastos = card(page, 'Gastos');
  // Entra antes de "Otros gastos", que sigue al final.
  const names = await gastos
    .locator('input[aria-label^="Nombre de la categoría"], b')
    .allInnerTexts();
  expect(names.join('|')).toMatch(/Otros gastos$/);
  await expect(gastos.getByLabel('Nombre de la categoría Gimnasio')).toBeVisible();
});

test('búsqueda sin tildes y filtros (SPEC 6.4)', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'Movimientos');
  const search = page.getByLabel('Buscar movimientos');

  await search.fill('nomina');
  await expect(page.getByText(/^1 movimiento en /)).toBeVisible();
  await expect(page.locator('button', { hasText: 'Nómina' })).toHaveCount(1);

  // En todo el historial aparecen las 6 nóminas del ejemplo.
  await page.getByRole('button', { name: 'Filtros' }).click();
  await page.getByRole('button', { name: 'Todo el historial' }).click();
  await expect(page.getByText('6 movimientos en todo el historial')).toBeVisible();

  // Filtro por monto: ninguna nómina vale menos de 1 millón.
  await page.getByLabel('Monto hasta').fill('1000000');
  await expect(page.getByText('Nada coincide con tu búsqueda.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await expect(search).toHaveValue('');
});

test('ordenar categorías y cuentas (Anexo D.23)', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'Presupuesto');
  const ingresos = card(page, 'Ingresos');
  await ingresos.getByRole('button', { name: 'Ordenar Ingresos' }).click();
  await ingresos.getByRole('button', { name: 'Bajar Salario' }).click();
  await expect(ingresos.locator('li').first()).toContainText('Honorarios o trabajo independiente');
  await ingresos.getByRole('button', { name: 'Terminar de ordenar Ingresos' }).click();
  await page.reload();
  await tab(page, 'Presupuesto');
  await expect(card(page, 'Ingresos').getByRole('textbox').first()).toHaveValue(
    'Honorarios o trabajo independiente',
  );
});
