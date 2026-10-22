import { expect, test, type Page } from '@playwright/test';

// Cada prueba abre un navegador limpio: la app arranca con los datos de ejemplo.

async function tab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name }).click();
}

async function registerExpense(page: Page, amount: string, note: string) {
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await sheet.getByLabel('Monto').fill(amount);
  await sheet.getByLabel('Categoría').selectOption({ label: 'Mercado' });
  await sheet.getByLabel('Nota (opcional)').fill(note);
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('status')).toHaveText('Guardado');
  await expect(sheet).toBeHidden();
}

test('registrar, editar y eliminar un gasto (SPEC 14)', async ({ page }) => {
  await page.goto('/');
  await registerExpense(page, '45000', 'Prueba e2e');

  await tab(page, 'Movimientos');
  const row = page.locator('button', { hasText: 'Prueba e2e' });
  await expect(row).toContainText('-$ 45.000');

  // Editar: el formulario abre con todo prellenado.
  await row.click();
  const sheet = page.getByRole('dialog', { name: 'Editar movimiento' });
  await expect(sheet.getByLabel('Monto')).toHaveValue('45.000');
  await expect(sheet.getByLabel('Nota (opcional)')).toHaveValue('Prueba e2e');
  await sheet.getByLabel('Monto').fill('50000');
  await sheet.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toHaveText('Cambios guardados');
  await expect(row).toContainText('-$ 50.000');

  // Eliminar con confirmación en la misma hoja (sin diálogos del navegador).
  await row.click();
  await page.getByRole('button', { name: 'Eliminar movimiento' }).click();
  await page.getByRole('button', { name: '¿Seguro? Toca para eliminar' }).click();
  await expect(page.getByRole('status')).toHaveText('Movimiento eliminado');
  await expect(row).toHaveCount(0);
});

test('el registro muestra errores claros y no guarda', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Escribe un monto mayor a 0.');
  await expect(sheet.getByRole('alert')).toContainText('Elige una categoría.');
  await expect(sheet).toBeVisible();
});

test('los datos siguen ahí después de recargar', async ({ page }) => {
  await page.goto('/');
  await registerExpense(page, '12345', 'Persiste');
  await page.reload();
  await tab(page, 'Movimientos');
  await expect(page.locator('button', { hasText: 'Persiste' })).toContainText('-$ 12.345');
});

test('un gasto cambia el saldo de la cuenta y el patrimonio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mes', exact: true }).click();
  const accounts = page.locator('section', {
    has: page.getByRole('heading', { name: 'Cuentas y patrimonio' }),
  });
  await expect(accounts).toContainText('Efectivo$ 180.000');
  await registerExpense(page, '30000', 'Saldo');
  await expect(accounts).toContainText('Efectivo$ 150.000');
});

test('cambiar de período: Mes, 6 meses y Año', async ({ page }) => {
  await page.goto('/');
  // Con datos de más de un mes, Inicio abre en 6 meses (Anexo D.17).
  await expect(page.getByText('Balance de los últimos 6 meses')).toBeVisible();
  await page.getByRole('button', { name: 'Año', exact: true }).click();
  await expect(page.getByText(/^Balance de \d{4}$/)).toBeVisible();
  await page.getByRole('button', { name: 'Mes', exact: true }).click();
  await expect(page.getByText(/^Te queda en /)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Facturas del mes' })).toBeVisible();
});

test('"Empezar con mis datos" borra el ejemplo tras confirmar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Datos de ejemplo.')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar con mis datos' }).click();
  await page.getByRole('button', { name: 'Sí, borrar el ejemplo' }).click();
  await expect(page.getByText('Datos de ejemplo.')).toBeHidden();
  await tab(page, 'Movimientos');
  await expect(page.getByText(/No hay movimientos en/)).toBeVisible();
  await tab(page, 'Deudas');
  await expect(page.getByText('No tienes deudas registradas.')).toBeVisible();
});

test('aportar a una meta suma a lo ahorrado', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Metas');
  const card = page.locator('section', {
    has: page.getByRole('heading', { name: 'Viaje a Cartagena' }),
  });
  await expect(card).toContainText('$ 950.000');
  await card.getByRole('button', { name: 'Aportar' }).click();
  const sheet = page.getByRole('dialog', { name: 'Aportar a Viaje a Cartagena' });
  await sheet.getByLabel('Monto').fill('50000');
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(card).toContainText('$ 1.000.000');
});
