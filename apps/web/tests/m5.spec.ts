import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { simulateContract } from '../../../packages/loan-engine/src/index';
import AxeBuilder from '@axe-core/playwright';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
const m4 = JSON.parse(readFileSync('.local/m4.json', 'utf8'));
async function login(page: Page, key: string, slug: string) {
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
async function fixture() {
  const db = new pg.Client({ connectionString: local.DB_URL });
  await db.connect();
  try {
    const c = (
      await db.query(
        'select c.*,t.slug,a.client_id,a.product_version_id from public.contracts c join public.tenants t on t.id=c.tenant_id join public.applications a on a.id=c.application_id and a.tenant_id=c.tenant_id where c.id=$1',
        [m4.contract],
      )
    ).rows[0];
    const branch = (
      await db.query(
        'insert into public.branches(tenant_id,name) values($1,$2) returning id',
        [c.tenant_id, `M5 ${randomUUID().slice(0, 8)}`],
      )
    ).rows[0].id;
    const a = randomUUID(),
      contract = randomUUID(),
      loan = randomUUID();
    const today = (
      await db.query(
        "select (now() at time zone 'Africa/Maputo')::date::text as day",
      )
    ).rows[0].day;
    const snapshot = {
      ...c.snapshot,
      principal: '1000000',
      periods: 6,
      startDate: today,
      terms: {
        ...c.snapshot.terms,
        method: 'flat',
        rate: '0.1',
        periodicity: 'monthly',
        excess: 'advance',
        grace: { periods: 0, treatment: 'free' },
        fees: [],
        taxes: [],
      },
    };
    await db.query(
      'insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        a,
        c.tenant_id,
        c.client_id,
        branch,
        c.product_version_id,
        '1000000',
        6,
        today,
        'Mercadoria para a banca',
        'disbursed',
        accounts.manager.id,
      ],
    );
    await db.query(
      'insert into public.contracts(id,tenant_id,application_id,branch_id,snapshot,approved_by) values($1,$2,$3,$4,$5,$6)',
      [contract, c.tenant_id, a, branch, snapshot, accounts.analyst.id],
    );
    await db.query(
      "insert into public.loans(id,tenant_id,contract_id,branch_id,disbursed_on,method,reference,signed_on,recorded_by) values($1,$2,$3,$4,$5,'mpesa','M5-NAVEGADOR',$5,$6)",
      [loan, c.tenant_id, contract, branch, today, accounts.cashier.id],
    );
    const key = (
      await db.query(
        'select secret from financial_private.signing_key where id',
      )
    ).rows[0].secret;
    const plan = simulateContract(1, {
      principal: 1000000n,
      periods: 6,
      startDate: today,
      terms: snapshot.terms,
    });
    const plan_payload = JSON.stringify(
      {
        tenant: c.tenant_id,
        contract,
        actor: accounts.manager.id,
        expires: new Date(Date.now() + 300000).toISOString(),
        plan,
      },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    );
    const client = createClient(local.API_URL, local.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      (await client.auth.signInWithPassword(accounts.manager)).error,
    ).toBeNull();
    expect(
      (
        await client.rpc('initialise_loan', {
          t: c.tenant_id,
          l: loan,
          plan_payload,
          plan_signature: createHmac('sha256', key)
            .update(plan_payload)
            .digest('hex'),
        })
      ).error,
    ).toBeNull();
    return { loan, branch, slug: c.slug, client };
  } finally {
    await db.end();
  }
}
test('payment in three actions → private numbered PDF and QR → reversal preserves receipt', async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await fixture();
  await login(page, 'cashier', f.slug);
  await page.goto(`http://${f.slug}.localhost:3000/app/loans?payment=1`);
  await page.getByLabel('Pesquisar cliente ou número do crédito').fill(f.loan);
  await expect(page.locator('.client-name')).toHaveCount(1);
  await page.locator('.client-name').click();
  await expect(page).toHaveURL(/payment=1$/);
  let drawer = page.getByRole('dialog');
  await drawer.getByLabel('Valor recebido').fill('1000,00');
  await drawer
    .getByLabel('Método de pagamento', { exact: true })
    .selectOption('mpesa');
  await drawer.getByLabel('Referência', { exact: true }).fill('MPESA-M5');
  await drawer
    .getByRole('button', { name: 'Conferir pagamento', exact: true })
    .click();
  await expect(
    drawer.getByRole('heading', { name: 'Como o valor será aplicado' }),
  ).toBeVisible();
  await expect(drawer.getByText(/Juros/)).toBeVisible();
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await drawer
    .getByRole('button', { name: 'Confirmar pagamento', exact: true })
    .click();
  await expect(
    drawer.getByText('Pagamento registado', { exact: true }),
  ).toBeVisible();
  const url = await drawer
    .getByRole('link', { name: 'Descarregar recibo' })
    .getAttribute('href');
  const pdf = await page.evaluate(async (path) => {
    const r = await fetch(path);
    return {
      status: r.status,
      cache: r.headers.get('cache-control'),
      type: r.headers.get('content-type'),
      bytes: Array.from(new Uint8Array(await r.arrayBuffer())),
    };
  }, url!);
  expect(pdf.status).toBe(200);
  expect(pdf.type).toBe('application/pdf');
  expect(pdf.cache).toBe('private, no-store');
  expect(Buffer.from(pdf.bytes).subarray(0, 4).toString()).toBe('%PDF');
  writeFileSync(
    `.local/m5-receipt-${test.info().project.name}.pdf`,
    Buffer.from(pdf.bytes),
    { mode: 0o600 },
  );
  await drawer.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(
    page.locator('.payment-summary').getByText('15 000,00 MT', { exact: true }),
  ).toBeVisible();
  await login(page, 'manager', f.slug);
  await page.goto(`http://${f.slug}.localhost:3000/app/loans/${f.loan}`);
  await page
    .getByRole('button', { name: 'Estornar pagamento', exact: true })
    .click();
  drawer = page.getByRole('dialog');
  await drawer
    .getByLabel('Motivo do estorno')
    .fill('Referência duplicada confirmada');
  await drawer.getByRole('button', { name: 'Confirmar estorno' }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByText('Estornado', { exact: true })).toBeVisible();
  await expect(
    page.locator('.payment-summary').getByText('16 000,00 MT', { exact: true }),
  ).toBeVisible();
  const reversed = await page.evaluate(
    async (path) => (await fetch(path)).status,
    url!,
  );
  expect(reversed).toBe(200);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await login(page, 'other', 'beira');
  expect(
    await page.evaluate(async (path) => (await fetch(path)).status, url!),
  ).toBe(404);
});
test('agency cash opening → cash receipt → deposit → counted close and Today', async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await fixture();
  await login(page, 'cashier', f.slug);
  await page.goto(
    `http://${f.slug}.localhost:3000/app/cash?branch=${f.branch}`,
  );
  await page.getByRole('button', { name: 'Abrir caixa', exact: true }).click();
  let drawer = page.getByRole('dialog');
  await drawer.getByLabel('Numerário na abertura').fill('10000,00');
  await drawer.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Fechar caixa', exact: true }),
  ).toBeVisible();
  await page.goto(`http://${f.slug}.localhost:3000/app/loans/${f.loan}`);
  await page
    .getByRole('button', { name: 'Registar pagamento', exact: true })
    .click();
  drawer = page.getByRole('dialog');
  await drawer.getByLabel('Valor recebido').fill('100,00');
  await drawer.getByRole('button', { name: 'Conferir pagamento' }).click();
  await drawer.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(drawer.getByText('Pagamento registado')).toBeVisible();
  await drawer.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.goto(
    `http://${f.slug}.localhost:3000/app/cash?branch=${f.branch}`,
  );
  await expect(page.getByText('10 100,00 MT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registar depósito' }).click();
  drawer = page.getByRole('dialog');
  await drawer.getByLabel('Valor do depósito').fill('100,00');
  await drawer.getByLabel('Referência do depósito').fill('Banco-M5');
  await drawer.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Fechar caixa', exact: true }).click();
  drawer = page.getByRole('dialog');
  await drawer.getByLabel('Numerário contado').fill('10000,00');
  await expect(drawer.getByText('0,00 MT', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByText('Caixa fechado', { exact: true })).toBeVisible();
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
  await page.goto(`http://${f.slug}.localhost:3000/app`);
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.today-summary > div')).toHaveCount(4);
  await expect(
    page.getByRole('link', { name: 'Ver caixa', exact: true }),
  ).toBeVisible();
});
test('read-only users see exact statement without payment or cash controls', async ({
  page,
}) => {
  const f = await fixture();
  await login(page, 'reader', f.slug);
  await page.goto(`http://${f.slug}.localhost:3000/app/loans/${f.loan}`);
  await expect(
    page.getByRole('heading', { name: 'Extracto do crédito', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Registar pagamento', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Estornar pagamento', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
