import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
async function login(page: Page, key: string, slug = 'demo') {
  await page.goto(`http://${slug}.localhost:3000/login`);
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Email', { exact: true }).fill(accounts[key].email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(accounts[key].password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
async function fixtures() {
  const db = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword(accounts.manager);
  expect(error).toBeNull();
  const { data: tenant } = await db
    .from('tenants')
    .select('id')
    .eq('slug', 'demo')
    .single();
  const t = tenant.id;
  const { data: branch } = await db
    .from('branches')
    .select('id')
    .eq('tenant_id', t)
    .order('name')
    .limit(1)
    .single();
  const suffix = randomUUID().slice(0, 8);
  const name = `Amélia Mondlane ${suffix}`;
  const client = await db.rpc('save_client', {
    t,
    client_data: {
      name,
      branch_id: branch.id,
      birth_date: '1990-01-01',
      classification: 'regular',
      profile: {
        identities: [],
        contacts: [
          {
            kind: 'phone',
            value: `+25884${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
          },
        ],
        province: 'Maputo',
        district: 'Matola',
        neighbourhood: 'Fomento',
        address: '',
        activity: 'Comércio',
        employer: '',
        income: '1500000',
        expenses: '300000',
        references: [],
        guarantors: [],
      },
      consent: { sms: false, whatsapp: false, email: false, source: '' },
    },
  });
  expect(client.error).toBeNull();
  const terms = {
    method: 'flat',
    periodicity: 'monthly',
    rate: '0.1',
    minPrincipal: '100000',
    maxPrincipal: '5000000',
    minPeriods: 1,
    maxPeriods: 12,
    grace: { periods: 0, treatment: 'free' },
    fees: [],
    taxes: [],
    penalty: {
      toleranceDays: 3,
      dailyRate: '0.005',
      fine: { kind: 'fixed', value: '0' },
    },
    calendar: { holidays: [], weekendDays: [], adjustment: 'none' },
    allocation: ['fine', 'lateInterest', 'interest', 'principal'],
    excess: 'advance',
    settlement: 'due_interest',
    yearDays: 365,
    requirements: {
      documents: [],
      guarantees: [],
      minAge: 18,
      minIncome: '500000',
    },
    approvalLevels: [{ upTo: '5000000', role: 'analyst' }],
  };
  const productName = `Crédito Comércio ${suffix}`;
  const product = await db.rpc('save_product', {
    t,
    product_name: productName,
    conditions: terms,
    expected_revision: 0,
    product_status: 'active',
  });
  expect(product.error).toBeNull();
  return { name, productName, db, t, productId: product.data, terms };
}
test('request → independent approval → contract PDF → manual disbursement', async ({
  page,
}) => {
  test.setTimeout(120000);
  const fixture = await fixtures();
  await login(page, 'manager');
  await page.goto('http://demo.localhost:3000/app/applications');
  await page.getByRole('button', { name: 'Criar pedido', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Encontrar cliente por nome ou documento')
    .fill(fixture.name);
  await expect(
    dialog.getByRole('option', { name: fixture.name, exact: true }),
  ).toBeAttached();
  await dialog
    .getByLabel('Cliente', { exact: true })
    .selectOption({ label: fixture.name });
  await dialog
    .getByLabel('Produto', { exact: true })
    .selectOption({ label: fixture.productName });
  await dialog.getByLabel('Montante pedido', { exact: true }).fill('10000,00');
  await dialog.getByLabel('Número de períodos').fill('6');
  await dialog
    .getByLabel('Finalidade do crédito')
    .fill('Comprar mercadoria para a banca.');
  await expect(dialog.getByText('16 000,00 MT', { exact: true })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole('button', { name: 'Guardar rascunho', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/applications\/[^/]+$/);
  const applicationUrl = page.url();
  await page
    .getByRole('button', { name: 'Submeter pedido', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Iniciar análise', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Iniciar análise', exact: true })
    .click();
  await expect(
    page.getByText(/Quem criou o pedido não o pode decidir/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Aprovar pedido', exact: true }),
  ).toHaveCount(0);
  await login(page, 'analyst');
  await page.goto(applicationUrl);
  await page
    .getByLabel('Parecer de análise')
    .fill('Rendimento comprovado e capacidade de pagamento analisada.');
  await page
    .getByRole('button', { name: 'Aprovar pedido', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Descarregar contrato PDF' }),
  ).toBeVisible();
  const pdfUrl = await page
    .getByRole('link', { name: 'Descarregar contrato PDF' })
    .getAttribute('href');
  const pdf = await page.evaluate(async (path) => {
    const response = await fetch(path);
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
    };
  }, pdfUrl!);
  expect(pdf.status).toBe(200);
  expect(pdf.type).toBe('application/pdf');
  expect(Buffer.from(pdf.bytes).subarray(0, 4).toString()).toBe('%PDF');
  writeFileSync(
    `.local/m4-contract-${test.info().project.name}.pdf`,
    Buffer.from(pdf.bytes),
    { mode: 0o600 },
  );
  const changed = await fixture.db.rpc('save_product', {
    t: fixture.t,
    selected_product: fixture.productId,
    product_name: fixture.productName,
    conditions: { ...fixture.terms, rate: '0.2' },
    expected_revision: 1,
    product_status: 'active',
  });
  expect(changed.error).toBeNull();
  await page.reload();
  await expect(page.getByText('16 000,00 MT', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(async (path) => (await fetch(path)).status, pdfUrl!),
  ).toBe(200);
  await login(page, 'cashier');
  const { data: contracts } = await fixture.db
    .from('contracts')
    .select('id')
    .eq('application_id', applicationUrl.split('/').pop());
  expect(contracts?.length).toBe(1);
  // Cashiers reach approved contracts through a minimal disbursement queue.
  await page.goto(applicationUrl);
  await page
    .getByRole('button', { name: 'Registar desembolso', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Método', exact: true })
    .selectOption('mpesa');
  await dialog
    .getByLabel('Referência do desembolso')
    .fill(`MPESA-${randomUUID().slice(0, 8)}`);
  await dialog.getByLabel('Confirmo que o cliente assinou').check();
  await dialog
    .getByRole('button', { name: 'Confirmar desembolso', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/loans\/[^/]+$/);
  await expect(
    page.getByRole('heading', { name: fixture.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.payment-summary').getByText('16 000,00 MT', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('a different tenant cannot download the approved contract', async ({
  page,
}) => {
  const fixture = await fixtures();
  const clients = await fixture.db.rpc('search_clients', {
    t: fixture.t,
    query: fixture.name,
  });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Maputo',
  }).format(new Date());
  const request = await fixture.db.rpc('save_application', {
    t: fixture.t,
    input: {
      client_id: clients.data[0].id,
      product_id: fixture.productId,
      principal: '1000000',
      periods: 6,
      start_date: today,
      purpose: 'Mercadoria',
      guarantees: [],
    },
  });
  expect(request.error).toBeNull();
  for (const [status, revision] of [
    ['submitted', 1],
    ['in_review', 2],
  ] as const) {
    const r = await fixture.db.rpc('transition_application', {
      t: fixture.t,
      a_id: request.data,
      next_status: status,
      expected_revision: revision,
      note: 'Analisado.',
    });
    expect(r.error).toBeNull();
  }
  const analyst = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await analyst.auth.signInWithPassword(accounts.analyst);
  const approval = await analyst.rpc('transition_application', {
    t: fixture.t,
    a_id: request.data,
    next_status: 'approved',
    expected_revision: 3,
    note: 'Capacidade verificada.',
  });
  expect(approval.error).toBeNull();
  await login(page, 'other', 'beira');
  expect(
    await page.evaluate(
      async (id) => (await fetch(`/api/contracts/${id}`)).status,
      approval.data,
    ),
  ).toBe(404);
});
test('editable contract template and state board remain accessible', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto('http://demo.localhost:3000/app/settings/documents');
  await expect(page.getByLabel('Texto do contrato')).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto('http://demo.localhost:3000/app/applications');
  await page.getByRole('button', { name: 'Ver quadro', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Ver lista', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
