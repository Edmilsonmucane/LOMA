import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.goto('/design');
  await expect(page.locator('.catalog')).toHaveAttribute('data-ready', 'true');
});
test('catalogue exposes all sections and has no mobile overflow', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Clareza em cada detalhe.',
  );
  for (const id of [
    'colors',
    'type',
    'buttons',
    'fields',
    'tables',
    'panels',
    'states',
  ])
    await expect(page.locator(`#${id}`)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('drawer validates required fields and restores focus', async ({
  page,
}) => {
  const trigger = page
    .locator('#panels')
    .getByRole('button', { name: 'Criar cliente' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Pré-visualizar confirmação' })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome completo').fill('Amélia Mucavele');
  await dialog.getByLabel('Telemóvel').fill('+258 84 123 4567');
  await dialog
    .getByRole('button', { name: 'Pré-visualizar confirmação' })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('Pré-visualização concluída. Nenhum cliente foi criado.'),
  ).toBeVisible();
  await expect(trigger).toBeFocused();
});
test('command palette filters, handles empty results and selects', async ({
  page,
}) => {
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('inexistente');
  await expect(
    page.getByText('Nenhum resultado. Experimente outro nome.'),
  ).toBeVisible();
  await search.fill('cliente');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Novo cliente' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('table density and tabs respond to interaction', async ({ page }) => {
  await page.getByLabel('Densidade compacta').check();
  await expect(page.getByRole('table')).toHaveClass(/ui-table-compact/);
  await page.getByRole('tab', { name: 'Documentos' }).click();
  await expect(page.getByRole('tabpanel')).toContainText(
    'Os documentos do cliente aparecerão aqui',
  );
});
test('brand change derives accessible button contrast', async ({ page }) => {
  await page.locator('#brand-color').fill('#ffcc00');
  await expect(page.getByText(/Contraste do botão:/)).toContainText('13.89:1');
  await expect(page.locator('.brand-preview-action button')).toHaveCSS(
    'background-color',
    'rgb(255, 204, 0)',
  );
  await expect(page.locator('.brand-preview-action button')).toHaveCSS(
    'color',
    'rgb(0, 0, 0)',
  );
});
test('catalogue, drawer and search pass WCAG AA checks', async ({ page }) => {
  const scan = () =>
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
  expect((await scan()).violations).toEqual([]);
  await page
    .locator('#panels')
    .getByRole('button', { name: 'Criar cliente' })
    .click();
  expect((await scan()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  expect((await scan()).violations).toEqual([]);
});
test('reduced motion disables functional animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.ui-spinner')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
});
