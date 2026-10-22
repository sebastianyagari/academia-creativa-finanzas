import { expect, test } from '@playwright/test';
import { card, openDemo, tab } from './helpers';

// Hallazgos de la primera prueba en celular (Fase 4).

test('una deuda escrita sin tocar "Agregar deuda" no se pierde al seguir', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Saltar' }).click();

  await expect(page.getByText('Paso 5 de 6')).toBeVisible();
  await page.getByLabel('Nombre', { exact: true }).fill('Crédito moto');
  await page.getByLabel('Debes hoy').fill('5000000');
  await page.getByLabel('Cuota mínima').fill('300000');
  await page.getByLabel('Tasa efectiva anual (% EA)').fill('24');
  // Directo a "Siguiente", como en la prueba real.
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Paso 6 de 6')).toBeVisible();
  await page.getByRole('radio', { name: /Pagar mis deudas/ }).check();
  await page.getByRole('button', { name: 'Terminar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Deudas' })).toBeVisible();
  await expect(card(page, 'Crédito moto')).toContainText('$ 5.000.000');
});

test('si a la deuda escrita le falta un dato, avisa y no avanza', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Saltar' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Tarjeta');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Escribe el nombre, lo que debes y la cuota mínima.',
  );
  await expect(page.getByText('Paso 5 de 6')).toBeVisible();
});

test('"Saltar" en el paso de deudas no borra las ya agregadas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Saltar' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Préstamo');
  await page.getByLabel('Debes hoy').fill('800000');
  await page.getByLabel('Cuota mínima').fill('100000');
  await page.getByRole('button', { name: 'Agregar deuda' }).click();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await page.getByRole('button', { name: 'Terminar' }).click();
  await tab(page, 'Deudas');
  await expect(card(page, 'Préstamo')).toContainText('$ 800.000');
});

test('se puede escribir el presupuesto de una categoría y queda guardado', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'Presupuesto');
  const field = page.getByLabel('Presupuesto de Ropa');
  await field.click();
  await field.pressSequentially('150000');
  await expect(field).toHaveValue('150.000');
  await field.press('Enter');
  await page.reload();
  await tab(page, 'Presupuesto');
  await expect(page.getByLabel('Presupuesto de Ropa')).toHaveValue('150.000');
});

test('se puede escribir el abono extra y el saldo de una cuenta', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'Deudas');
  const extra = page.getByLabel('Abono extra al mes');
  await extra.fill('');
  await extra.pressSequentially('300000');
  await expect(extra).toHaveValue('300.000');
  await extra.blur();
  await expect(page.getByText(/^Con tu plan, el abono extra va a /)).toBeVisible();

  await page.getByRole('button', { name: 'Ajustes' }).click();
  const balance = page.getByLabel('Saldo de Efectivo');
  await balance.fill('');
  await balance.pressSequentially('95000');
  await expect(balance).toHaveValue('95.000');
  await balance.blur();
  await expect(page.getByRole('status')).toContainText('Saldo corregido');
});

test('bola de nieve y avalancha se explican con la deuda de la persona', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'Deudas');
  await expect(page.getByText(/^Avalancha: pagas la cuota mínima/)).toBeVisible();
  await expect(
    page.getByText('Con tu plan, el abono extra va a Tarjeta de crédito (27 % EA).'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bola de nieve' }).click();
  await expect(page.getByText(/^Bola de nieve: pagas la cuota mínima/)).toBeVisible();
  await expect(
    page.getByText('Con tu plan, el abono extra va a Préstamo familiar ($ 800.000).'),
  ).toBeVisible();
});

test('"Vivienda o arriendo" aparece al registrar un gasto', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saltar y empezar sin configurar' }).click();
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const options = await page
    .getByRole('dialog', { name: 'Registrar movimiento' })
    .getByLabel('Categoría')
    .locator('option')
    .allInnerTexts();
  expect(options[1]).toBe('Vivienda o arriendo');
});
