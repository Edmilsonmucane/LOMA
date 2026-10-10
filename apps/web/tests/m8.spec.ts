import { test, expect as baseExpect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { demoDataset } from '../src/lib/domain/demo';
const expect = baseExpect.configure({ timeout: 30000 });
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8')),
  accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
let root: string, t: string, client: string;
test.describe.configure({ mode: 'serial', timeout: 120000 });
test.beforeAll(async () => {
  const admin = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(
    (await admin.auth.signInWithPassword(accounts.platform)).error,
  ).toBeNull();
  const slug = 'm8-' + randomUUID().slice(0, 8);
  const result = await admin.rpc('provision_tenant', {
    tenant_name: 'Demo Microcrédito',
    tenant_slug: slug,
    preset_id: '20000000-0000-4000-8000-000000000001',
    selected_plan_id: '10000000-0000-4000-8000-000000000001',
  });
  expect(result.error).toBeNull();
  t = result.data;
  const db = new pg.Client({ connectionString: local.DB_URL });
  await db.connect();
  try {
    for (const [key, role] of [
      ['sales', 'manager'],
      ['analyst', 'analyst'],
      ['reader', 'reader'],
      ['cashier', 'cashier'],
    ])
      await db.query(
        'insert into public.memberships(tenant_id,user_id,role_id,display_name,email) select $1,$2,id,$3,$4 from public.tenant_roles where tenant_id=$1 and key=$5',
        [t, accounts[key!].id, accounts[key!].name, accounts[key!].email, role],
      );
    expect((await admin.rpc('enable_demo', { t })).error).toBeNull();
    const sales = createClient(local.API_URL, local.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      (await sales.auth.signInWithPassword(accounts.sales)).error,
    ).toBeNull();
    const blueprint = (await sales.rpc('demo_blueprint', { t })).data;
    const products = blueprint.products.map(
      (p: Parameters<typeof demoDataset>[0][number]) => ({
        ...p,
        terms: {
          ...p.terms,
          requirements: {
            ...p.terms.requirements,
            documents: [],
            guarantees: [],
          },
        },
      }),
    );
    const key = (
      await db.query(
        'select secret from financial_private.signing_key where id',
      )
    ).rows[0].secret;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Maputo',
    }).format(new Date());
    const payload = JSON.stringify(
      {
        tenant: t,
        actor: accounts.sales.id,
        generation: 0,
        expires: new Date(Date.now() + 300000).toISOString(),
        dataset: demoDataset(products, today),
      },
      (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v),
    );
    const reset = await sales.rpc('reset_demo', {
      t,
      expected_generation: 0,
      payload,
      signature: createHmac('sha256', key)
        .update('demo:' + payload)
        .digest('hex'),
    });
    expect(reset.error).toBeNull();
    t = reset.data;
    client = (
      await db.query(
        'select id from public.clients where tenant_id=$1 order by name limit 1',
        [t],
      )
    ).rows[0].id;
    root = `http://${slug}.localhost:3000`;
  } finally {
    await db.end();
  }
});
async function login(page: Page, key = 'sales') {
  await page.goto(root + '/login');
  await expect(page.locator('form')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Email', { exact: true }).fill(accounts[key].email);
  await page
    .getByLabel('Palavra-passe', { exact: true })
    .fill(accounts[key].password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/app');
}
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

test('M8 reports filter real portfolio and export identical protected CSV/PDF for reader', async ({
  page,
}) => {
  await login(page, 'reader');
  await page.goto(root + '/app/reports?kind=portfolio');
  await expect(
    page.getByRole('heading', { name: 'Relatórios', exact: true }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).not.toHaveCount(0);
  await accessible(page);
  await page.screenshot({
    path: `.local/m8-reports-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  for (const [name, type, prefix] of [
    ['Exportar CSV', 'text/csv', '\ufeff'],
    ['Exportar PDF', 'application/pdf', '%PDF'],
  ]) {
    const href = await page
      .getByRole('link', { name: name!, exact: true })
      .getAttribute('href');
    const result = await page.evaluate(async (path) => {
      const r = await fetch(path);
      return {
        status: r.status,
        type: r.headers.get('content-type'),
        cache: r.headers.get('cache-control'),
        text: await r.text(),
      };
    }, href!);
    expect(result.status).toBe(200);
    expect(result.type).toContain(type!);
    expect(result.cache).toContain('no-store');
    if (prefix === '\ufeff') {
      expect(result.text).toContain('Capital em dívida');
      expect(result.text).toContain('\r\n');
    } else expect(result.text.startsWith(prefix!)).toBe(true);
  }
  await page.getByLabel('Relatório', { exact: true }).selectOption('statement');
  await page.getByLabel('Cliente', { exact: true }).selectOption(client);
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Extracto de cliente', exact: true }),
  ).toBeVisible();
  await accessible(page);
});
test('M8 scoring previews weights, saves classes and records verified evidence accessibly', async ({
  page,
}) => {
  await login(page);
  await page.goto(root + '/app/settings/scoring');
  await accessible(page);
  await page.screenshot({
    path: `.local/m8-scoring-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.locator('.score-criterion summary').first().click();
  await page.getByLabel('Peso', { exact: true }).first().fill('35');
  await expect(page.locator('.score-preview')).toContainText('Classe');
  await page
    .getByRole('button', { name: 'Guardar alterações', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText('Alterações guardadas.', {
    timeout: 90000,
  });
  await page.goto(root + `/app/clients/${client}`);
  await expect(
    page.getByRole('heading', {
      name: 'Classe de risco do cliente',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Registar informação comprovada',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Emprego comprovado (meses)', { exact: true })
    .fill('24');
  await dialog.getByLabel('Referências verificadas', { exact: true }).fill('2');
  await dialog
    .getByLabel('Nota e fonte da informação', { exact: true })
    .fill('Declaração sintética de emprego e duas referências verificadas.');
  await accessible(page);
  await dialog
    .getByRole('button', { name: 'Guardar alterações', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByText('Ver como foi calculado', { exact: true }).click();
  await expect(page.locator('.score-panel tbody')).toContainText('24');
  await accessible(page);
});
test('M8 full flow: product → public simulation/document → approval → disbursement → receipt → automatic overdue reminder → collection', async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await login(page);
  await page.goto(root + '/app/settings/products');
  await page
    .getByRole('button', { name: 'Criar produto', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  const productName = 'Crédito banca ' + randomUUID().slice(0, 6);
  await dialog.getByLabel('Nome do produto').fill(productName);
  await dialog.getByLabel('Como calcular os juros').selectOption('flat');
  await dialog.getByLabel('Taxa por período (%)', { exact: true }).fill('10');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog.getByText('Documentos e elegibilidade', { exact: true }).click();
  await dialog
    .getByLabel('Documentos necessários', { exact: true })
    .fill('Bilhete de identidade');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Publicar condições', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const db = new pg.Client({ connectionString: local.DB_URL });
  await db.connect();
  let clockName: string | undefined;
  try {
    const product = (
      await db.query(
        'select id from public.products where tenant_id=$1 and name=$2',
        [t, productName],
      )
    ).rows[0].id;
    const customer = await context.newPage();
    await customer.goto(
      root + `/simulate?product=${product}&principal=1000000&periods=6`,
    );
    await expect(customer.locator('[data-quote="total"]')).toContainText(
      '16 000,00 MT',
    );
    await customer.locator('[data-request]').click();
    await phoneLogin(customer);
    const name = 'Graça Nhantumbo ' + randomUUID().slice(0, 6);
    await customer.getByLabel('Nome completo', { exact: true }).fill(name);
    await customer
      .getByLabel('Data de nascimento', { exact: true })
      .fill('1990-01-12');
    await customer
      .getByLabel('Número do documento', { exact: true })
      .fill('M8' + randomUUID().slice(0, 10));
    await customer.getByLabel('Província', { exact: true }).fill('Maputo');
    await customer.getByLabel('Bairro', { exact: true }).fill('Polana Cimento');
    await customer
      .getByRole('button', { name: 'Continuar', exact: true })
      .click();
    await customer
      .getByLabel('Para que precisa do crédito?', { exact: true })
      .fill('Comprar mercadoria para a banca.');
    await customer
      .getByLabel('Rendimento mensal (MT)', { exact: true })
      .fill('20000,00');
    await customer
      .getByLabel('Despesas mensais (MT)', { exact: true })
      .fill('4000,00');
    await customer
      .getByRole('button', { name: 'Continuar', exact: true })
      .click();
    await customer
      .getByLabel('Tipo de documento', { exact: true })
      .selectOption('Bilhete de identidade');
    const identityDocument = await PDFDocument.create();
    identityDocument.addPage().drawText('Documento sintetico de teste M8.');
    await customer
      .getByLabel('Fotografia ou ficheiro', { exact: true })
      .setInputFiles({
        name: 'bilhete.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(await identityDocument.save()),
      });
    await customer
      .getByRole('button', { name: 'Enviar documento', exact: true })
      .click();
    await expect(customer.locator('form [data-status]')).toHaveText(
      'Documento enviado.',
    );
    await customer
      .getByRole('button', { name: 'Continuar', exact: true })
      .click();
    await customer
      .getByRole('checkbox', { name: /Li e aceito os termos/ })
      .check();
    await customer
      .getByRole('button', { name: 'Enviar pedido', exact: true })
      .click();
    await expect(
      customer.getByRole('heading', { name: /Pedido enviado. Número/ }),
    ).toBeVisible();
    await customer.close();
    const application = (
      await db.query(
        'select a.id,a.client_id from public.applications a join public.clients c on c.id=a.client_id where a.tenant_id=$1 and c.name=$2',
        [t, name],
      )
    ).rows[0];
    // Local temporal fixture: move only the mutable, unapproved proposal date. Never rewrite a contract, payment or ledger entry.
    await db.query(
      "update public.applications set start_date=(now() at time zone 'Africa/Maputo')::date-40 where tenant_id=$1 and id=$2 and status='submitted'",
      [t, application.id],
    );
    clockName = 'm8_clock_' + randomUUID().replaceAll('-', '');
    // Set the approval event's fixture time only at INSERT, scoped to this one synthetic proposal.
    // Existing immutable contracts and all production date checks remain intact.
    await db.query(
      `create function scoring_private.${clockName}() returns trigger language plpgsql security definer set search_path='' as $clock$begin if new.tenant_id='${t}'::uuid and new.application_id='${application.id}'::uuid then new.approved_at=(new.snapshot->>'startDate')::date;end if;return new;end;$clock$;revoke all on function scoring_private.${clockName}() from public,anon,authenticated;create trigger ${clockName} before insert on public.contracts for each row execute function scoring_private.${clockName}();`,
    );
    await page.goto(root + `/app/applications/${application.id}`);
    await page
      .getByRole('button', { name: 'Iniciar análise', exact: true })
      .click();
    await page
      .getByLabel('Parecer de análise')
      .fill(
        'Rendimento e documento verificados. Condições confirmadas com o cliente.',
      );
    await page
      .getByRole('button', { name: 'Aprovar pedido', exact: true })
      .click();
    await expect(
      page.getByRole('link', { name: 'Descarregar contrato PDF' }),
    ).toBeVisible();
    await accessible(page);
    await page
      .getByRole('button', { name: 'Registar desembolso', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Método', exact: true })
      .selectOption('transfer');
    await dialog
      .getByLabel('Referência do desembolso')
      .fill('M8-' + randomUUID().slice(0, 6));
    await dialog.getByLabel('Confirmo que o cliente assinou').check();
    await dialog
      .getByRole('button', { name: 'Confirmar desembolso', exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/loans\/[^/]+$/);
    const loan = page.url().split('/').pop()!;
    await page
      .getByRole('button', { name: 'Registar pagamento', exact: true })
      .first()
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Valor recebido').fill('1000,00');
    await dialog
      .getByLabel('Método de pagamento', { exact: true })
      .selectOption('transfer');
    await dialog
      .getByLabel('Referência', { exact: true })
      .fill('M8-P-' + randomUUID().slice(0, 6));
    await dialog
      .getByRole('button', { name: 'Conferir pagamento', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'Confirmar pagamento', exact: true })
      .click();
    await expect(
      dialog.getByText('Pagamento registado', { exact: true }),
    ).toBeVisible();
    const receipt = await dialog
      .getByRole('link', { name: 'Descarregar recibo' })
      .getAttribute('href');
    expect(
      await page.evaluate(async (path) => {
        const r = await fetch(path);
        return r.status;
      }, receipt!),
    ).toBe(200);
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    // Editable temporal/communication fixtures remain confined to this dedicated demonstration tenant.
    const actor = createClient(local.API_URL, local.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(
      (await actor.auth.signInWithPassword(accounts.sales)).error,
    ).toBeNull();
    expect(
      (
        await actor.rpc('set_communication_consent', {
          t,
          c: application.client_id,
          ch: 'sms',
          enabled: true,
          source: 'Consentimento sintético do fluxo M8.',
        })
      ).error,
    ).toBeNull();
    const rule = (
      await actor
        .from('tenant_configuration')
        .select('value')
        .eq('tenant_id', t)
        .eq('category', 'communication')
        .eq('key', 'rules')
        .single()
    ).data!.value;
    expect(
      (
        await actor.rpc('save_communication_configuration', {
          t,
          category_name: 'communication',
          key_name: 'rules',
          settings: { ...rule, startHour: 0, endHour: 24, maxPerDay: 10 },
        })
      ).error,
    ).toBeNull();
    const days = (
      await db.query(
        "select ((now() at time zone 'Africa/Maputo')::date-min(due_date))::int days from public.loan_instalments where tenant_id=$1 and loan_id=$2 and principal+interest>0",
        [t, loan],
      )
    ).rows[0].days;
    expect(days).toBeGreaterThan(0);
    expect(
      (
        await actor.rpc('save_communication_configuration', {
          t,
          category_name: 'automation',
          key_name: 'm8_due',
          settings: {
            enabled: true,
            event: 'due',
            offsetDays: days,
            template: 'reminder',
            channel: 'sms',
          },
        })
      ).error,
    ).toBeNull();
    await expect
      .poll(
        async () => {
          const rows = (
            await db.query(
              "select status,provider_id from public.message_jobs where tenant_id=$1 and client_id=$2 and source_key like 'due:m8_due:%'",
              [t, application.client_id],
            )
          ).rows;
          return rows.some(
            (x) =>
              x.status === 'accepted' && x.provider_id?.startsWith('console:'),
          );
        },
        { timeout: 90000, intervals: [1000, 3000, 5000] },
      )
      .toBe(true);
    await page.goto(root + '/app/collections?q=' + encodeURIComponent(name));
    const row = page
      .locator('.collection-row')
      .filter({ has: page.locator(`a[href="/app/loans/${loan}"]`) });
    await expect(row).toBeVisible();
    await row
      .getByRole('button', { name: 'Registar contacto', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('O que aconteceu', { exact: true })
      .selectOption('contact');
    await dialog
      .getByLabel('Nota', { exact: true })
      .fill('Cliente contactado após o lembrete automático.');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row).toContainText(
      'Cliente contactado após o lembrete automático.',
    );
    await accessible(page);
  } finally {
    if (clockName)
      await db.query(
        `drop trigger if exists ${clockName} on public.contracts;drop function if exists scoring_private.${clockName}();`,
      );
    await db.end();
  }
});
test('M8 reset confirms the effect, creates a new generation and preserves the old contracts', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  await page.goto(root + '/app/settings/demo');
  await accessible(page);
  await page
    .getByRole('button', { name: 'Repor demonstração', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('ficam arquivados');
  await dialog.getByRole('checkbox').check();
  await accessible(page);
  await dialog
    .getByRole('button', { name: 'Repor demonstração', exact: true })
    .click();
  await expect(dialog).not.toBeVisible({ timeout: 90000 });
  await expect(page.locator('main')).toContainText('Geração 2', {
    timeout: 90000,
  });
  const db = new pg.Client({ connectionString: local.DB_URL });
  await db.connect();
  try {
    expect(
      (await db.query('select active from public.tenants where id=$1', [t]))
        .rows[0].active,
    ).toBe(false);
    expect(
      (
        await db.query(
          'select count(*)::int n from public.contracts where tenant_id=$1',
          [t],
        )
      ).rows[0].n,
    ).toBe(61);
  } finally {
    await db.end();
  }
  await accessible(page);
});
