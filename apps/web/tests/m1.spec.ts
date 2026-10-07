import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
const accounts = JSON.parse(
  readFileSync('.local/accounts.json', 'utf8'),
) as Record<string, { email: string; password: string; id: string }>;
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8')) as {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};
async function login(
  page: import('@playwright/test').Page,
  key: string,
  host = 'demo.localhost',
) {
  const account = accounts[key];
  if (!account) throw new Error('Local account fixture missing');
  await page.goto(`http://${host}:3000/login`);
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(account.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/(app|platform)$/);
}
test('platform creates a tenant with copied defaults in under two minutes', async ({
  page,
}) => {
  await login(page, 'platform', '127.0.0.1');
  const suffix = randomUUID().slice(0, 8);
  const name = `Nampula Microcrédito ${suffix}`;
  const slug = `nampula-${suffix}`;
  await page
    .getByRole('button', { name: 'Criar microcrédito', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do microcrédito').fill(name);
  await dialog.getByLabel('Nome no endereço').fill(slug);
  await dialog
    .getByLabel('Modelo inicial')
    .selectOption('20000000-0000-4000-8000-000000000001');
  const start = Date.now();
  await dialog
    .getByRole('button', { name: 'Criar microcrédito', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('table').getByText(name, { exact: true }),
  ).toBeVisible();
  expect(Date.now() - start).toBeLessThan(120000);
  const account = accounts.platform!;
  const client = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false },
  });
  await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  const { data: tenant } = await client
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();
  expect(tenant).not.toBeNull();
  const { data: config } = await client
    .from('tenant_configuration')
    .select('category')
    .eq('tenant_id', tenant!.id);
  expect(config?.filter((row) => row.category === 'product')).toHaveLength(4);
  expect(config?.filter((row) => row.category === 'message')).toHaveLength(2);
  expect(config?.filter((row) => row.category === 'site')).toHaveLength(1);
});
test('staff login, brand configuration, agency and invitation work', async ({
  page,
  browser,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const host = `matola-${suffix}.localhost`;
  const setup = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false },
  });
  await setup.auth.signInWithPassword({
    email: accounts.platform!.email,
    password: accounts.platform!.password,
  });
  const created = await setup.rpc('provision_tenant', {
    tenant_name: 'Matola Microcrédito',
    tenant_slug: `matola-${suffix}`,
    preset_id: '20000000-0000-4000-8000-000000000001',
    selected_plan_id: '10000000-0000-4000-8000-000000000001',
  });
  expect(created.error).toBeNull();
  const roles = await setup
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', created.data)
    .eq('key', 'manager')
    .single();
  const linked = await setup.rpc('link_existing_member', {
    t: created.data,
    member_email: accounts.manager!.email,
    member_name: 'Amélia Mucavele',
    selected_role: roles.data!.id,
  });
  expect(linked.error).toBeNull();
  await login(page, 'manager', host);
  await page.goto(`http://${host}:3000/app/settings/brand`);
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page
    .getByLabel('Nome do microcrédito', { exact: true })
    .fill('Matola Microcrédito');
  await page.getByLabel('Cor da marca').fill('#0e5a4a');
  await page.getByRole('button', { name: 'Guardar marca' }).click();
  await expect(page.getByRole('status')).toHaveText('Alteração guardada.');
  await page.goto(`http://${host}:3000/app/settings/branches`);
  await page.getByRole('button', { name: 'Criar agência' }).click();
  const dialog = page.getByRole('dialog');
  const branch = `Matola · Liberdade ${suffix}`;
  await dialog.getByLabel('Nome da agência').fill(branch);
  await dialog.getByRole('button', { name: 'Criar agência' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('table').getByText(branch)).toBeVisible();
  await page.goto(`http://${host}:3000/app/settings/team`);
  await page.getByRole('button', { name: 'Convidar utilizador' }).click();
  const invite = page.getByRole('dialog');
  await invite.getByLabel('Nome completo').fill('Amílcar Nhantumbo');
  await invite
    .getByLabel('Email', { exact: true })
    .fill(`amilcar.${suffix}@loma.test`);
  await invite
    .getByLabel('Agência', { exact: true })
    .selectOption({ label: branch });
  await invite.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(invite).not.toBeVisible();
  await expect(
    page.getByText(`amilcar.${suffix}@loma.test`, { exact: true }),
  ).toBeVisible();
  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await page.request.get(
        'http://127.0.0.1:54324/api/v1/messages',
      );
      const messages = await response.json();
      messageId = messages.messages.find(
        (message: { ID: string; To: { Address: string }[] }) =>
          message.To.some(
            (person) => person.Address === `amilcar.${suffix}@loma.test`,
          ),
      )?.ID;
      return Boolean(messageId);
    })
    .toBe(true);
  const message = await (
    await page.request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)
  ).json();
  const href = String(message.HTML)
    .match(/href="([^"]+)"/)?.[1]
    ?.replaceAll('&amp;', '&');
  if (!href) throw new Error('Invitation link missing');
  expect(new URL(href).hostname).toBe(host);
  const invitedContext = await browser.newContext();
  try {
    const invited = await invitedContext.newPage();
    await invited.goto(href);
    await expect(invited).toHaveURL(/\/auth\/password$/);
    await expect(invited.locator('form')).toHaveAttribute('data-ready', 'true');
    await invited
      .getByLabel('Nova palavra-passe', { exact: true })
      .fill(`Loma-${randomBytes(16).toString('hex')}`);
    await invited
      .getByRole('button', { name: 'Guardar palavra-passe' })
      .click();
    await expect(invited).toHaveURL(/\/app$/);
    await expect(
      invited.getByRole('heading', {
        name: 'Prepare o seu microcrédito.',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await invitedContext.close();
  }
});
test('reader cannot open administration and unknown tenant is rejected', async ({
  page,
}) => {
  await login(page, 'reader');
  await page.goto('http://demo.localhost:3000/app/settings');
  await expect(
    page.getByRole('link', { name: 'Marca e contactos', exact: false }),
  ).toHaveCount(0);
  const forbidden = await page.goto(
    'http://demo.localhost:3000/app/settings/brand',
  );
  expect(forbidden?.status()).toBe(404);
  const unknown = await page.goto(
    'http://tenant-inexistente.localhost:3000/login',
  );
  expect(unknown?.status()).toBe(404);
});
test('manager session cannot cross into another tenant', async ({ page }) => {
  await login(page, 'manager');
  const cookies = await page.context().cookies('http://demo.localhost:3000');
  await page
    .context()
    .addCookies(
      cookies.map((cookie) => ({ ...cookie, domain: 'beira.localhost' })),
    );
  await page.goto('http://beira.localhost:3000/app');
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText('Macuti Microcrédito', { exact: true }),
  ).toBeVisible();
});
test('protected application has accessible navigation and command search', async ({
  page,
}, testInfo) => {
  await login(page, 'manager');
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
  if (testInfo.project.name === 'mobile') {
    await page
      .getByRole('button', { name: 'Navegação principal', exact: true })
      .click();
    const navigation = page.getByRole('dialog');
    await expect(navigation).toBeVisible();
    await navigation
      .getByRole('link', { name: 'Definições', exact: true })
      .click();
    await expect(navigation).not.toBeVisible();
    await expect(page).toHaveURL(/\/app\/settings$/);
  }
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.getByRole('combobox').fill('marca');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\/brand$/);
});
