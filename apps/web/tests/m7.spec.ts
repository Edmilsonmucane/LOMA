import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
const fixture = JSON.parse(readFileSync('.local/m7.json', 'utf8'));
const root = `http://${fixture.slug}.localhost:3000`;
async function accessible(page: Page) {
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
async function phoneLogin(page: Page) {
  const phone = `+25884${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
  await page.getByLabel('Telefone', { exact: true }).fill(phone);
  const received = page.waitForResponse((r) =>
    r.url().includes('/api/public/captcha'),
  );
  await page
    .getByRole('button', { name: 'Mostrar outro código', exact: true })
    .click();
  const svg = await (await received).text();
  const captcha = svg.match(/>(\d{6})<\/text>/)?.[1];
  expect(captcha).toBeTruthy();
  await page
    .getByLabel('Escreva o código da imagem', { exact: true })
    .fill(captcha!);
  await page
    .getByRole('button', { name: 'Enviar código SMS', exact: true })
    .click();
  await expect(page.getByLabel('Código SMS', { exact: true })).toBeVisible();
  const db = new pg.Client({ connectionString: local.DB_URL });
  await db.connect();
  let code;
  try {
    code = (
      await db.query(
        'select code from portal_private.auth_codes where phone=$1 order by created_at desc limit 1',
        [phone.slice(1)],
      )
    ).rows[0]?.code;
  } finally {
    await db.end();
  }
  expect(code).toBeTruthy();
  await page.getByLabel('Código SMS', { exact: true }).fill(code);
  await page
    .getByRole('button', { name: 'Confirmar código', exact: true })
    .click();
  return phone;
}
async function staffLogin(page: Page) {
  await page.goto(root + '/login');
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Email', { exact: true }).fill(accounts.manager.email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(accounts.manager.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/app');
}
test('M7 public simulation, privacy, PWA and mobile accessibility', async ({
  page,
}) => {
  await page.goto(root + `/simulate?product=${fixture.product}`);
  await expect(
    page.getByRole('heading', { name: 'Simulador', exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.locator('#principal').fill('1000000');
  await page.locator('#periods').fill('6');
  const total = page.locator('[data-quote="total"]');
  await expect(total).toHaveText('16 000,00 MT');
  await expect(page.locator('[data-request]')).toHaveAttribute(
    'href',
    /principal=1000000.*periods=6/,
  );
  await page.screenshot({
    path: `.local/m7-simulator-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  const manifest = await page.evaluate(async () => {
    const r = await fetch('/manifest.webmanifest');
    return { ok: r.ok, data: await r.json() };
  });
  expect(manifest.ok).toBe(true);
  expect(manifest.data.display).toBe('standalone');
  await page.goto(root + '/privacy');
  await expect(
    page.getByRole('heading', { name: 'Privacidade', exact: true }),
  ).toBeVisible();
  await accessible(page);
  expect(
    await page.evaluate(
      async () =>
        (await (await fetch('/api/public/session')).json()).authenticated,
    ),
  ).toBe(false);
});
test('M7 mobile request with private document reaches staff and customer area', async ({
  page,
  context,
}) => {
  await page.goto(
    root + `/request?product=${fixture.product}&principal=1000000&periods=6`,
  );
  await accessible(page);
  let saves = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/public/save'
    )
      saves++;
  });
  await phoneLogin(page);
  await expect(
    page.getByRole('heading', { name: 'Pedir crédito', exact: true }),
  ).toBeVisible();
  const name = `Lídia Matavele ${randomUUID().slice(0, 6)}`;
  await page.getByLabel('Nome completo', { exact: true }).fill(name);
  await page
    .getByLabel('Data de nascimento', { exact: true })
    .fill('1992-06-15');
  await page
    .getByLabel('Número do documento', { exact: true })
    .fill('M7' + randomUUID().slice(0, 10));
  await page
    .getByLabel('Agência', { exact: true })
    .selectOption(fixture.branch);
  await page.getByLabel('Província', { exact: true }).fill('Maputo');
  await page.getByLabel('Bairro', { exact: true }).fill('Mavalane');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Rendimento e crédito', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Para que precisa do crédito?', { exact: true })
    .fill('Comprar mercadoria para a banca.');
  await page
    .getByLabel('Rendimento mensal (MT)', { exact: true })
    .fill('15 000,00');
  await page
    .getByLabel('Despesas mensais (MT)', { exact: true })
    .fill('4 000,00');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Documentos', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Tipo de documento', { exact: true })
    .selectOption('Bilhete de identidade');
  await page
    .getByLabel('Fotografia ou ficheiro', { exact: true })
    .setInputFiles({
      name: 'bilhete.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF'),
    });
  await page
    .getByRole('button', { name: 'Enviar documento', exact: true })
    .click();
  await expect(page.locator('form [data-status]')).toHaveText(
    'Documento enviado.',
  );
  await accessible(page);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.locator('[data-request-summary]')).toContainText(
    '16 000,00 MT',
  );
  await page.getByRole('checkbox', { name: /Li e aceito os termos/ }).check();
  await accessible(page);
  await page.screenshot({
    path: `.local/m7-request-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: /Pedido enviado. Número/ }),
  ).toBeVisible();
  expect(saves).toBe(3);
  await page
    .getByRole('link', { name: 'Área do cliente', exact: true })
    .last()
    .click();
  await expect(page.locator('.public-account-row')).toContainText('Submetido');
  await expect(page.locator('.public-account-row')).toContainText(
    '10 000,00 MT',
  );
  await accessible(page);
  const staff = await context.newPage();
  await staffLogin(staff);
  await staff.goto(root + '/app/applications');
  await staff.getByRole('textbox', { name: /Pesquisar/ }).fill(name);
  await expect(staff.locator('main')).toContainText(name);
  await staff.getByRole('link', { name }).first().click();
  await expect(
    staff.getByRole('heading', {
      name: 'Dados enviados pelo cliente',
      exact: true,
    }),
  ).toBeVisible();
  await expect(staff.locator('main')).toContainText('15 000,00 MT');
  await staff.close();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Acompanhe o seu crédito.',
      exact: true,
    }),
  ).toBeVisible();
});
test('M7 editor previews theme and saves site', async ({ page }) => {
  await staffLogin(page);
  await page.goto(root + '/app/settings/site');
  await expect(
    page.getByRole('heading', { name: 'Marca e site', exact: true }),
  ).toBeVisible();
  await accessible(page);
  const title = 'Crédito para o dia a dia, com condições claras.';
  await page
    .getByLabel('Título da página inicial', { exact: true })
    .fill(title);
  await page
    .getByRole('combobox', { name: 'Tema', exact: true })
    .selectOption('modern');
  await expect(page.locator('.site-editor-preview')).toHaveClass(
    /public-modern/,
  );
  await page.getByRole('button', { name: 'Guardar site', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Site actualizado.');
  await page.goto(root);
  await expect(
    page.getByRole('heading', { name: title, exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: `.local/m7-home-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
