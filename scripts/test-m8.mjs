import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import pg from 'pg';
import { demoDataset } from './demo-runtime.mjs';
const { createClient } = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
)('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8')),
  accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local verification only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
let passed = 0;
function ok(r) {
  assert(!r.error, `RPC failed: ${r.error?.code} ${r.error?.message}`);
  return r.data;
}
async function login(key) {
  const c = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ok(await c.auth.signInWithPassword(accounts[key]));
  return c;
}
async function check(name, fn) {
  await fn();
  console.log('PASS ' + name);
  passed++;
}
try {
  const [sales, reader, other, collector, platform] = await Promise.all(
    ['sales', 'reader', 'other', 'collector', 'platform'].map(login),
  );
  let t = (
    await db.query(
      "select id,demo_generation from public.tenants where slug='demonstracao' and active",
    )
  ).rows[0];
  assert(t);
  const today = (
    await db.query(
      "select (now() at time zone 'Africa/Maputo')::date::text reference_date",
    )
  ).rows[0].reference_date;
  const clients = ok(
    await sales
      .from('clients')
      .select('id,name,branch_id,risk_class')
      .eq('tenant_id', t.id)
      .order('name'),
  );
  const client = clients[0];
  await db.query(
    'update public.memberships set branch_id=(select id from public.branches where tenant_id=$1 and id<>$3 order by name limit 1) where tenant_id=$1 and user_id=$2',
    [t.id, accounts.collector.id, client.branch_id],
  );
  const report = (kind, extra = {}, actor = sales) =>
    actor.rpc('operational_report', {
      t: t.id,
      kind,
      from_day: '2020-01-01',
      to_day: '2029-12-31',
      ...extra,
    });
  await check(
    'Demo dataset has 120 clients, 60 loans, 8 pending applications and accepted console messages',
    async () => {
      assert.equal(clients.length, 120);
      assert.equal(
        ok(await sales.from('loans').select('id').eq('tenant_id', t.id)).length,
        60,
      );
      assert.equal(
        ok(
          await sales
            .from('applications')
            .select('id')
            .eq('tenant_id', t.id)
            .in('status', ['submitted', 'in_review']),
        ).length,
        8,
      );
      assert.equal(
        ok(
          await sales
            .from('message_jobs')
            .select('id,status,provider_id')
            .eq('tenant_id', t.id),
        ).filter(
          (x) =>
            x.status === 'accepted' && x.provider_id.startsWith('console:'),
        ).length,
        30,
      );
    },
  );
  await check(
    'Every demo journal balances and receivables equal the live portfolio',
    async () => {
      const rows = ok(
        await sales
          .from('journal_transactions')
          .select('postings')
          .eq('tenant_id', t.id),
      );
      let receivable = 0n;
      for (const row of rows) {
        let balance = 0n;
        for (const p of row.postings) {
          balance += BigInt(p.debit) - BigInt(p.credit);
          if (p.account.startsWith('receivable_'))
            receivable += BigInt(p.debit) - BigInt(p.credit);
        }
        assert.equal(balance, 0n);
      }
      const result = ok(await report('portfolio'));
      assert.equal(BigInt(result.total), receivable);
      assert(result.rows.length > 0);
    },
  );
  await check(
    'All six reports use exact strings, audited access and the same data for export',
    async () => {
      for (const kind of [
        'arrears',
        'movements',
        'forecast',
        'portfolio',
        'statement',
        'cash',
      ]) {
        const args = kind === 'statement' ? { cid: client.id } : {};
        const normal = ok(await report(kind, args));
        const exported = ok(
          await report(kind, { ...args, export_format: 'csv' }),
        );
        assert.deepEqual(normal.rows, exported.rows);
        assert.equal(normal.asOf, today);
        assert.equal(typeof normal.total, 'string');
      }
      const rows = ok(
        await sales
          .from('audit_events')
          .select('id')
          .eq('tenant_id', t.id)
          .eq('entity', 'operational_report')
          .eq('action', 'export'),
      );
      assert(rows.length >= 6);
    },
  );
  await check(
    'Tenant and agency scopes apply to reports and scoring; reader can report but cannot configure',
    async () => {
      assert((await report('portfolio', {}, other)).error);
      assert(
        (await other.rpc('client_score', { t: t.id, cid: client.id })).error,
      );
      assert(
        (await collector.rpc('client_score', { t: t.id, cid: client.id }))
          .error,
      );
      const foreign = (
        await db.query(
          'select id from public.clients where tenant_id<>$1 limit 1',
          [t.id],
        )
      ).rows[0];
      assert((await report('statement', { cid: foreign.id })).error);
      ok(await report('portfolio', {}, reader));
      const cfg = ok(
        await sales
          .from('tenant_configuration')
          .select('value')
          .eq('tenant_id', t.id)
          .eq('category', 'scoring')
          .single(),
      ).value;
      assert(
        (
          await reader.rpc('save_scoring_configuration', {
            t: t.id,
            settings: cfg,
            expected: cfg,
          })
        ).error,
      );
    },
  );
  await check(
    'Report filter labels are scoped, support literal search and do not require team management',
    async () => {
      const options = ok(
        await reader.rpc('report_filter_options', { t: t.id, q: '' }),
      );
      assert.equal(
        options.agents.length,
        (
          await db.query(
            'select count(*)::int n from public.memberships where tenant_id=$1 and active',
            [t.id],
          )
        ).rows[0].n,
      );
      assert.equal(options.branches.length, 3);
      assert.equal(options.clients.length, 120);
      assert(
        (await other.rpc('report_filter_options', { t: t.id, q: '' })).error,
      );
      assert.equal(
        ok(await reader.rpc('report_filter_options', { t: t.id, q: '%' }))
          .clients.length,
        0,
      );
      await db.query(
        'update public.memberships set branch_id=(select branch_id from public.memberships where tenant_id=$1 and user_id=$3) where tenant_id=$1 and user_id=$2',
        [t.id, accounts.reader.id, accounts.collector.id],
      );
      try {
        const restricted = ok(
          await reader.rpc('report_filter_options', { t: t.id, q: '' }),
        );
        assert.equal(restricted.branches.length, 1);
        assert(!restricted.clients.some((x) => x.id === client.id));
        const result = ok(await report('portfolio', {}, reader));
        assert(
          result.rows.every((x) => x.branch === restricted.branches[0].name),
        );
        assert((await report('statement', { cid: client.id }, reader)).error);
      } finally {
        await db.query(
          'update public.memberships set branch_id=null where tenant_id=$1 and user_id=$2',
          [t.id, accounts.reader.id],
        );
      }
    },
  );
  let cfg = ok(
    await sales
      .from('tenant_configuration')
      .select('value')
      .eq('tenant_id', t.id)
      .eq('category', 'scoring')
      .single(),
  ).value;
  const baseline = JSON.parse(
    readFileSync('supabase/seed/scoring.json', 'utf8'),
  );
  if (JSON.stringify(cfg) !== JSON.stringify(baseline)) {
    ok(
      await sales.rpc('save_scoring_configuration', {
        t: t.id,
        settings: baseline,
        expected: cfg,
      }),
    );
    cfg = baseline;
  }
  await check(
    'Scoring evidence is verified, audited, nullable and isolated',
    async () => {
      ok(
        await sales.rpc('save_scoring_evidence', {
          t: t.id,
          cid: client.id,
          input: {
            employmentMonths: 36,
            verifiedReferences: 2,
            note: 'Verificação sintética do teste M8.',
          },
        }),
      );
      const s = ok(
        await sales.rpc('client_score', { t: t.id, cid: client.id }),
      );
      assert.equal(s.metrics.employmentMonths, '36');
      assert.equal(s.metrics.verifiedReferences, '2');
      assert(
        (await other.from('scoring_evidence').select('*').eq('tenant_id', t.id))
          .data.length === 0,
      );
      assert.equal(
        ok(
          await other
            .from('client_risk_assessments')
            .select('id')
            .eq('tenant_id', t.id),
        ).length,
        0,
      );
      assert(
        (
          await other.rpc('save_scoring_evidence', {
            t: t.id,
            cid: client.id,
            input: {
              employmentMonths: 36,
              verifiedReferences: 2,
              note: 'Outra agência não pode alterar esta evidência.',
            },
          })
        ).error,
      );
      assert(
        (
          await sales.rpc('save_scoring_evidence', {
            t: t.id,
            cid: client.id,
            input: {
              employmentMonths: -1,
              verifiedReferences: null,
              note: 'Inválido',
            },
          })
        ).error,
      );
      assert(
        (
          await sales.rpc('save_scoring_evidence', {
            t: t.id,
            cid: client.id,
            input: {
              employmentMonths: 1.5,
              verifiedReferences: null,
              note: 'Inválido',
            },
          })
        ).error,
      );
    },
  );
  await check(
    'Editable weights/classes refresh campaign risk classes without changing any contract',
    async () => {
      const contracts = ok(
        await sales
          .from('contracts')
          .select('id,snapshot')
          .eq('tenant_id', t.id),
      );
      const changed = structuredClone(cfg);
      changed.criteria.forEach((x) => {
        x.weight = x.key === 'verifiedReferences' ? 1 : 0;
      });
      changed.classes.forEach((x) => {
        x.suggestedLimit = '9007199254740993';
      });
      ok(
        await sales.rpc('save_scoring_configuration', {
          t: t.id,
          settings: changed,
          expected: cfg,
        }),
      );
      assert.equal(
        ok(await sales.rpc('client_score', { t: t.id, cid: client.id })).class,
        'A',
      );
      assert.equal(
        ok(
          await sales
            .from('clients')
            .select('risk_class')
            .eq('id', client.id)
            .single(),
        ).risk_class,
        'A',
      );
      assert.deepEqual(
        ok(
          await sales
            .from('contracts')
            .select('id,snapshot')
            .eq('tenant_id', t.id),
        ),
        contracts,
      );
      assert(
        (
          await sales.rpc('save_scoring_configuration', {
            t: t.id,
            settings: cfg,
            expected: cfg,
          })
        ).error?.code === 'PT409',
      );
      ok(
        await sales.rpc('save_scoring_configuration', {
          t: t.id,
          settings: cfg,
          expected: changed,
        }),
      );
    },
  );
  await check(
    'Direct RPC rejects schema mismatches instead of saving configuration the editor cannot read',
    async () => {
      for (const mutate of [
        (v) => (v.criteria[0].missingScore = '50'),
        (v) => (v.criteria[0].bands[0].until = null),
        (v) => (v.extra = 'unsupported'),
        (v) => (v.classes[0].suggestedLimit = 5000000),
      ]) {
        const bad = structuredClone(cfg);
        mutate(bad);
        assert(
          (
            await sales.rpc('save_scoring_configuration', {
              t: t.id,
              settings: bad,
              expected: cfg,
            })
          ).error,
        );
      }
    },
  );
  await check(
    'Settlement and reversal refresh cached previous-loan evidence before campaign use',
    async () => {
      const ln = (
        await db.query(
          "select l.id,a.client_id from public.loans l join public.contracts c on c.id=l.contract_id join public.applications a on a.id=c.application_id where l.tenant_id=$1 and l.status='settled' limit 1",
          [t.id],
        )
      ).rows[0];
      const payment = (
        await db.query(
          'select id from public.payments where tenant_id=$1 and loan_id=$2 order by paid_on desc limit 1',
          [t.id, ln.id],
        )
      ).rows[0];
      assert.equal(
        (
          await db.query(
            'select metrics from public.client_risk_assessments where tenant_id=$1 and client_id=$2 order by sequence desc limit 1',
            [t.id, ln.client_id],
          )
        ).rows[0].metrics.previousLoans,
        '1',
      );
      ok(
        await sales.rpc('reverse_payment', {
          t: t.id,
          p_id: payment.id,
          reason:
            'Verificação sintética de actualização da classe após estorno.',
        }),
      );
      const latest = (
        await db.query(
          'select metrics,result from public.client_risk_assessments where tenant_id=$1 and client_id=$2 order by sequence desc limit 1',
          [t.id, ln.client_id],
        )
      ).rows[0];
      assert.equal(latest.metrics.previousLoans, '0');
      assert.equal(
        ok(
          await sales
            .from('clients')
            .select('risk_class')
            .eq('id', ln.client_id)
            .single(),
        ).risk_class,
        latest.result.class,
      );
    },
  );
  await check(
    'Proposed instalment affects assessment without overwriting the stored class',
    async () => {
      const before = ok(
        await sales.rpc('client_score', { t: t.id, cid: client.id }),
      );
      const proposed = ok(
        await sales.rpc('client_score', {
          t: t.id,
          cid: client.id,
          payment: '900000000',
        }),
      );
      assert.notEqual(
        proposed.metrics.paymentRatio,
        before.metrics.paymentRatio,
      );
      assert.equal(
        ok(
          await sales
            .from('clients')
            .select('risk_class')
            .eq('id', client.id)
            .single(),
        ).risk_class,
        before.class,
      );
    },
  );
  await check(
    'Risk history and scoring configuration cannot be overwritten or directly bypassed',
    async () => {
      const assessment = ok(
        await sales
          .from('client_risk_assessments')
          .select('id')
          .eq('tenant_id', t.id)
          .limit(1),
      )[0];
      const before = (
        await db.query(
          'select count(*)::int n from public.client_risk_assessments where tenant_id=$1',
          [t.id],
        )
      ).rows[0].n;
      const deleted = await sales
        .from('client_risk_assessments')
        .delete()
        .eq('id', assessment.id);
      assert(deleted.error || ok(deleted) === null);
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.client_risk_assessments where tenant_id=$1',
            [t.id],
          )
        ).rows[0].n,
        before,
      );
      assert(
        (
          await sales
            .from('tenant_configuration')
            .update({ value: cfg })
            .eq('tenant_id', t.id)
            .eq('category', 'scoring')
        ).error,
      );
    },
  );
  await check(
    'Provision basis and percentage are editable exact report data',
    async () => {
      const changed = structuredClone(cfg);
      changed.provisionBasis = 'balance';
      changed.provisions.forEach((x) => (x.percentage = '12.5'));
      ok(
        await sales.rpc('save_scoring_configuration', {
          t: t.id,
          settings: changed,
          expected: cfg,
        }),
      );
      const r = ok(await report('portfolio'));
      for (const row of r.rows)
        assert.equal(
          BigInt(row.provision),
          BigInt(
            (
              await db.query(
                'select sum(round(loan_balance*0.125))::text v from (select sum(i.principal+i.interest+i.fine+i.late_interest) loan_balance from public.loan_instalments i join public.loans l on l.id=i.loan_id join public.contracts co on co.id=l.contract_id join public.applications a on a.id=co.application_id join public.product_versions pv on pv.id=a.product_version_id join public.branches b on b.id=l.branch_id where i.tenant_id=$1 and pv.name=$2 and b.name=$3 group by l.id) grouped',
                [t.id, row.product, row.branch],
              )
            ).rows[0].v,
          ),
        );
      ok(
        await sales.rpc('save_scoring_configuration', {
          t: t.id,
          settings: cfg,
          expected: changed,
        }),
      );
    },
  );
  await check(
    'Demo flags, resets on ordinary tenants and external providers are protected',
    async () => {
      assert(
        (await sales.from('tenants').update({ is_demo: false }).eq('id', t.id))
          .error,
      );
      assert(
        (
          await sales
            .from('tenants')
            .update({ demo_generation: 99 })
            .eq('id', t.id)
        ).error,
      );
      assert(
        (
          await sales.from('tenant_configuration').insert({
            tenant_id: t.id,
            category: 'integration',
            key: 'sms',
            value: { provider: 'http', cost: '0' },
          })
        ).error,
      );
      const ordinary = (
        await db.query("select id from public.tenants where slug='beira'")
      ).rows[0].id;
      assert(
        (
          await other.rpc('reset_demo', {
            t: ordinary,
            expected_generation: 0,
            payload: '{}',
            signature: 'bad',
          })
        ).error,
      );
      assert((await sales.rpc('enable_demo', { t: t.id })).error);
      assert((await platform.rpc('enable_demo', { t: t.id })).error);
    },
  );
  await check(
    'Signed reset rejects tampering and stale generations, archives immutable history and preserves other tenants',
    async () => {
      const blueprint = ok(await sales.rpc('demo_blueprint', { t: t.id }));
      const products = blueprint.products.map((p) => ({
        ...p,
        terms: {
          ...p.terms,
          requirements: {
            ...p.terms.requirements,
            documents: [],
            guarantees: [],
          },
        },
      }));
      const key = (
        await db.query(
          'select secret from financial_private.signing_key where id',
        )
      ).rows[0].secret;
      const payload = JSON.stringify(
        {
          tenant: t.id,
          actor: accounts.sales.id,
          generation: blueprint.generation,
          expires: new Date(Date.now() + 300000).toISOString(),
          dataset: demoDataset(products, today),
        },
        (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      );
      const signature = createHmac('sha256', key)
        .update('demo:' + payload)
        .digest('hex');
      assert(
        (
          await sales.rpc('reset_demo', {
            t: t.id,
            expected_generation: t.demo_generation,
            payload: payload + ' ',
            signature,
          })
        ).error,
      );
      const before = (
        await db.query(
          'select count(*)::int n from public.contracts where tenant_id=$1',
          [t.id],
        )
      ).rows[0].n;
      const others = (
        await db.query(
          'select count(*)::int n from public.clients where tenant_id<>$1',
          [t.id],
        )
      ).rows[0].n;
      const old = t.id;
      const next = ok(
        await sales.rpc('reset_demo', {
          t: t.id,
          expected_generation: t.demo_generation,
          payload,
          signature,
        }),
      );
      assert.equal(
        (await db.query('select active from public.tenants where id=$1', [old]))
          .rows[0].active,
        false,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.contracts where tenant_id=$1',
            [old],
          )
        ).rows[0].n,
        before,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.clients where tenant_id<>$1 and tenant_id<>$2',
            [old, next],
          )
        ).rows[0].n,
        others,
      );
      assert(
        (
          await sales.rpc('reset_demo', {
            t: old,
            expected_generation: t.demo_generation,
            payload,
            signature,
          })
        ).error,
      );
      assert.equal(
        ok(await sales.from('clients').select('id').eq('tenant_id', next))
          .length,
        120,
      );
      assert(
        (await sales.from('clients').select('id').eq('tenant_id', old)).data
          .length === 0,
      );
      assert.equal(
        ok(
          await sales
            .from('application_events')
            .select('id')
            .eq('tenant_id', next),
        ).length,
        192,
      );
      t = { id: next, demo_generation: t.demo_generation + 1 };
    },
  );
  const current = ok(
    await sales
      .from('clients')
      .select('id,name,branch_id')
      .eq('tenant_id', t.id)
      .order('name'),
  );
  writeFileSync(
    '.local/m8.json',
    JSON.stringify({
      tenant: t.id,
      slug: 'demonstracao',
      generation: t.demo_generation,
      client: current[0].id,
    }),
    { mode: 0o600 },
  );
  console.log(`${passed} M8 integration groups passed.`);
} finally {
  await db.end();
}
