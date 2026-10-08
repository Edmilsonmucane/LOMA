import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
async function login(page: Page, key = 'manager') {
  await page.goto('http://demo.localhost:3000/login');
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Email', { exact: true }).fill(accounts[key].email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(accounts[key].password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
function phone() {
  return `+25884${String(Math.floor(Math.random() * 9000000) + 1000000)}`;
}
test('client profile, consent, document, note and global search', async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  await page.goto('http://demo.localhost:3000/app/clients');
  await page
    .getByRole('button', { name: 'Criar cliente', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  const name = `Amélia Cossa ${randomUUID().slice(0, 8)}`;
  const number = phone();
  await dialog.getByLabel('Nome completo').fill(name);
  await dialog.getByLabel('Número ou email').fill(number);
  await dialog.getByText('Identificação', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Adicionar identificação' }).click();
  await dialog
    .getByLabel('Número do documento')
    .fill(`BI${randomUUID().replaceAll('-', '')}`);
  await dialog.getByText('Morada', { exact: true }).click();
  await dialog.getByLabel('Província', { exact: true }).fill('Maputo');
  await dialog.getByLabel('Bairro', { exact: true }).fill('Malhangalene');
  await dialog.getByText('Actividade e rendimento', { exact: true }).click();
  await dialog.getByLabel('Rendimento mensal (MT)').fill('15000,50');
  await dialog.getByLabel('SMS', { exact: true }).check();
  await dialog
    .getByLabel('Como e quando o cliente autorizou')
    .fill('Autorizou presencialmente em 7 out 2026');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/clients\/[^/]+$/);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('15 000,50 MT', { exact: true })).toBeVisible();
  await page
    .getByLabel('Nota sobre o cliente')
    .fill('Cliente vende hortícolas no mercado de Xipamanine.');
  await page.getByRole('button', { name: 'Registar nota' }).click();
  await expect(
    page.getByText('Cliente vende hortícolas no mercado de Xipamanine.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Adicionar documento', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do documento').fill('Bilhete de identidade');
  await dialog.getByLabel('Data de validade').fill('2030-10-07');
  await dialog.getByLabel('Escolher ficheiro').setInputFiles({
    name: 'bi.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nverified document\n%%EOF'),
  });
  await dialog
    .getByRole('button', { name: 'Adicionar documento', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Abrir documento' }),
  ).toBeVisible();
  const url = await page
    .getByRole('link', { name: 'Abrir documento' })
    .getAttribute('href');
  expect((await page.request.get(url!)).ok()).toBe(true);
  await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('SMS', { exact: true }).uncheck();
  await dialog
    .getByRole('combobox', { name: 'Lista do cliente', exact: true })
    .selectOption('vip');
  await dialog.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('Permissão para mensagens registada', { exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').fill(number);
  await expect(
    dialog.getByRole('option').filter({ hasText: name }),
  ).toBeVisible();
  await dialog.getByRole('option').filter({ hasText: name }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test('CSV wizard reports row errors and imports valid clients without consent', async ({
  page,
}) => {
  await login(page);
  await page.goto('http://demo.localhost:3000/app/clients');
  await page
    .getByRole('button', { name: 'Importar clientes', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const name = `Tomás Sitoe ${randomUUID().slice(0, 8)}`;
  const number = phone();
  const csv = `Nome completo;Telemóvel;Rendimento mensal (MT)\n${name};${number};15000,00\nGraça Chissano;${number};17000,00\nCelina Mabunda;123;abc`;
  await dialog.getByLabel('Ficheiro CSV').setInputFiles({
    name: 'clientes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(dialog.getByText('Foram encontradas 3 linhas.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Pré-visualizar importação', exact: true })
    .click();
  await expect(dialog.getByText('1 linha válida; 2 com erros.')).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Importar 1 cliente', exact: true })
    .click();
  await expect(
    dialog.getByText(
      'Importação terminada. As fichas criadas já aparecem em Clientes.',
    ),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page
    .getByLabel('Pesquisar por nome, telefone, BI ou NUIT', { exact: true })
    .fill(number);
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByText('Não autorizado', { exact: true })).toHaveCount(
    3,
  );
});
test('reader can consult clients but cannot create or import', async ({
  page,
}) => {
  await login(page, 'reader');
  await page.goto('http://demo.localhost:3000/app/clients');
  await expect(
    page.getByRole('heading', { name: 'Clientes', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar cliente' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Importar clientes' }),
  ).toHaveCount(0);
});
test('CSV wizard imports 500 clients and search finds the last row', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Large batch verified on desktop; mobile covers the same wizard with row errors.',
  );
  await login(page);
  await page.goto('http://demo.localhost:3000/app/clients');
  await page
    .getByRole('button', { name: 'Importar clientes', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const prefix = randomUUID().slice(0, 8);
  const start = Math.floor(Math.random() * 8000000) + 1000000;
  const names = [
    'Amélia Cossa',
    'Tomás Sitoe',
    'Graça Chissano',
    'Celina Mabunda',
    'Artur Mucavele',
  ];
  const rows = Array.from(
    { length: 500 },
    (_, i) => `${names[i % 5]} ${prefix};+25885${String(start + i)};15000,00`,
  );
  await dialog.getByLabel('Ficheiro CSV').setInputFiles({
    name: 'carteira-clientes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      ['Nome completo;Telemóvel;Rendimento mensal (MT)', ...rows].join('\n'),
    ),
  });
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Pré-visualizar importação', exact: true })
    .click();
  await expect(
    dialog.getByText('500 linhas válidas; 0 com erros.'),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Importar 500 clientes', exact: true })
    .click();
  await expect(
    dialog.getByText(
      'Importação terminada. As fichas criadas já aparecem em Clientes.',
    ),
  ).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page
    .getByLabel('Pesquisar por nome, telefone, BI ou NUIT', { exact: true })
    .fill(`+25885${String(start + 499)}`);
  await expect(
    page.getByRole('link', { name: `${names[4]} ${prefix}`, exact: true }),
  ).toBeVisible();
});
