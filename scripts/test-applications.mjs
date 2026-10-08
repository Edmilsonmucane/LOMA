import { engine } from './engine-runtime.mjs';
import { attestPlan } from './financial-plan.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local verification only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
async function login(key) {
  const c = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await c.auth.signInWithPassword(accounts[key]);
  assert(!r.error, 'Login failed');
  return c;
}
function ok(r) {
  assert(!r.error, `Operation failed: ${r.error?.code}`);
  return r.data;
}
try {
  const [platform, manager, analyst, cashier, reader, other, collector] =
    await Promise.all(
      [
        'platform',
        'manager',
        'analyst',
        'cashier',
        'reader',
        'other',
        'collector',
      ].map(login),
    );
  const t = ok(
    await platform.rpc('provision_tenant', {
      tenant_name: 'Verificação M4',
      tenant_slug: `pedidos-${randomUUID().slice(0, 8)}`,
      preset_id: '20000000-0000-4000-8000-000000000001',
      selected_plan_id: '10000000-0000-4000-8000-000000000001',
    }),
  );
  for (const [key, role] of [
    ['manager', 'manager'],
    ['analyst', 'analyst'],
    ['cashier', 'cashier'],
    ['reader', 'reader'],
    ['collector', 'collector'],
  ])
    await db.query(
      'insert into public.memberships(tenant_id,user_id,role_id,display_name,email) select $1,$2,id,$3,$4 from public.tenant_roles where tenant_id=$1 and key=$5',
      [t, accounts[key].id, accounts[key].name, accounts[key].email, role],
    );
  const b = (
    await db.query('select id from public.branches where tenant_id=$1', [t])
  ).rows[0].id;
  const clientData = {
    name: `Celina Machel ${randomUUID().slice(0, 8)}`,
    branch_id: b,
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
      district: 'Maputo',
      neighbourhood: 'Alto Maé',
      address: '',
      activity: 'Comércio',
      employer: '',
      income: '1500000',
      expenses: '300000',
      references: [],
      guarantors: [],
    },
    consent: { sms: false, whatsapp: false, email: false, source: '' },
  };
  const c = ok(
    await manager.rpc('save_client', { t, client_data: clientData }),
  );
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
    approvalLevels: [
      { upTo: '1500000', role: 'analyst' },
      { upTo: '5000000', role: 'manager' },
    ],
  };
  const p = ok(
    await manager.rpc('save_product', {
      t,
      product_name: 'Crédito Comércio M4',
      conditions: terms,
      expected_revision: 0,
      product_status: 'active',
    }),
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Maputo',
  }).format(new Date());
  const input = {
    client_id: c,
    product_id: p,
    principal: '1000000',
    periods: 6,
    start_date: today,
    purpose: 'Comprar mercadoria para a banca.',
    guarantees: [],
  };
  async function create(data = input) {
    return ok(await manager.rpc('save_application', { t, input: data }));
  }
  async function transition(
    actor,
    a,
    status,
    revision,
    note = 'Análise de rendimento e capacidade concluída.',
  ) {
    return actor.rpc('transition_application', {
      t,
      a_id: a,
      next_status: status,
      expected_revision: revision,
      note,
    });
  }
  const a = await create();
  await check(
    'Draft, revision conflict, immutable submitted inputs and mandatory review',
    async () => {
      assert.equal(
        (await transition(analyst, a, 'approved', 1)).error?.code,
        '23514',
      );
      assert.equal(
        (await transition(manager, a, 'submitted', 8)).error?.code,
        'PT409',
      );
      ok(await transition(manager, a, 'submitted', 1));
      assert.equal(
        (
          await manager.rpc('save_application', {
            t,
            input,
            selected_application: a,
            expected_revision: 2,
          })
        ).error?.code,
        '23514',
      );
      ok(await transition(analyst, a, 'in_review', 2));
    },
  );
  await check(
    'Creator separation and configured amount approval levels',
    async () => {
      assert.equal(
        (await transition(manager, a, 'approved', 3)).error?.code,
        '42501',
      );
      assert.equal(
        (await transition(reader, a, 'approved', 3)).error?.code,
        '42501',
      );
      const high = await create({ ...input, principal: '2000000' });
      ok(await transition(manager, high, 'submitted', 1));
      ok(await transition(analyst, high, 'in_review', 2));
      assert.equal(
        (await transition(analyst, high, 'approved', 3)).error?.code,
        '42501',
      );
      assert.equal(
        (await transition(analyst, a, 'declined', 3, '')).error?.code,
        '42501',
      );
    },
  );
  let contract;
  await check(
    'Approval snapshots client, terms, template and brand atomically',
    async () => {
      contract = ok(await transition(analyst, a, 'approved', 3));
      const stored = ok(
        await analyst.from('contracts').select('*').eq('id', contract).single(),
      );
      assert.equal(stored.snapshot.terms.rate, '0.1');
      assert.equal(stored.snapshot.client.name, clientData.name);
      assert.equal(stored.snapshot.principal, '1000000');
      assert.equal(stored.engine_version, 1);
      assert.equal(
        (await transition(analyst, a, 'approved', 3)).error?.code,
        'PT409',
      );
    },
  );
  const before = (
    await db.query('select snapshot from public.contracts where id=$1', [
      contract,
    ])
  ).rows[0].snapshot;
  await check(
    'Later product/client/template edits cannot change the approved contract',
    async () => {
      ok(
        await manager.rpc('save_product', {
          t,
          selected_product: p,
          product_name: 'Novo crédito',
          conditions: { ...terms, rate: '0.2' },
          expected_revision: 1,
          product_status: 'active',
        }),
      );
      ok(
        await manager.rpc('save_client', {
          t,
          selected_client: c,
          expected_revision: 1,
          client_data: { ...clientData, name: 'Novo nome' },
        }),
      );
      ok(
        await manager
          .from('tenant_configuration')
          .update({ value: { title: 'Novo modelo', body: 'Novo texto' } })
          .eq('tenant_id', t)
          .eq('category', 'document')
          .eq('key', 'contract'),
      );
      const after = (
        await db.query('select snapshot from public.contracts where id=$1', [
          contract,
        ])
      ).rows[0].snapshot;
      assert.deepEqual(after, before);
      assert(
        (
          await manager
            .from('contracts')
            .update({ snapshot: {} })
            .eq('id', contract)
        ).error,
      );
      await assert.rejects(
        db.query("update public.contracts set snapshot='{}' where id=$1", [
          contract,
        ]),
        (e) => e.code === '42501',
      );
    },
  );
  const storedContract = (
    await db.query('select * from public.contracts where id=$1', [contract])
  ).rows[0];
  const sc = storedContract.snapshot;
  const plan = engine.simulate({
    principal: BigInt(sc.principal),
    periods: sc.periods,
    startDate: sc.startDate,
    terms: sc.terms,
  });
  const key = (
    await db.query('select secret from financial_private.signing_key where id')
  ).rows[0].secret;
  const disburse = {
    ...attestPlan({
      tenant: t,
      contract,
      actor: accounts.cashier.id,
      plan,
      key,
    }),
    t,
    a_id: a,
    expected_revision: 4,
    payment_method: 'mpesa',
    payment_reference: 'M4-VERIFICADO',
    disbursement_date: today,
    signature_date: today,
  };
  let loan;
  await check(
    'Authorised disbursement creates exactly one loan with agreed dates',
    async () => {
      assert.equal(
        (await analyst.rpc('disburse_application', disburse)).error?.code,
        '42501',
      );
      assert.equal(
        (
          await cashier.rpc('disburse_application', {
            ...disburse,
            disbursement_date: '2000-01-01',
          })
        ).error?.code,
        '23514',
      );
      const simultaneous = await Promise.all([
        cashier.rpc('disburse_application', disburse),
        cashier.rpc('disburse_application', disburse),
      ]);
      assert.equal(simultaneous.filter((x) => !x.error).length, 1);
      assert.equal(
        simultaneous.filter((x) => x.error?.code === 'PT409').length,
        1,
      );
      loan = simultaneous.find((x) => !x.error).data;
      assert.equal(
        ok(await reader.from('loans').select('*').eq('id', loan).single())
          .contract_id,
        contract,
      );
    },
  );
  await check(
    'Real RLS blocks cross-tenant reads, writes, RPCs and agency scope',
    async () => {
      for (const table of [
        'applications',
        'application_events',
        'contracts',
        'loans',
      ]) {
        assert.equal(
          ok(await other.from(table).select('id').eq('tenant_id', t)).length,
          0,
        );
        assert((await other.from(table).insert({ tenant_id: t })).error);
      }
      assert.equal(
        (await other.rpc('save_application', { t, input })).error?.code,
        '42501',
      );
      assert.equal(
        (await other.rpc('search_applications', { t })).error?.code,
        '42501',
      );
      assert.equal(
        (await other.rpc('disburse_application', disburse)).error?.code,
        '42501',
      );
      const outside = (
        await db.query(
          'insert into public.branches(tenant_id,name) values($1,$2) returning id',
          [t, 'Agência fora da carteira'],
        )
      ).rows[0].id;
      await db.query(
        'update public.memberships set branch_id=$1 where tenant_id=$2 and user_id=$3',
        [outside, t, accounts.collector.id],
      );
      assert.equal(
        ok(await collector.from('loans').select('id').eq('tenant_id', t))
          .length,
        0,
      );
      assert.equal(
        ok(await collector.from('contracts').select('id').eq('tenant_id', t))
          .length,
        0,
      );
      assert.equal(
        (await collector.rpc('disburse_application', disburse)).error?.code,
        '42501',
      );
    },
  );
  await check(
    'Decline reason, revised draft and cancellation preserve history',
    async () => {
      const declined = await create();
      ok(await transition(manager, declined, 'submitted', 1));
      ok(await transition(analyst, declined, 'in_review', 2));
      ok(
        await transition(
          analyst,
          declined,
          'declined',
          3,
          'Rendimento insuficiente para este prazo.',
        ),
      );
      assert.equal(
        ok(
          await analyst
            .from('applications')
            .select('decision_reason')
            .eq('id', declined)
            .single(),
        ).decision_reason,
        'Rendimento insuficiente para este prazo.',
      );
      const revise = await create();
      ok(await transition(manager, revise, 'submitted', 1));
      ok(await transition(analyst, revise, 'draft', 2));
      ok(
        await manager.rpc('save_application', {
          t,
          selected_application: revise,
          expected_revision: 3,
          input: { ...input, purpose: 'Pedido revisto.' },
        }),
      );
      ok(await transition(manager, revise, 'cancelled', 4));
      assert.equal(
        ok(
          await manager
            .from('application_events')
            .select('id')
            .eq('application_id', revise),
        ).length,
        5,
      );
    },
  );
  await check(
    'Eligibility documents, guarantees and changed active product are enforced in SQL',
    async () => {
      const required = {
        ...terms,
        requirements: {
          documents: ['Bilhete de identidade'],
          guarantees: ['Fiador'],
          minAge: 18,
          minIncome: '500000',
        },
      };
      const reqP = ok(
        await manager.rpc('save_product', {
          t,
          product_name: 'Crédito com documentos',
          conditions: required,
          expected_revision: 0,
          product_status: 'active',
        }),
      );
      const req = await create({ ...input, product_id: reqP });
      ok(await transition(manager, req, 'submitted', 1));
      ok(await transition(analyst, req, 'in_review', 2));
      assert.equal(
        (await transition(analyst, req, 'approved', 3)).error?.code,
        '23514',
      );
      const stale = await create();
      ok(await transition(manager, stale, 'submitted', 1));
      ok(await transition(analyst, stale, 'in_review', 2));
      ok(
        await manager.rpc('save_product', {
          t,
          selected_product: p,
          product_name: 'Versão alterada',
          conditions: terms,
          expected_revision: 2,
          product_status: 'active',
        }),
      );
      assert.equal(
        (await transition(analyst, stale, 'approved', 3)).error?.code,
        'PT409',
      );
    },
  );
  await check(
    'Preview conflicts and underwriting requirements remain server-enforced',
    async () => {
      const oldVersion = (
        await db.query(
          'select id from public.product_versions where tenant_id=$1 and product_id=$2 and version=1',
          [t, p],
        )
      ).rows[0].id;
      assert.equal(
        (
          await manager.rpc('save_application', {
            t,
            input: { ...input, product_version_id: oldVersion },
          })
        ).error?.code,
        'PT409',
      );
      for (const requirement of [
        { minAge: 80, minIncome: null },
        { minAge: null, minIncome: '999999999' },
      ]) {
        const underwriting = ok(
          await manager.rpc('save_product', {
            t,
            product_name: 'Elegibilidade verificada',
            conditions: {
              ...terms,
              requirements: { documents: [], guarantees: [], ...requirement },
            },
            expected_revision: 0,
            product_status: 'active',
          }),
        );
        const request = await create({ ...input, product_id: underwriting });
        ok(await transition(manager, request, 'submitted', 1));
        ok(await transition(analyst, request, 'in_review', 2));
        assert.equal(
          (await transition(analyst, request, 'approved', 3)).error?.code,
          '23514',
        );
      }
    },
  );
  await check(
    'Loan search and customer timeline preserve isolation and approved identity',
    async () => {
      assert.equal(
        (await other.rpc('search_loans', { t })).error?.code,
        '42501',
      );
      assert.equal(ok(await collector.rpc('search_loans', { t })).length, 0);
      const result = ok(
        await reader.rpc('search_loans', { t, query: clientData.name }),
      );
      assert.equal(result.length, 1);
      assert.equal(result[0].principal, '1000000');
      assert.equal(result[0].client_name, clientData.name);
      const timeline = ok(
        await manager
          .from('client_events')
          .select('detail')
          .eq('tenant_id', t)
          .eq('client_id', c)
          .eq('kind', 'application'),
      );
      assert(
        timeline.some(
          (e) =>
            e.detail.application_id === a && e.detail.status === 'disbursed',
        ),
      );
    },
  );
  await check(
    'Contract access is individually audited and rejects outsiders',
    async () => {
      assert.equal(
        (await other.rpc('log_contract_access', { t, c_id: contract })).error
          ?.code,
        '42501',
      );
      ok(await reader.rpc('log_contract_access', { t, c_id: contract }));
      const audits = ok(
        await manager
          .from('audit_events')
          .select('actor_id')
          .eq('tenant_id', t)
          .eq('entity', 'contracts')
          .eq('entity_id', contract)
          .eq('action', 'access'),
      );
      assert(audits.some((e) => e.actor_id === accounts.reader.id));
    },
  );
  await check(
    'A pending product draft preserves the published version for requests',
    async () => {
      ok(
        await manager.rpc('save_product', {
          t,
          selected_product: p,
          product_name: 'Rascunho pendente',
          conditions: { ...terms, rate: '0.3' },
          expected_revision: 3,
          product_status: 'draft',
        }),
      );
      const pending = await create();
      ok(await transition(manager, pending, 'submitted', 1));
      ok(await transition(analyst, pending, 'in_review', 2));
      const saved = ok(await transition(analyst, pending, 'approved', 3));
      const published = ok(
        await reader
          .from('contracts')
          .select('snapshot')
          .eq('id', saved)
          .single(),
      );
      assert.equal(published.snapshot.terms.rate, '0.1');
      assert.equal(published.snapshot.productVersion, 3);
      ok(
        await manager.rpc('save_product', {
          t,
          selected_product: p,
          product_name: 'Produto arquivado',
          conditions: terms,
          expected_revision: 4,
          product_status: 'archived',
        }),
      );
      assert.equal(
        (await manager.rpc('save_application', { t, input })).error?.code,
        '23514',
      );
    },
  );
  // Private fixtures may be reused by browser checks; do not publish identifiers or credentials.
  writeFileSync(
    '.local/m4.json',
    JSON.stringify({
      tenant: t,
      application: a,
      contract,
      loan,
      snapshot: before,
    }),
    { mode: 0o600 },
  );
  console.log(
    `${passed} application groups passed against real PostgreSQL/Auth/RLS.`,
  );
} finally {
  await db.end();
}
