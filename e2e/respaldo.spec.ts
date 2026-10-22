import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { card, openDemo, tab } from './helpers';

test('descargar respaldo y restaurarlo en un dispositivo nuevo (SPEC 9.1, 9.2)', async ({
  page,
  browser,
}) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const backup = card(page, 'Respaldo de tus datos');
  await expect(backup).toContainText('Aún no has hecho uno');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backup.getByRole('button', { name: 'Descargar respaldo' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^academia-finanzas-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const json = JSON.parse(readFileSync(file, 'utf8'));
  expect(json.app).toBe('academia-creativa-finanzas');
  expect(json.schemaVersion).toBe(1);
  await expect(backup).not.toContainText('Aún no has hecho uno');

  // Otro "dispositivo": navegador limpio, sin configurar.
  const other = await browser.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Saltar y empezar sin configurar' }).click();
  await other.getByRole('button', { name: 'Ajustes' }).click();
  await other.getByLabel('Archivo de respaldo').setInputFiles(file);
  const preview = other.getByRole('region', { name: 'Restaurar respaldo' });
  await expect(preview).toContainText(
    `Este respaldo trae ${json.data.transactions.length} movimientos`,
  );
  await expect(preview).toContainText('Reemplazará tus datos actuales.');
  await preview.getByRole('button', { name: 'Restaurar' }).click();
  await preview.getByRole('button', { name: 'Toca otra vez para restaurar' }).click();
  await expect(other.getByRole('status').first()).toContainText('Respaldo restaurado');

  await tab(other, 'Metas');
  await expect(card(other, 'Viaje a Cartagena')).toContainText('$ 950.000');

  // Deshacer vuelve a los datos de antes (sin metas).
  await other.getByRole('button', { name: 'Ajustes' }).click();
  await other.getByRole('button', { name: 'Deshacer la restauración' }).click();
  await tab(other, 'Metas');
  await expect(other.getByText('Aún no tienes metas.', { exact: false })).toBeVisible();
  await other.close();
});

test('un archivo que no es un respaldo se rechaza sin tocar los datos', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const backup = card(page, 'Respaldo de tus datos');
  await page.getByLabel('Archivo de respaldo').setInputFiles({
    name: 'otra-cosa.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hola": 1}'),
  });
  await expect(backup.getByRole('alert')).toContainText(
    'Este archivo no es un respaldo de Academia Creativa Finanzas.',
  );
  await page.getByLabel('Archivo de respaldo').setInputFiles({
    name: 'roto.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{esto no es json'),
  });
  await expect(backup.getByRole('alert')).toContainText('El archivo no se puede leer.');
  await expect(page.getByRole('region', { name: 'Restaurar respaldo' })).toBeHidden();
});

test('exportar a Excel descarga un .xlsx (SPEC 9.3)', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar a Excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^academia-finanzas-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const bytes = readFileSync(await download.path());
  // Un .xlsx es un ZIP: empieza con "PK".
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  expect(bytes.length).toBeGreaterThan(5_000);
});

test('primeros pasos incluye "Haz tu respaldo" y el aviso aparece después', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saltar y empezar sin configurar' }).click();
  const steps = page.getByRole('region', { name: 'Primeros pasos' });
  await expect(steps).toContainText('Haz tu respaldo');
  await expect(steps).toContainText('0 de 4');

  // Con primeros pasos ocultos y un movimiento, aparece el aviso en Inicio.
  await steps.getByRole('button', { name: 'Ocultar primeros pasos' }).click();
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await sheet.getByLabel('Monto').fill('10000');
  await sheet.getByLabel('Categoría').selectOption({ label: 'Mercado' });
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Haz tu respaldo. Aún no tienes uno.')).toBeVisible();
  await page.getByRole('button', { name: 'Respaldar' }).click();
  await expect(card(page, 'Respaldo de tus datos')).toBeVisible();
});
