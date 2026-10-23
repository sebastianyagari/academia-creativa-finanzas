import { expect, test } from '@playwright/test';
import { card, openDemo, tab } from './helpers';

test('la app tiene manifiesto para instalarse (SPEC 10)', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: 'Academia Creativa Finanzas',
    short_name: 'Finanzas',
    lang: 'es-CO',
    display: 'standalone',
    theme_color: '#6A1B9A',
  });
  const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-icon.png',
  );
});

test('después de abrirla una vez, funciona sin internet y conserva los datos', async ({
  page,
  context,
}) => {
  await openDemo(page);
  // Espera a que el service worker controle la página.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Datos de ejemplo.')).toBeVisible();
  await tab(page, 'Metas');
  await expect(card(page, 'Viaje a Cartagena')).toContainText('$ 950.000');

  // Registrar sin internet también funciona: los datos viven en el dispositivo.
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await sheet.getByLabel('Monto').fill('7000');
  await sheet.getByLabel('Nota (opcional)').fill('Sin señal');
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await tab(page, 'Movimientos');
  await expect(page.locator('button', { hasText: 'Sin señal' })).toContainText('$ 7.000');
  await context.setOffline(false);
});

test('Ajustes muestra la guía para instalarla', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const guide = card(page, 'Instala la app');
  await expect(guide).toBeVisible();
  // En el celular de prueba (Android) salen los pasos de Chrome; en escritorio se elige.
  await expect(guide.getByText(/Chrome|Instalar la app/).first()).toBeVisible();
});
