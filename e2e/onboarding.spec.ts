import { expect, test, type Page } from '@playwright/test';
import { card, tab } from './helpers';

const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click();

test('onboarding completo de un empleado quincenal (SPEC 6.1)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Tus datos se quedan en tu dispositivo.')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();

  await expect(page.getByText('Paso 1 de 6')).toBeVisible();
  await expect(page.getByText('Lo ajustas después.')).toBeVisible();
  await page.getByLabel('Tu nombre').fill('Laura');
  await next(page);

  await page.getByRole('radio', { name: /Empleado/ }).check();
  await page.getByRole('button', { name: 'Cada quincena' }).click();
  await next(page);

  await page.getByLabel('Ingreso mensual aproximado').fill('3400000');
  await expect(page.getByText(/dos pagos de \$ 1\.700\.000/)).toBeVisible();
  await expect(page.getByText('Aproximado. Verifica con tu empleador o contador.')).toBeVisible();
  await next(page);

  await page.getByLabel('Nombre de tu banco').fill('Bancolombia');
  await page.getByLabel('Saldo de hoy en Bancolombia').fill('900000');
  await page.getByLabel('Uso Daviplata').uncheck();
  await next(page);

  await page.getByLabel('Nombre', { exact: true }).fill('Visa');
  await page.getByLabel('Es una tarjeta de crédito').check();
  await page.getByLabel('Debes hoy').fill('1200000');
  await page.getByLabel('Cuota mínima').fill('90000');
  await page.getByLabel('Tasa efectiva anual (% EA)').fill('28');
  await page.getByRole('button', { name: 'Agregar deuda' }).click();
  await expect(page.getByText(/Tarjeta · \$ 1\.200\.000/)).toBeVisible();
  await next(page);

  await page.getByRole('radio', { name: /Pagar mis deudas/ }).check();
  await page.getByRole('button', { name: 'Terminar' }).click();

  // Abre en Deudas porque ese es el objetivo (Anexo D.17).
  await expect(page.getByRole('heading', { level: 1, name: 'Deudas' })).toBeVisible();
  await expect(card(page, 'Visa')).toContainText('$ 1.200.000');

  await tab(page, 'Inicio');
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Laura' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quincena 1' })).toBeVisible();
  await expect(card(page, 'Cuentas y patrimonio')).toContainText('Bancolombia$ 900.000');
  await expect(card(page, 'Cuentas y patrimonio')).not.toContainText('Daviplata');

  // Ingresos programados: quincena, prima de junio y diciembre e intereses de cesantías.
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const repeating = card(page, 'Movimientos que se repiten');
  await expect(repeating).toContainText('Cada quincena: el día 15 y el último día');
  await expect(repeating).toContainText('Cada año, el 30 de junio');
  await expect(repeating).toContainText('Cada año, el 20 de diciembre');
  await expect(repeating).toContainText('Cada año, el 31 de enero');
});

test('saltar todo deja la app usable con lo que trae por defecto', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saltar y empezar sin configurar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis finanzas' })).toBeVisible();
  await tab(page, 'Presupuesto');
  await expect(card(page, 'Gastos')).toContainText('Otros gastos');
  await page.reload();
  // No vuelve a pedir el onboarding.
  await expect(page.getByRole('heading', { level: 1, name: 'Mis finanzas' })).toBeVisible();
});

test('cada pantalla se puede saltar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  for (let i = 1; i <= 6; i++) {
    await expect(page.getByText(`Paso ${i} de 6`)).toBeVisible();
    await page.getByRole('button', { name: 'Saltar' }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Mis finanzas' })).toBeVisible();
});

test('primeros pasos: avanzan con los datos y se pueden ocultar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saltar y empezar sin configurar' }).click();
  const steps = page.getByRole('region', { name: 'Primeros pasos' });
  await expect(steps).toContainText('0 de 4');

  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await sheet.getByLabel('Monto').fill('20000');
  await sheet.getByLabel('Categoría').selectOption({ label: 'Mercado' });
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(steps).toContainText('1 de 4');

  await steps.getByRole('button', { name: 'Ocultar primeros pasos' }).click();
  await expect(steps).toBeHidden();
});

test('repetir la configuración desde Ajustes no borra datos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saltar y empezar sin configurar' }).click();
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await sheet.getByLabel('Monto').fill('35000');
  await sheet.getByLabel('Categoría').selectOption({ label: 'Transporte' });
  await sheet.getByLabel('Nota (opcional)').fill('Taxi aeropuerto');
  await sheet.getByRole('button', { name: 'Guardar' }).click();

  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Repetir la configuración inicial' }).click();
  await expect(page.getByText('Paso 1 de 6')).toBeVisible();
  await page.getByLabel('Tu nombre').fill('Pedro');
  for (let i = 0; i < 5; i++) await next(page);
  await page.getByRole('button', { name: 'Terminar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Pedro' })).toBeVisible();
  await tab(page, 'Movimientos');
  await expect(page.locator('button', { hasText: 'Taxi aeropuerto' })).toContainText('-$ 35.000');
});

test('desde el ejemplo, "Empezar con mis datos" lleva a la configuración', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver con datos de ejemplo' }).click();
  await page.getByRole('button', { name: 'Empezar con mis datos' }).click();
  await page.getByRole('button', { name: 'Sí, borrar el ejemplo' }).click();
  await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toBeVisible();
});

test('quincena: filtra Inicio sin cambiar los datos (SPEC 5.5)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await page.getByRole('button', { name: 'Saltar' }).click();
  await page.getByRole('button', { name: 'Cada quincena' }).click();
  await next(page);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Saltar' }).click();

  await page.getByRole('button', { name: 'Quincena 2' }).click();
  await expect(page.getByText(/^Te queda en la quincena 2 de /)).toBeVisible();
  await page.getByRole('button', { name: 'Mes completo' }).click();
  await expect(page.getByText(/^Te queda en (?!la quincena)/)).toBeVisible();
});
