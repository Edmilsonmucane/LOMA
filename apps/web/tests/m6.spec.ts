import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
const fixture = JSON.parse(readFileSync('.local/m6.json', 'utf8'));
let slug: string;
test.beforeAll(async () => {
  const db = new pg.Client({ connectionString: local.DB_URL });
  await db.connect();
  try {
    slug = (
      await db.query('select slug from public.tenants where id=$1', [
        fixture.tenant,
      ])
    ).rows[0].slug;
  } finally {
    await db.end();
  }
});
async function login(page: Page, key = 'manager') {
  await page.goto(`http://${slug}.localhost:3000/login`);
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true', {
    timeout: 15000,
  });
  await page.getByLabel('Email', { exact: true }).fill(accounts[key].email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(accounts[key].password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
async function accessible(page: Page) {
  await page.waitForTimeout(200);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test('M6: collection promise, live reminder and accessible drawer', async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto(
    `http://${slug}.localhost:3000/app/collections?bucket=1&q=Dulce`,
  );
  await expect(
    page.getByRole('heading', { name: 'Cobranças', exact: true }),
  ).toBeVisible();
  const row = page
    .locator('.collection-row')
    .filter({ has: page.locator(`a[href="/app/loans/${fixture.loan}"]`) });
  await expect(row).toBeVisible();
  await page.screenshot({
    path: `.local/m6-collections-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await row
    .getByRole('button', { name: 'Registar contacto', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('O que aconteceu', { exact: true })
    .selectOption('promise');
  await dialog
    .getByLabel('Nota', { exact: true })
    .fill('Cliente confirmou pagamento na próxima visita à agência.');
  await dialog
    .getByLabel('Data combinada', { exact: true })
    .fill(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(
        new Date(),
      ),
    );
  await dialog
    .getByLabel('Valor prometido (MT)', { exact: true })
    .fill('500,00');
  await page.screenshot({
    path: `.local/m6-promise-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await accessible(page);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText('Cliente confirmou pagamento');
  await row
    .getByRole('button', { name: 'Enviar lembrete', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Dulce');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Colocar na fila', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'Mensagem na fila',
  );
  await accessible(page);
});
test('M6: campaign previews consented segment before confirmation', async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto(`http://${slug}.localhost:3000/app/messages/campaigns`);
  await page
    .getByRole('button', { name: 'Criar campanha', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const name = `Contacto da agência ${randomUUID().slice(0, 8)}`;
  await dialog.getByLabel('Nome', { exact: true }).fill(name);
  await dialog
    .getByLabel('Agência', { exact: true })
    .selectOption(fixture.branch);
  await dialog.getByLabel('Modelo', { exact: true }).selectOption('campaign');
  await dialog
    .getByRole('button', { name: 'Conferir destinatários', exact: true })
    .click();
  await expect(dialog.locator('.message-preview')).toContainText(
    'destinatário',
  );
  await expect(dialog.locator('.message-preview')).toContainText('Olá');
  await page.screenshot({
    path: `.local/m6-campaign-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await accessible(page);
  await dialog
    .getByRole('button', { name: 'Confirmar campanha', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const row = page.locator('.message-row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row
    .getByRole('button', { name: 'Cancelar envios pendentes', exact: true })
    .click();
  await expect(row).toContainText('Cancelada');
});
test('M6: templates, leads and encrypted integration forms', async ({
  page,
}) => {
  await login(page);
  await page.goto(`http://${slug}.localhost:3000/app/messages/templates`);
  await page.getByRole('button', { name: 'Criar modelo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Nome', { exact: true })
    .fill('Contacto da agência da Baixa');
  await dialog
    .getByLabel('Texto da mensagem', { exact: true })
    .fill('Olá {nome}. Contacte {microcredito} para esclarecer o seu pedido.');
  await accessible(page);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto(`http://${slug}.localhost:3000/app/messages/leads`);
  await page
    .getByRole('button', { name: 'Criar contacto', exact: true })
    .click();
  await dialog.getByLabel('Nome', { exact: true }).fill('Celina Mondlane');
  await dialog
    .getByLabel('Telemóvel', { exact: true })
    .fill(`+25886${String(Date.now()).slice(-7)}`);
  await dialog
    .getByLabel('Origem do contacto', { exact: true })
    .fill('Visita à agência de Maputo');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator('.message-row').filter({ hasText: 'Celina Mondlane' }).first(),
  ).toContainText('Novo');
  await page.goto(`http://${slug}.localhost:3000/app/settings/integrations`);
  await expect(
    page.getByRole('heading', { name: 'Integrações', exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.goto(`http://${slug}.localhost:3000/app/settings/communication`);
  await expect(
    page.getByLabel('Enviar a partir das (hora)', { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.goto(`http://${slug}.localhost:3000/app/messages`);
  await expect(
    page.getByRole('heading', { name: 'Mensagens', exact: true }),
  ).toBeVisible();
  await accessible(page);
});
test('M6: reader cannot access communication or collection writes', async ({
  page,
}) => {
  await login(page, 'reader');
  for (const path of [
    '/app/messages',
    '/app/collections',
    '/app/settings/integrations',
  ]) {
    await page.goto(`http://${slug}.localhost:3000${path}`);
    await expect(
      page.getByRole('button', { name: 'Criar campanha', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Guardar integração', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Registar contacto', exact: true }),
    ).toHaveCount(0);
  }
});
