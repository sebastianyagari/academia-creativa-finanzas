import { expect, test } from '@playwright/test';

test('la app abre en Inicio con la navegación de 5 pestañas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Academia Creativa Finanzas');
  await expect(page.getByRole('heading', { level: 1, name: 'Mis finanzas' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Secciones' });
  for (const tab of ['Inicio', 'Movimientos', 'Presupuesto', 'Metas', 'Deudas']) {
    await expect(nav.getByRole('button', { name: tab })).toBeVisible();
  }
});

test('cambiar de pestaña cambia el título y marca la pestaña activa', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Secciones' });
  await nav.getByRole('button', { name: 'Deudas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deudas' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Deudas' })).toHaveAttribute('aria-current', 'page');
});

test('no hay scroll horizontal a 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Las etiquetas de la navegación se leen completas, sin "…".
  const cut = await page
    .getByRole('navigation', { name: 'Secciones' })
    .locator('span')
    .evaluateAll((spans) =>
      spans.filter((s) => s.scrollWidth > s.clientWidth).map((s) => s.textContent),
    );
  expect(cut).toEqual([]);
});

test('la página no se indexa en buscadores', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});

test.describe('modo oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('usa el fondo oscuro de marca y el logo blanco', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(20, 13, 27)');
    await expect(page.locator('img[src$="isotipo-blanco.svg"]')).toBeVisible();
    await expect(page.locator('img[src$="isotipo-morado.svg"]')).toBeHidden();
  });
});
