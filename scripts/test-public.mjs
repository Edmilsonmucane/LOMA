import { engine } from './engine-runtime.mjs';
import { attestPlan } from './financial-plan.mjs';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json'));
const accounts = JSON.parse(readFileSync('.local/accounts.json'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local verification only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
let passed = 0;
const api = () =>
  createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
function ok(r) {
  assert(!r.error, `Operation ${r.error?.code}: ${r.error?.message}`);
  return r.data;
}
async function login(k) {
  const c = api();
  ok(await c.auth.signInWithPassword(accounts[k]));
  return c;
}
async function check(name, run) {
  await run();
  passed++;
  console.log('PASS ' + name);
}
async function customer() {
  const c = api();
  const phone = `+25884${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
  ok(await c.auth.signInWithOtp({ phone }));
  const code = (
    await db.query(
      'select code from portal_private.auth_codes where phone=$1 order by created_at desc limit 1',
      [phone.slice(1)],
    )
  ).rows[0]?.code;
  assert(code, 'Private Auth hook code missing');
  const wrong = await c.auth.verifyOtp({ phone, token: '000000', type: 'sms' });
  assert(wrong.error);
  const verified = ok(
    await c.auth.verifyOtp({ phone, token: code, type: 'sms' }),
  );
  return { c, phone, user: verified.user.id };
}
try {
  const manager = await login('manager'),
    reader = await login('reader'),
    cashier = await login('cashier'),
    other = await login('other');
  const base = JSON.parse(readFileSync('.local/m4.json'));
  const t = base.tenant;
  const tenant = (
    await db.query('select * from public.tenants where id=$1', [t])
  ).rows[0];
  const branch = (
    await db.query(
      'select id from public.branches where tenant_id=$1 order by name limit 1',
      [t],
    )
  ).rows[0].id;
  const original = ok(
    await manager
      .from('tenant_configuration')
      .select('value')
      .eq('tenant_id', t)
      .eq('category', 'website')
      .eq('key', 'main')
      .single(),
  ).value;
  const key = (
    await db.query('select secret from portal_private.request_key where id')
  ).rows[0].secret;
  const proof = (phone, action) => {
    const context = JSON.stringify({
      tenant: t,
      phone,
      action,
      time: Math.floor(Date.now() / 1000),
      ip: 'a'.repeat(64),
    });
    return {
      context,
      signature: createHmac('sha256', key).update(context).digest('hex'),
    };
  };
  const terms = structuredClone(
    (
      await db.query('select snapshot from public.contracts where id=$1', [
        base.contract,
      ])
    ).rows[0].snapshot.terms,
  );
  terms.requirements = {
    documents: ['Bilhete de identidade'],
    guarantees: [],
    minAge: 18,
    minIncome: '100000',
  };
  terms.minPrincipal = '100000';
  terms.maxPrincipal = '5000000';
  terms.minPeriods = 1;
  terms.maxPeriods = 12;
  terms.approvalLevels = [{ upTo: '5000000', role: 'manager' }];
  const product = ok(
    await manager.rpc('save_product', {
      t,
      product_name: 'Crédito do Bairro M7',
      conditions: terms,
      expected_revision: 0,
      product_status: 'active',
    }),
  );
  const version = (
    await db.query(
      'select id from public.product_versions where tenant_id=$1 and product_id=$2 order by version desc limit 1',
      [t, product],
    )
  ).rows[0].id;
  let first, second, third;
  await check(
    'Native phone OTP rejects wrong code and confirms real session',
    async () => {
      first = await customer();
      second = await customer();
      third = await customer();
    },
  );
  await check(
    'Anonymous published site only, editor permission/conflict/validation',
    async () => {
      const publicData = ok(
        await api().rpc('public_site', { tenant_slug: tenant.slug }),
      );
      assert(publicData.products.some((p) => p.id === product));
      assert(!('security' in publicData));
      const current = {
        ...original,
        theme: original.theme === 'modern' ? 'classic' : 'modern',
      };
      ok(
        await manager.rpc('save_public_site', {
          t,
          settings: current,
          expected: original,
        }),
      );
      assert.equal(
        (
          await reader.rpc('save_public_site', {
            t,
            settings: original,
            expected: current,
          })
        ).error?.code,
        '42501',
      );
      assert.equal(
        (
          await manager.rpc('save_public_site', {
            t,
            settings: original,
            expected: original,
          })
        ).error?.code,
        'PT409',
      );
      assert.equal(
        (
          await manager.rpc('save_public_site', {
            t,
            settings: { ...current, sections: ['products'] },
            expected: current,
          })
        ).error?.code,
        '23514',
      );
      ok(
        await manager.rpc('save_public_site', {
          t,
          settings: original,
          expected: current,
        }),
      );
    },
  );
  const input = {
    name: 'Amélia Cossa',
    birth_date: '1990-05-14',
    branch_id: branch,
    product_version_id: version,
    principal: '1000000',
    periods: 6,
    purpose: 'Comprar mercadoria para a banca no bairro.',
    guarantees: [],
    profile: {
      identities: [{ kind: 'bi', value: 'M7' + randomUUID().slice(0, 8) }],
      contacts: [{ kind: 'phone', value: first.phone }],
      province: 'Maputo',
      district: 'KaMavota',
      neighbourhood: 'Mavalane',
      address: 'Mercado de Mavalane',
      activity: 'Comércio',
      employer: 'Conta própria',
      income: '1500000',
      expenses: '400000',
      references: [],
      guarantors: [],
    },
  };
  const draft = randomUUID();
  let client;
  await check(
    'Verified customer saves/resumes draft; anonymous, tenant and customer isolation',
    async () => {
      const saved = ok(
        await first.c.rpc('customer_save_draft', {
          t,
          d_id: draft,
          input,
          expected_revision: 0,
        }),
      );
      client = saved.client;
      assert.equal(saved.revision, 1);
      assert.equal(
        ok(await first.c.rpc('customer_dashboard', { t })).drafts.length,
        1,
      );
      assert.equal(
        ok(await second.c.rpc('customer_dashboard', { t })).drafts.length,
        0,
      );
      assert.equal(
        (
          await second.c.rpc('customer_save_draft', {
            t,
            d_id: draft,
            input: {
              ...input,
              profile: {
                ...input.profile,
                contacts: [{ kind: 'phone', value: second.phone }],
              },
            },
            expected_revision: 1,
          })
        ).error?.code,
        'PT409',
      );
      assert((await api().rpc('customer_dashboard', { t })).error);
      assert.equal(
        (await other.from('portal_drafts').select('*').eq('tenant_id', t)).data
          .length,
        0,
      );
      for (const table of [
        'clients',
        'applications',
        'contracts',
        'payments',
        'client_events',
        'tenant_configuration',
      ])
        assert.equal(
          ok(await first.c.from(table).select('*').eq('tenant_id', t)).length,
          0,
        );
    },
  );
  await check(
    'BI duplicate cannot link to someone else; revision conflict enforced',
    async () => {
      assert.equal(
        (
          await second.c.rpc('customer_save_draft', {
            t,
            d_id: randomUUID(),
            input,
            expected_revision: 0,
          })
        ).error?.code,
        '23505',
      );
      assert.equal(
        (
          await first.c.rpc('customer_save_draft', {
            t,
            d_id: draft,
            input,
            expected_revision: 0,
          })
        ).error?.code,
        'PT409',
      );
      assert.equal(
        (
          await first.c.rpc('customer_save_draft', {
            t,
            d_id: randomUUID(),
            input: {
              ...input,
              branch_id: '30000000-0000-4000-8000-000000000001',
            },
            expected_revision: 0,
          })
        ).error?.code,
        '23514',
      );
    },
  );
  await check(
    'Signed request gate rejects altered proof and limits phone requests',
    async () => {
      const p = proof(first.phone, 'otp');
      assert.equal(
        (
          await api().rpc('public_request_gate', {
            t,
            ...p,
            signature: '0'.repeat(64),
          })
        ).error?.code,
        '42501',
      );
      for (let i = 0; i < original.limits.otpPerHour; i++)
        ok(await api().rpc('public_request_gate', { t, ...p }));
      assert.equal(
        (await api().rpc('public_request_gate', { t, ...p })).error?.code,
        'PT429',
      );
    },
  );
  let doc;
  await check(
    'Private document reservation, upload and tenant/customer storage isolation',
    async () => {
      doc = ok(
        await first.c.rpc('customer_reserve_document', {
          t,
          d_id: draft,
          metadata: {
            title: 'Bilhete de identidade',
            filename: 'bi.pdf',
            mime_type: 'application/pdf',
            size: 14,
            expires_on: '',
          },
        }),
      );
      assert.equal(
        (
          await second.c.rpc('customer_reserve_document', {
            t,
            d_id: draft,
            metadata: {
              title: 'BI',
              filename: 'b.pdf',
              mime_type: 'application/pdf',
              size: 14,
            },
          })
        ).error?.code,
        '42501',
      );
      const bytes = Buffer.from('%PDF-1.4\n%%EOF');
      assert.equal(bytes.length, 14);
      assert(
        (
          await second.c.storage
            .from('client-documents')
            .upload(doc.path, bytes, { contentType: 'application/pdf' })
        ).error,
      );
      ok(
        await first.c.storage
          .from('client-documents')
          .upload(doc.path, bytes, { contentType: 'application/pdf' }),
      );
      ok(await first.c.rpc('customer_complete_document', { t, did: doc.id }));
      assert(
        (await second.c.storage.from('client-documents').download(doc.path))
          .error,
      );
      assert(
        (
          await first.c.storage
            .from('client-documents')
            .upload(doc.path, bytes, {
              contentType: 'application/pdf',
              upsert: true,
            })
        ).error,
      );
      ok(
        await first.c.storage
          .from('client-documents')
          .createSignedUrl(doc.path, 60),
      );
    },
  );
  let application, contract, loan;
  await check(
    'Submit is idempotent, real staff request, captured terms and no auto-approval',
    async () => {
      const signed = proof(first.phone, 'submit');
      application = ok(
        await first.c.rpc('customer_submit', {
          t,
          d_id: draft,
          expected_revision: 1,
          ...signed,
        }),
      );
      assert.equal(
        ok(
          await first.c.rpc('customer_submit', {
            t,
            d_id: draft,
            expected_revision: 1,
            ...signed,
          }),
        ),
        application,
      );
      const real = ok(
        await manager
          .from('applications')
          .select('*')
          .eq('id', application)
          .single(),
      );
      assert.equal(real.status, 'submitted');
      assert.equal(real.created_by, first.user);
      assert.equal(
        ok(
          await manager
            .from('clients')
            .select('profile')
            .eq('id', client)
            .single(),
        ).profile.income,
        '1500000',
      );
      const stored = ok(
        await manager
          .from('portal_drafts')
          .select('data')
          .eq('id', draft)
          .single(),
      );
      assert(stored.data.acceptance.terms);
      assert.equal(
        (
          await first.c.rpc('transition_application', {
            t,
            a_id: application,
            expected_revision: 1,
            next_status: 'approved',
            note: 'Aprovar',
          })
        ).error?.code,
        '42501',
      );
      ok(
        await manager.rpc('transition_application', {
          t,
          a_id: application,
          expected_revision: 1,
          next_status: 'in_review',
          note: 'Documentos recebidos.',
        }),
      );
      contract = ok(
        await manager.rpc('transition_application', {
          t,
          a_id: application,
          expected_revision: 2,
          next_status: 'approved',
          note: 'Capacidade de pagamento confirmada.',
        }),
      );
    },
  );
  await check(
    'Actual approved loan/payment visible only to its customer, no internal notes',
    async () => {
      const snap = ok(
        await manager.from('contracts').select('*').eq('id', contract).single(),
      );
      const plan = engine.simulate({
        principal: BigInt(snap.snapshot.principal),
        periods: snap.snapshot.periods,
        startDate: snap.snapshot.startDate,
        terms: snap.snapshot.terms,
      });
      const financialKey = (
        await db.query(
          'select secret from financial_private.signing_key where id',
        )
      ).rows[0].secret;
      const user = ok(await cashier.auth.getUser()).user.id;
      loan = ok(
        await cashier.rpc('disburse_application', {
          t,
          a_id: application,
          expected_revision: 3,
          payment_method: 'transfer',
          payment_reference: 'M7 desembolso de verificação',
          disbursement_date: snap.snapshot.startDate,
          signature_date: snap.snapshot.startDate,
          ...attestPlan({
            tenant: t,
            contract,
            actor: user,
            plan,
            key: financialKey,
          }),
        }),
      );
      const account = (
        await db.query(
          'select revision from public.loan_accounts where tenant_id=$1 and loan_id=$2',
          [t, loan],
        )
      ).rows[0];
      ok(
        await cashier.rpc('record_payment', {
          t,
          l: loan,
          amount: '50000',
          payment_method: 'transfer',
          payment_reference: 'M7 pagamento de verificação',
          expected_revision: account.revision,
          expected_day: snap.snapshot.startDate,
          request_id: randomUUID(),
        }),
      );
      const own = ok(await first.c.rpc('customer_dashboard', { t }));
      assert.equal(own.loans.length, 1);
      assert.equal(own.loans[0].payments[0].amount, '50000');
      assert.equal(own.applications[0].status, 'disbursed');
      assert(
        !JSON.stringify(own).includes('Capacidade de pagamento confirmada'),
      );
      assert.equal(
        ok(await second.c.rpc('customer_dashboard', { t })).loans.length,
        0,
      );
    },
  );
  await check(
    'Existing client updates stay proposed; staff-owned profile and opt-out preserved',
    async () => {
      const old = ok(
        await manager.from('clients').select('*').eq('id', client).single(),
      );
      const id = randomUUID();
      ok(
        await first.c.rpc('customer_save_draft', {
          t,
          d_id: id,
          input: {
            ...input,
            name: 'Amélia Cossa nova morada',
            profile: { ...input.profile, income: '2500000' },
          },
          expected_revision: 0,
        }),
      );
      assert.deepEqual(
        ok(
          await manager
            .from('clients')
            .select('profile')
            .eq('id', client)
            .single(),
        ).profile,
        old.profile,
      );
    },
  );
  await check(
    'Lead requires explicit consent and signed context, stays isolated',
    async () => {
      const p = proof(third.phone, 'lead');
      assert.equal(
        (
          await api().rpc('capture_public_lead', {
            t,
            input: {
              name: 'Celeste Matavele',
              branch_id: branch,
              consent: false,
            },
            ...p,
          })
        ).error?.code,
        '23514',
      );
      ok(
        await api().rpc('capture_public_lead', {
          t,
          input: { name: 'Celeste Matavele', branch_id: branch, consent: true },
          ...p,
        }),
      );
      assert.equal(
        (await third.c.from('leads').select('*').eq('tenant_id', t)).data
          .length,
        0,
      );
      assert(
        ok(
          await manager
            .from('leads')
            .select('id')
            .eq('tenant_id', t)
            .eq('phone', third.phone),
        ).length,
      );
    },
  );
  await check(
    'Primary phone after email links correctly; secondary phone and expired session are denied',
    async () => {
      const created = ok(
        await manager.rpc('save_client', {
          t,
          client_data: {
            name: 'Celeste Matavele',
            branch_id: branch,
            birth_date: '1991-04-18',
            classification: 'regular',
            profile: {
              ...input.profile,
              identities: [],
              contacts: [
                { kind: 'email', value: 'celeste@example.test' },
                { kind: 'phone', value: third.phone },
                { kind: 'phone', value: second.phone },
              ],
            },
            consent: { sms: false, whatsapp: false, email: false, source: '' },
          },
        }),
      );
      assert.equal(ok(await third.c.rpc('customer_enter', { t })), created);
      assert.equal(ok(await second.c.rpc('customer_enter', { t })), null);
      const session = ok(await first.c.auth.getSession()).session;
      const claims = JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64url').toString(),
      );
      const row = (
        await db.query('select created_at from auth.sessions where id=$1', [
          claims.session_id,
        ])
      ).rows[0];
      try {
        await db.query(
          "update auth.sessions set created_at=now()-interval '101 hours' where id=$1",
          [claims.session_id],
        );
        assert.equal(
          (await first.c.rpc('customer_dashboard', { t })).error?.code,
          '42501',
        );
      } finally {
        await db.query('update auth.sessions set created_at=$1 where id=$2', [
          row.created_at,
          claims.session_id,
        ]);
      }
    },
  );
  writeFileSync(
    '.local/m7.json',
    JSON.stringify({
      tenant: t,
      slug: tenant.slug,
      branch,
      product,
      version,
      terms,
      application,
      loan,
      client,
      phone: first.phone,
    }),
    { mode: 0o600 },
  );
  console.log(
    `${passed} public site, native Auth, portal, private Storage and financial flow groups passed.`,
  );
} finally {
  await db.end();
}
