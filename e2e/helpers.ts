import { expect, type Page } from '@playwright/test';

/** Abre la app limpia y elige "Ver con datos de ejemplo" en la bienvenida. */
export async function openDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver con datos de ejemplo' }).click();
  await expect(page.getByText('Datos de ejemplo.')).toBeVisible();
}

export async function tab(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name }).click();
}

export function card(page: Page, heading: string) {
  return page.locator('section', {
    has: page.getByRole('heading', { name: heading, exact: true }),
  });
}
