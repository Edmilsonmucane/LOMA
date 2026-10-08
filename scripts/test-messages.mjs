import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { runMessages } from './message-worker.mjs';
import { engine } from './engine-runtime.mjs';
import { publicAddress } from './message-worker.mjs';
import {
  ConsoleProvider,
  MockProvider,
} from '../packages/messaging/src/index.ts';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
const fixture = JSON.parse(readFileSync('.local/m4.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local verification only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
const compose = [
  'compose',
  '--env-file',
  '.local/runtime.env',
  '-f',
  'supabase/compose.local.yml',
];
const running = execFileSync(
  'docker',
  [...compose, 'ps', '--status', 'running', '--services'],
  { encoding: 'utf8' },
)
  .split('\n')
  .includes('messages');
if (running)
  execFileSync('docker', [...compose, 'stop', 'messages'], { stdio: 'ignore' });
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
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  const [manager, other, reader, collector] = await Promise.all(
    ['manager', 'other', 'reader', 'collector'].map(login),
  );
  const t = fixture.tenant;
  const base = (
    await db.query(
      'select a.client_id,a.branch_id from public.applications a where id=$1',
      [fixture.application],
    )
  ).rows[0];
  const c = base.client_id,
    b = base.branch_id;
  const configuration = (
    await db.query(
      "select value from public.tenant_configuration where tenant_id=$1 and category='communication' and key='rules'",
      [t],
    )
  ).rows[0].value;
  const rules = {
    ...configuration,
    startHour: 0,
    endHour: 24,
    maxPerDay: 100,
    retrySeconds: 1,
  };
  ok(
    await manager.rpc('save_communication_configuration', {
      t,
      category_name: 'communication',
      key_name: 'rules',
      settings: rules,
    }),
  );
  const consent = {
    t,
    c,
    ch: 'sms',
    enabled: true,
    source: 'Consentimento específico para verificação local',
  };
  ok(await manager.rpc('set_communication_consent', consent));
  await check(
    'Authorised encrypted integrations; no plaintext or API private access',
    async () => {
      ok(
        await manager.rpc('save_integration', {
          t,
          ch: 'sms',
          settings: {
            provider: 'console',
            cost: '0',
            token: 'verification-only-not-a-real-secret',
          },
        }),
      );
      const row = (
        await db.query(
          'select cipher::text cipher from communication_private.integrations where tenant_id=$1',
          [t],
        )
      ).rows[0];
      assert(!row.cipher.includes('verification'));
      assert(
        (
          await other.rpc('save_integration', {
            t,
            ch: 'sms',
            settings: { provider: 'console', cost: '0' },
          })
        ).error,
      );
      assert(
        (
          await reader.rpc('queue_message', {
            t,
            c,
            ch: 'sms',
            template: 'reminder',
            request_id: randomUUID(),
          })
        ).error,
      );
      assert(
        (
          await manager
            .from('tenant_configuration')
            .update({ value: { startHour: 0 } })
            .eq('tenant_id', t)
            .eq('category', 'communication')
        ).error,
      );
    },
  );
  let j;
  await check(
    'Queue idempotency; console acceptance and immutable delivery history',
    async () => {
      const request_id = randomUUID();
      j = ok(
        await manager.rpc('queue_message', {
          t,
          c,
          ch: 'sms',
          template: 'reminder',
          request_id,
          loan: fixture.loan,
        }),
      );
      assert(j);
      ok(
        await manager.rpc('queue_message', {
          t,
          c,
          ch: 'sms',
          template: 'reminder',
          request_id,
          loan: fixture.loan,
        }),
      );
      const mock = new MockProvider();
      await runMessages({ database: db, providerFactory: () => mock });
      assert(mock.messages.some((x) => x.id === j));
      const row = ok(
        await manager
          .from('message_jobs')
          .select('status,cost')
          .eq('id', j)
          .single(),
      );
      assert.equal(row.status, 'accepted');
      await runMessages({ database: db, providerFactory: () => mock });
      assert.equal(mock.messages.filter((x) => x.id === j).length, 1);
      assert(
        (await manager.from('message_events').delete().eq('message_id', j))
          .error,
      );
    },
  );
  await check(
    'Consent checked at enqueue and again at dispatch; block survives client update',
    async () => {
      const queued = ok(
        await manager.rpc('queue_message', {
          t,
          c,
          ch: 'sms',
          template: 'campaign',
          request_id: randomUUID(),
        }),
      );
      ok(
        await manager.rpc('set_communication_consent', {
          ...consent,
          enabled: false,
          source: 'Pedido SAIR registado pela agência',
        }),
      );
      assert.equal(
        ok(
          await manager.rpc('queue_message', {
            t,
            c,
            ch: 'sms',
            template: 'campaign',
            request_id: randomUUID(),
          }),
        ),
        null,
      );
      const mock = new MockProvider();
      await runMessages({ database: db, providerFactory: () => mock });
      assert(!mock.messages.some((x) => x.id === queued));
      assert.equal(
        ok(
          await manager
            .from('message_jobs')
            .select('status')
            .eq('id', queued)
            .single(),
        ).status,
        'suppressed',
      );
      ok(await manager.rpc('set_communication_consent', consent));
    },
  );
  await check(
    'Campaign preview count, scope, consent and cancellation',
    async () => {
      const preview = ok(
        await manager.rpc('preview_campaign', {
          t,
          b,
          ch: 'sms',
          template: 'campaign',
          segment: {
            province: '',
            risk: '',
            noActive: false,
            birthday: false,
            product: '',
            settledMonths: '',
          },
        }),
      );
      assert(preview.count >= 1);
      assert(
        (
          await other.rpc('preview_campaign', {
            t,
            b,
            ch: 'sms',
            template: 'campaign',
            segment: {},
          })
        ).error,
      );
      const id = ok(
        await manager.rpc('create_campaign', {
          t,
          b,
          name: 'Campanha de verificação',
          ch: 'sms',
          template: 'campaign',
          segment: {},
          scheduled: new Date().toISOString(),
          request_id: randomUUID(),
        }),
      );
      ok(await manager.rpc('cancel_campaign', { t, c: id }));
      await runMessages({
        database: db,
        providerFactory: () => new MockProvider(),
      });
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.message_jobs where campaign_id=$1',
            [id],
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await check(
    'Collection promises, targets, tenant rejection and read-only denial',
    async () => {
      const id = ok(
        await manager.rpc('record_collection', {
          t,
          l: fixture.loan,
          kind: 'promise',
          note: 'Cliente confirmou pagamento na agência.',
          due: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Maputo',
          }).format(new Date()),
          amount: '100000',
          request_id: randomUUID(),
        }),
      );
      assert(id);
      assert(
        (
          await other.rpc('record_collection', {
            t,
            l: fixture.loan,
            kind: 'contact',
            note: 'Tentativa indevida',
          })
        ).error,
      );
      assert((await reader.rpc('collections_summary', { t })).error);
      assert(
        (
          await collector.rpc('assign_collection', {
            t,
            l: fixture.loan,
            u: accounts.collector.id,
            target: '100000',
          })
        ).error,
      );
    },
  );
  await check(
    'Lead consent, uniqueness, actual conversion and revision',
    async () => {
      const data = {
        branch: b,
        name: 'Lurdes Machel',
        phone: `+25884${String(Date.now()).slice(-7)}`,
        origin: 'Contacto na agência',
        status: 'new',
        client: '',
        consent: { sms: false, whatsapp: false, email: false, source: '' },
      };
      const id = ok(await manager.rpc('save_lead', { t, data }));
      assert(id);
      assert((await manager.rpc('save_lead', { t, data })).error);
      assert(
        (
          await manager.rpc('save_lead', {
            t,
            data: { ...data, status: 'approved' },
            selected: id,
            expected_revision: 1,
          })
        ).error,
      );
      assert(
        (
          await manager.rpc('save_lead', {
            t,
            data,
            selected: id,
            expected_revision: 0,
          })
        ).error,
      );
    },
  );

  const day = (
    await db.query(
      "select (now() at time zone 'Africa/Maputo')::date::text as day",
    )
  ).rows[0].day;
  const offset = (date, n) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const client = (
    await db.query('select profile from public.clients where id=$1', [c])
  ).rows[0];
  const fresh = ok(
    await manager.rpc('save_client', {
      t,
      client_data: {
        name: 'Dulce Chissano',
        branch_id: b,
        birth_date: null,
        classification: 'regular',
        profile: {
          ...client.profile,
          identities: [],
          contacts: [
            { kind: 'phone', value: `+25885${String(Date.now()).slice(-7)}` },
          ],
        },
        consent: {
          sms: true,
          whatsapp: false,
          email: false,
          source: 'Autorização de verificação',
        },
      },
    }),
  );
  async function manual(client = fresh) {
    return ok(
      await manager.rpc('queue_message', {
        t,
        c: client,
        ch: 'sms',
        template: 'campaign',
        request_id: randomUUID(),
      }),
    );
  }
  await check(
    'Permitted window defers without sending; daily frequency is shared across channels',
    async () => {
      const hour = (
        await db.query(
          "select extract(hour from now() at time zone 'Africa/Maputo')::int as hour",
        )
      ).rows[0].hour;
      const startHour = hour === 0 ? 1 : 0,
        endHour = hour === 0 ? 2 : 1;
      ok(
        await manager.rpc('save_communication_configuration', {
          t,
          category_name: 'communication',
          key_name: 'rules',
          settings: { ...rules, startHour, endHour },
        }),
      );
      const id = await manual();
      const mock = new MockProvider();
      await runMessages({ database: db, providerFactory: () => mock });
      assert(!mock.messages.some((x) => x.id === id));
      assert.equal(
        (
          await db.query('select reason from public.message_jobs where id=$1', [
            id,
          ])
        ).rows[0].reason,
        'window',
      );
      ok(
        await manager.rpc('save_communication_configuration', {
          t,
          category_name: 'communication',
          key_name: 'rules',
          settings: { ...rules, maxPerDay: 1 },
        }),
      );
      const first = await manual(),
        second = await manual();
      await runMessages({ database: db, providerFactory: () => mock });
      assert.equal(
        mock.messages.filter((x) => [first, second].includes(x.id)).length,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.message_jobs where id=any($1::uuid[]) and reason='frequency'",
            [[first, second]],
          )
        ).rows[0].n,
        1,
      );
      ok(
        await manager.rpc('save_communication_configuration', {
          t,
          category_name: 'communication',
          key_name: 'rules',
          settings: rules,
        }),
      );
    },
  );
  await check(
    'Explicit rejection retries with backoff and exact cost; ambiguous delivery never resends',
    async () => {
      const id = await manual();
      await runMessages({
        database: db,
        providerFactory: () =>
          new MockProvider({ state: 'retry', cost: '0', reason: 'rate_limit' }),
      });
      const job = (
        await db.query(
          'select status,attempts,available_at>now() delayed from public.message_jobs where id=$1',
          [id],
        )
      ).rows[0];
      assert.equal(job.status, 'queued');
      assert.equal(job.attempts, 1);
      assert(job.delayed);
      await db.query(
        'update public.message_jobs set available_at=now() where id=$1',
        [id],
      );
      await runMessages({
        database: db,
        providerFactory: () =>
          new MockProvider({
            state: 'accepted',
            cost: '9007199254740993',
            providerId: 'test-cost',
          }),
      });
      assert.equal(
        (
          await db.query(
            'select cost::text cost from public.message_jobs where id=$1',
            [id],
          )
        ).rows[0].cost,
        '9007199254740993',
      );
      const uncertain = await manual();
      const mock = new MockProvider({
        state: 'uncertain',
        cost: '0',
        reason: 'connection',
      });
      await runMessages({ database: db, providerFactory: () => mock });
      await runMessages({ database: db, providerFactory: () => mock });
      assert.equal(mock.messages.filter((x) => x.id === uncertain).length, 1);
    },
  );
  await check(
    'Signed delivery callback and opt-out; invalid signatures cannot mutate tenant',
    async () => {
      const secret = 'local-verification-callback-secret';
      ok(
        await manager.rpc('save_integration', {
          t,
          ch: 'sms',
          settings: { provider: 'console', cost: '0', webhookSecret: secret },
        }),
      );
      const id = await manual();
      await runMessages({
        database: db,
        providerFactory: () =>
          new MockProvider({
            state: 'accepted',
            cost: '0',
            providerId: `delivery-${id}`,
          }),
      });
      const payload = JSON.stringify({
        id: `delivery-${id}`,
        status: 'delivered',
      });
      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      assert.equal(
        ok(
          await other.rpc('provider_callback', {
            t,
            ch: 'sms',
            payload,
            signature: '0'.repeat(64),
          }),
        ),
        false,
      );
      assert.equal(
        ok(
          await other.rpc('provider_callback', {
            t,
            ch: 'sms',
            payload,
            signature,
          }),
        ),
        true,
      );
      assert.equal(
        (
          await db.query('select status from public.message_jobs where id=$1', [
            id,
          ])
        ).rows[0].status,
        'delivered',
      );
      const before = (
        await db.query(
          'select count(*)::int n from public.message_events where message_id=$1',
          [id],
        )
      ).rows[0].n;
      ok(
        await other.rpc('provider_callback', {
          t,
          ch: 'sms',
          payload,
          signature,
        }),
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.message_events where message_id=$1',
            [id],
          )
        ).rows[0].n,
        before,
      );
      const phone = (
        await db.query(
          "select value from public.client_keys where client_id=$1 and kind='phone'",
          [fresh],
        )
      ).rows[0].value;
      const out = JSON.stringify({ from: phone, message: 'SAIR' });
      ok(
        await other.rpc('provider_callback', {
          t,
          ch: 'sms',
          payload: out,
          signature: createHmac('sha256', secret).update(out).digest('hex'),
        }),
      );
      assert.equal(await manual(), null);
      ok(
        await manager.rpc('set_communication_consent', {
          t,
          c: fresh,
          ch: 'sms',
          enabled: true,
          source: 'Nova autorização explícita de verificação',
        }),
      );
    },
  );
  let overdue;
  await check(
    'Editable reminders at -3, 0, 1, 7 and 15 days; console works and repeats are idempotent',
    async () => {
      const base = (
        await db.query('select * from public.contracts where id=$1', [
          fixture.contract,
        ])
      ).rows[0];
      const app = (
        await db.query('select * from public.applications where id=$1', [
          fixture.application,
        ])
      ).rows[0];
      const expected = [];
      for (const distance of [3, 0, -1, -7, -15, -2]) {
        const a = randomUUID(),
          ct = randomUUID(),
          l = randomUUID(),
          startDate = offset(day, distance - 1);
        const terms = {
          ...base.snapshot.terms,
          periodicity: 'daily',
          method: 'flat',
          rate: '0',
          minPeriods: 1,
          maxPeriods: 20,
          calendar: { holidays: [], weekendDays: [], adjustment: 'none' },
          grace: { periods: 0, treatment: 'free' },
          fees: [],
          taxes: [],
          penalty: {
            toleranceDays: 0,
            dailyRate: '0',
            fine: { kind: 'fixed', value: '0' },
          },
        };
        const snapshot = {
          ...base.snapshot,
          principal: '1000000',
          periods: 1,
          startDate,
          terms,
        };
        await db.query(
          'insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by) values($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10)',
          [
            a,
            t,
            fresh,
            b,
            app.product_version_id,
            '1000000',
            startDate,
            'Verificação de lembretes',
            'disbursed',
            accounts.manager.id,
          ],
        );
        await db.query(
          'insert into public.contracts(id,tenant_id,application_id,branch_id,snapshot,approved_by) values($1,$2,$3,$4,$5,$6)',
          [ct, t, a, b, snapshot, accounts.analyst.id],
        );
        await db.query(
          "insert into public.loans(id,tenant_id,contract_id,branch_id,disbursed_on,method,reference,signed_on,recorded_by) values($1,$2,$3,$4,$5,'transfer','M6-FIXTURE',$5,$6)",
          [l, t, ct, b, startDate, accounts.cashier.id],
        );
        const plan = engine.simulate({
          principal: 1000000n,
          periods: 1,
          startDate,
          terms,
        });
        await db.query('select financial_private.initialise($1,$2,$3::jsonb)', [
          t,
          l,
          JSON.stringify(plan, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v,
          ),
        ]);
        if (distance !== -2) expected.push(l);
        if (distance === -15) overdue = l;
      }
      for (const key of ['before', 'today', 'late1', 'late7', 'late15']) {
        const value = (
          await db.query(
            "select value from public.tenant_configuration where tenant_id=$1 and category='automation' and key=$2",
            [t, key],
          )
        ).rows[0].value;
        ok(
          await manager.rpc('save_communication_configuration', {
            t,
            category_name: 'automation',
            key_name: key,
            settings: { ...value, enabled: true },
          }),
        );
      }
      const writes = [];
      await runMessages({
        database: db,
        providerFactory: () =>
          new ConsoleProvider((x) => writes.push(JSON.parse(x))),
      });
      const rows = (
        await db.query(
          "select source_key,body from public.message_jobs where tenant_id=$1 and client_id=$2 and source_key like 'due:%'",
          [t, fresh],
        )
      ).rows;
      assert.equal(rows.length, 5);
      assert(expected.every((l) => rows.some((r) => r.source_key.includes(l))));
      assert(
        rows.every(
          (r) => r.body.includes('10 000,00 MT') && r.body.includes('SAIR'),
        ),
      );
      assert(writes.length >= 5);
      await runMessages({
        database: db,
        providerFactory: () => new MockProvider(),
      });
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.message_jobs where tenant_id=$1 and client_id=$2 and source_key like 'due:%'",
            [t, fresh],
          )
        ).rows[0].n,
        5,
      );
      for (const key of ['before', 'today', 'late1', 'late7', 'late15'])
        await db.query(
          "update public.tenant_configuration set value=jsonb_set(value,'{enabled}','false') where tenant_id=$1 and category='automation' and key=$2",
          [t, key],
        );
    },
  );
  await check(
    'Campaign expansion includes consented clients only and scheduled campaigns wait',
    async () => {
      const data = {
        t,
        b,
        name: 'Contactos com autorização',
        ch: 'sms',
        template: 'campaign',
        segment: {},
        scheduled: new Date().toISOString(),
        request_id: randomUUID(),
      };
      const id = ok(await manager.rpc('create_campaign', data));
      const mock = new MockProvider();
      await runMessages({ database: db, providerFactory: () => mock });
      const rows = (
        await db.query(
          'select client_id from public.message_jobs where campaign_id=$1',
          [id],
        )
      ).rows;
      assert(rows.length >= 2);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.message_jobs j join public.clients c on c.id=j.client_id where j.campaign_id=$1 and not (c.consent->>'sms')::boolean",
            [id],
          )
        ).rows[0].n,
        0,
      );
      const future = ok(
        await manager.rpc('create_campaign', {
          ...data,
          scheduled: new Date(Date.now() + 86400000).toISOString(),
          request_id: randomUUID(),
        }),
      );
      await runMessages({ database: db, providerFactory: () => mock });
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.message_jobs where campaign_id=$1',
            [future],
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await check(
    'Reject private/provider endpoints, null rules, missing references and cross-tenant reads',
    async () => {
      for (const ip of [
        '127.0.0.1',
        '10.0.0.1',
        '169.254.169.254',
        '172.16.0.1',
        '192.168.1.1',
        '100.64.0.1',
        '::1',
        'fc00::1',
        '::ffff:127.0.0.1',
      ])
        assert.equal(publicAddress(ip), false);
      assert(publicAddress('8.8.8.8'));
      assert(
        (
          await manager.rpc('save_communication_configuration', {
            t,
            category_name: 'communication',
            key_name: 'rules',
            settings: { ...rules, startHour: null },
          })
        ).error,
      );
      for (const table of [
        'campaigns',
        'message_jobs',
        'message_events',
        'collection_actions',
        'collection_assignments',
        'leads',
      ])
        assert.equal(
          ok(await other.from(table).select('*').eq('tenant_id', t)).length,
          0,
        );
      const summary = ok(await manager.rpc('collections_summary', { t }));
      assert(
        summary.some(
          (x) =>
            x.id === overdue && x.days === 15 && typeof x.amount === 'string',
        ),
      );
    },
  );
  await check(
    'Receipt and decision automations, exact collection targets and reversal',
    async () => {
      const enabled = [
        'received',
        'approved',
        'declined',
        'disbursed',
        'receipt',
      ];
      for (const key of enabled) {
        const value = (
          await db.query(
            "select value from public.tenant_configuration where tenant_id=$1 and category='automation' and key=$2",
            [t, key],
          )
        ).rows[0].value;
        ok(
          await manager.rpc('save_communication_configuration', {
            t,
            category_name: 'automation',
            key_name: key,
            settings: { ...value, enabled: true },
          }),
        );
      }
      const base = (
        await db.query('select * from public.applications where id=$1', [
          fixture.application,
        ])
      ).rows[0];
      const events = [];
      for (const status of ['submitted', 'approved', 'declined', 'disbursed']) {
        const id = randomUUID();
        await db.query(
          'insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by) values($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10)',
          [
            id,
            t,
            fresh,
            b,
            base.product_version_id,
            '1000000',
            day,
            'Evento importado de verificação',
            status,
            accounts.manager.id,
          ],
        );
        const event = (
          await db.query(
            'insert into public.application_events(tenant_id,application_id,branch_id,actor_id,actor_name,status,detail) values($1,$2,$3,$4,$5,$6,$7) returning id',
            [
              t,
              id,
              b,
              accounts.manager.id,
              'Gestor de verificação',
              status,
              'Evento de verificação do agendador',
            ],
          )
        ).rows[0].id;
        events.push(event);
      }
      const oldTarget = ok(await manager.rpc('collection_targets', { t })).find(
        (x) => x.user_id === accounts.manager.id,
      ) ?? { target: '0', received: '0' };
      ok(
        await manager.rpc('assign_collection', {
          t,
          l: overdue,
          u: accounts.manager.id,
          target: '50000',
        }),
      );
      const preview = ok(
        await manager.rpc('preview_payment', {
          t,
          l: overdue,
          amount: '50000',
        }),
      );
      const payment = ok(
        await manager.rpc('record_payment', {
          t,
          l: overdue,
          amount: '50000',
          payment_method: 'transfer',
          payment_reference: 'M6-VERIFY',
          expected_revision: preview.revision,
          expected_day: preview.day,
          request_id: randomUUID(),
        }),
      );
      const mock = new MockProvider();
      await runMessages({ database: db, providerFactory: () => mock });
      for (const event of events)
        assert(
          (
            await db.query(
              'select count(*)::int n from public.message_jobs where tenant_id=$1 and source_key like $2',
              [t, `application:%:${event}`],
            )
          ).rows[0].n === 1,
        );
      const receipt = (
        await db.query(
          'select body,status from public.message_jobs where tenant_id=$1 and source_key=$2',
          [t, `payment:receipt:${payment}`],
        )
      ).rows[0];
      assert.equal(receipt.status, 'accepted');
      assert(receipt.body.includes('500,00 MT'));
      let target = ok(await manager.rpc('collection_targets', { t })).find(
        (x) => x.user_id === accounts.manager.id,
      );
      assert.equal(
        target.received,
        (BigInt(oldTarget.received) + 50000n).toString(),
      );
      assert.equal(
        target.target,
        (BigInt(oldTarget.target) + 50000n).toString(),
      );
      ok(
        await manager.rpc('reverse_payment', {
          t,
          p_id: payment,
          reason: 'Reposição após verificação de automação',
        }),
      );
      target = ok(await manager.rpc('collection_targets', { t })).find(
        (x) => x.user_id === accounts.manager.id,
      );
      assert.equal(target.received, oldTarget.received);
      const count = (
        await db.query(
          "select count(*)::int n from public.message_jobs where tenant_id=$1 and client_id=$2 and (source_key like 'application:%' or source_key=$3)",
          [t, fresh, `payment:receipt:${payment}`],
        )
      ).rows[0].n;
      await runMessages({ database: db, providerFactory: () => mock });
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.message_jobs where tenant_id=$1 and client_id=$2 and (source_key like 'application:%' or source_key=$3)",
            [t, fresh, `payment:receipt:${payment}`],
          )
        ).rows[0].n,
        count,
      );
      for (const key of enabled)
        await db.query(
          "update public.tenant_configuration set value=jsonb_set(value,'{enabled}','false') where tenant_id=$1 and category='automation' and key=$2",
          [t, key],
        );
    },
  );
  await check(
    'Dedicated worker group dispatches without business or credential-table privileges',
    async () => {
      const id = await manual();
      const mock = new MockProvider();
      await db.query('set role loma_message_worker');
      try {
        await runMessages({ database: db, providerFactory: () => mock });
        assert(mock.messages.some((x) => x.id === id));
        for (const sql of [
          'select secret from communication_private.key',
          'select cipher from communication_private.integrations',
          'select profile from public.clients',
          "update public.clients set name='Forbidden' where false",
        ]) {
          let denied = false;
          try {
            await db.query(sql);
          } catch (e) {
            denied = e.code === '42501';
          }
          assert(denied);
        }
      } finally {
        await db.query('reset role');
      }
    },
  );
  writeFileSync(
    '.local/m6.json',
    JSON.stringify({
      tenant: t,
      client: fresh,
      branch: b,
      loan: overdue ?? fixture.loan,
      message: j,
    }),
    { mode: 0o600 },
  );
  console.log(`${passed} communications/campaigns/collections groups passed.`);
} finally {
  await db.end();
  if (running)
    execFileSync('docker', [...compose, 'start', 'messages'], {
      stdio: 'ignore',
    });
}
