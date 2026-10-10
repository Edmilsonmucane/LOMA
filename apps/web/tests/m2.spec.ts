import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
async function login(page: import('@playwright/test').Page, key = 'manager') {
  await page.goto('http://demo.localhost:3000/login');
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Email', { exact: true }).fill(accounts[key].email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(accounts[key].password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
test('manager creates, simulates, publishes and versions a product', async ({
  page,
}) => {
  await login(page);
  await page.goto('http://demo.localhost:3000/app/settings/products');
  await page
    .getByRole('button', { name: 'Criar produto', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  const name = `Crédito Matola ${randomUUID().slice(0, 8)}`;
  await dialog.getByLabel('Nome do produto').fill(name);
  await dialog
    .getByLabel('Como calcular os juros')
    .selectOption('interest_only');
  await dialog.getByLabel('Taxa por período (%)', { exact: true }).fill('10');
  await expect(dialog.locator('.preview-value')).toHaveText('1 000,00 MT');
  await expect(
    dialog.getByText(
      'Juros por período; o capital é devolvido com a última prestação.',
    ),
  ).toBeVisible();
  await dialog.getByLabel('Como calcular os juros').selectOption('bullet');
  await expect(dialog.locator('.preview-value')).toHaveText('16 000,00 MT');
  await dialog.getByLabel('Como calcular os juros').selectOption('flat');
  await dialog.getByLabel('Taxa por período (%)', { exact: true }).fill('10');
  await dialog
    .getByLabel('Data do desembolso', { exact: true })
    .fill('2026-01-07');
  await expect(dialog.locator('.preview-value')).toHaveText('2 666,67 MT');
  await expect(dialog.locator('.preview-totals')).toContainText('16 000,00 MT');
  await expect(dialog.locator('.preview-totals')).toContainText('6 000,00 MT');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByText('Carência', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Publicar condições', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const row = page
    .locator('.product-row')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(row).toContainText('Em vigor');
  await expect(row).toContainText('Versão 1');
  await row
    .getByRole('button', { name: 'Editar condições', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Taxa por período (%)', { exact: true }).fill('5');
  await expect(dialog.locator('.preview-totals')).toContainText('13 000,00 MT');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Publicar condições', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText('Versão 2');
  await row.getByText('Histórico de condições', { exact: true }).click();
  const first = row
    .locator('.product-history>div')
    .filter({ hasText: 'Versão 1' });
  await first.getByRole('button', { name: 'Ver condições' }).click();
  dialog = page.getByRole('dialog');
  await expect(
    dialog.getByLabel('Taxa por período (%)', { exact: true }),
  ).toHaveValue('10');
  await expect(
    dialog.getByLabel('Taxa por período (%)', { exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator('.preview-totals')).toContainText('16 000,00 MT');
});
test('product drawer remains accessible, validates values and calculates fees live', async ({
  page,
}) => {
  await login(page);
  await page.goto('http://demo.localhost:3000/app/settings/products');
  await page
    .getByRole('button', { name: 'Criar produto', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await dialog.getByLabel('Montante máximo (MT)').fill('1');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel('Montante máximo (MT)').fill('100000');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog.getByText('Comissões', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Adicionar comissão' }).click();
  await dialog.getByLabel('Nome da cobrança').fill('Abertura');
  await dialog.getByLabel('Valor (MT)', { exact: true }).fill('100');
  await dialog.getByLabel('Como é cobrada').selectOption('deducted');
  await expect(dialog.locator('.preview-totals')).toContainText('9 900,00 MT');
  await dialog.getByText('Quem pode aprovar', { exact: true }).click();
  await expect(dialog.getByLabel('Perfil autorizado')).toHaveValue('manager');
  await expect(dialog.getByLabel('Perfil autorizado')).toContainText('Gestor');
});
test('reader cannot configure products', async ({ page }) => {
  await login(page, 'reader');
  const response = await page.goto(
    'http://demo.localhost:3000/app/settings/products',
  );
  expect(response?.status()).toBe(404);
});
