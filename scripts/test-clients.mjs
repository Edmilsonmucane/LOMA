import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
async function signIn(key) {
  const client = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: accounts[key].email,
    password: accounts[key].password,
  });
  assert(!error, 'Login failed');
  return client;
}
try {
  const [platform, manager, other, reader, collector] = await Promise.all(
    ['platform', 'manager', 'other', 'reader', 'collector'].map(signIn),
  );
  const provision = await platform.rpc('provision_tenant', {
    tenant_name: 'Verificação de Clientes',
    tenant_slug: `clientes-${randomUUID().slice(0, 8)}`,
    preset_id: '20000000-0000-4000-8000-000000000001',
    selected_plan_id: '10000000-0000-4000-8000-000000000001',
  });
  assert(!provision.error, 'Provision failed');
  const t = provision.data;
  const { rows: branches } = await db.query(
    'select id from public.branches where tenant_id=$1',
    [t],
  );
  const branch = branches[0].id;
  const { rows: demo } = await db.query(
    "select b.id branch_id,b.tenant_id from public.branches b join public.tenants t on t.id=b.tenant_id where t.slug='demo' order by b.name limit 1",
  );
  const a = demo[0];
  const { rows: otherBranch } = await db.query(
    'insert into public.branches(tenant_id,name) values($1,$2) returning id',
    [a.tenant_id, `Matola · Clientes ${randomUUID().slice(0, 8)}`],
  );
  const data = (name, b, phone) => ({
    name,
    branch_id: b,
    birth_date: '1990-01-01',
    classification: 'regular',
    profile: {
      identities: [],
      contacts: [{ kind: 'phone', value: phone }],
      province: 'Maputo',
      district: 'Matola',
      neighbourhood: 'Fomento',
      address: '',
      activity: 'Comércio',
      employer: '',
      income: '1500000',
      expenses: '700000',
      references: [],
      guarantors: [],
    },
    consent: { sms: false, whatsapp: false, email: false, source: '' },
  });
  const one = data(
    'Amélia Cossa',
    a.branch_id,
    `+25884${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
  );
  const result = await manager.rpc('save_client', {
    t: a.tenant_id,
    client_data: one,
  });
  assert(!result.error, 'Create client failed');
  const c = result.data;
  let outsideClient;
  await check('Client RLS, cross-tenant writes and agency limits', async () => {
    assert.equal(
      (await other.rpc('search_clients', { t: a.tenant_id, query: 'Amélia' }))
        .error?.code,
      '42501',
    );
    for (const table of [
      'clients',
      'client_keys',
      'client_events',
      'client_documents',
    ]) {
      const { data, error } = await other
        .from(table)
        .select('*')
        .eq('tenant_id', a.tenant_id);
      assert(!error);
      assert.equal(data.length, 0);
    }
    assert.equal(
      (await other.rpc('save_client', { t: a.tenant_id, client_data: one }))
        .error?.code,
      '42501',
    );
    assert.equal(
      (await reader.rpc('save_client', { t: a.tenant_id, client_data: one }))
        .error?.code,
      '42501',
    );
    const out = await manager.rpc('save_client', {
      t: a.tenant_id,
      client_data: data(
        'Tomás Sitoe',
        otherBranch[0].id,
        `+25885${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
      ),
    });
    assert(!out.error);
    outsideClient = out.data;
    const scopedSearch = await collector.rpc('search_clients', {
      t: a.tenant_id,
      query: 'Tomás Sitoe',
      selected_branch: otherBranch[0].id,
    });
    assert(!scopedSearch.error);
    assert.equal(scopedSearch.data.length, 0);
    assert.equal(
      (await collector.from('clients').select('id').eq('id', out.data)).data
        .length,
      0,
    );
    assert.equal(
      (
        await collector.rpc('add_client_note', {
          t: a.tenant_id,
          c: out.data,
          note: 'Sem acesso',
        })
      ).error?.code,
      '42501',
    );
    const { rows: ownBranch } = await db.query(
      'select branch_id from public.memberships where tenant_id=$1 and user_id=$2',
      [a.tenant_id, accounts.collector.id],
    );
    const ownData = data(
      'Celina Mabunda',
      ownBranch[0].branch_id,
      `+25886${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
    );
    const own = await manager.rpc('save_client', {
      t: a.tenant_id,
      client_data: ownData,
    });
    assert(!own.error);
    assert.equal(
      (await collector.from('clients').select('id').eq('id', own.data)).data
        .length,
      1,
    );
    assert.equal(
      (
        await collector.rpc('search_clients', {
          t: a.tenant_id,
          query: ownData.profile.contacts[0].value,
        })
      ).data.length,
      1,
    );
    assert.equal(
      (
        await collector.rpc('save_client', {
          t: a.tenant_id,
          selected_client: outsideClient,
          expected_revision: 1,
          client_data: ownData,
        })
      ).error?.code,
      '42501',
    );
    const scopedRole = (
      await db.query(
        'select r.id,r.permissions from public.tenant_roles r join public.memberships m on m.role_id=r.id where m.tenant_id=$1 and m.user_id=$2',
        [a.tenant_id, accounts.collector.id],
      )
    ).rows[0];
    try {
      await db.query(
        'update public.tenant_roles set permissions=$1 where id=$2',
        [
          [...new Set([...scopedRole.permissions, 'clients.manage'])],
          scopedRole.id,
        ],
      );
      assert(
        !(
          await collector.rpc('save_client', {
            t: a.tenant_id,
            selected_client: own.data,
            expected_revision: 1,
            client_data: ownData,
          })
        ).error,
        'Scoped editor cannot edit own branch',
      );
      assert.equal(
        (
          await collector.rpc('save_client', {
            t: a.tenant_id,
            selected_client: outsideClient,
            expected_revision: 1,
            client_data: ownData,
          })
        ).error?.code,
        '42501',
      );
      assert.equal(
        (
          await collector.rpc('save_client', {
            t: a.tenant_id,
            client_data: { ...ownData, branch_id: otherBranch[0].id },
          })
        ).error?.code,
        '42501',
      );
    } finally {
      await db.query(
        'update public.tenant_roles set permissions=$1 where id=$2',
        [scopedRole.permissions, scopedRole.id],
      );
    }
    const visible = await reader.from('clients').select('id').eq('id', c);
    assert.equal(visible.data.length, 1);
  });
  await check('Duplicates, edit conflicts and consent history', async () => {
    assert.equal(
      (await manager.rpc('save_client', { t: a.tenant_id, client_data: one }))
        .error?.code,
      '23505',
    );
    one.consent = {
      sms: true,
      whatsapp: false,
      email: false,
      source: 'Autorizou presencialmente',
    };
    assert(
      !(
        await manager.rpc('save_client', {
          t: a.tenant_id,
          client_data: one,
          selected_client: c,
          expected_revision: 1,
        })
      ).error,
    );
    assert.equal(
      (
        await manager.rpc('save_client', {
          t: a.tenant_id,
          client_data: one,
          selected_client: c,
          expected_revision: 1,
        })
      ).error?.code,
      'PT409',
    );
    const events = await manager
      .from('client_events')
      .select('*')
      .eq('client_id', c)
      .eq('kind', 'consent');
    assert.equal(events.data.length, 2);
    await assert.rejects(
      db.query(
        "update public.client_events set detail='{}' where client_id=$1",
        [c],
      ),
      (e) => e.code === '42501',
    );
    assert.equal(
      (await manager.from('clients').update({ name: 'Sem RPC' }).eq('id', c))
        .error?.code,
      '42501',
    );
  });
  await check(
    'Private documents: upload, completion, signed access, tenant/agency denial and expiry',
    async () => {
      const bytes = Buffer.from('%PDF-1.4\nprivate document\n%%EOF');
      const reservation = await manager.rpc('reserve_client_document', {
        t: a.tenant_id,
        c,
        document_data: {
          kind: 'document',
          title: 'BI verificado',
          filename: 'bi.pdf',
          mime_type: 'application/pdf',
          size: bytes.length,
          expires_on: '2030-01-01',
        },
      });
      assert(!reservation.error, 'Reserve failed');
      const d = reservation.data;
      assert.equal(
        (
          await manager.rpc('complete_client_document', {
            t: a.tenant_id,
            did: d.id,
          })
        ).error?.code,
        '23514',
      );
      assert(
        (
          await other.storage
            .from('client-documents')
            .upload(d.path, bytes, { contentType: 'application/pdf' })
        ).error,
        'Cross-tenant upload permitted',
      );
      const uploaded = await manager.storage
        .from('client-documents')
        .upload(d.path, bytes, { contentType: 'application/pdf' });
      if (uploaded.error)
        console.log({
          status: uploaded.error.statusCode,
          message: uploaded.error.message,
        });
      assert(!uploaded.error, 'Real Storage upload failed');
      const completed = await manager.rpc('complete_client_document', {
        t: a.tenant_id,
        did: d.id,
      });
      assert(!completed.error, 'Complete failed');
      assert(
        (
          await other.storage
            .from('client-documents')
            .createSignedUrl(d.path, 60)
        ).error,
        'Cross-tenant sign permitted',
      );
      assert(
        (await other.storage.from('client-documents').download(d.path)).error,
        'Cross-tenant download permitted',
      );
      const publicResponse = await fetch(
        `${local.API_URL}/storage/v1/object/public/client-documents/${d.path}`,
      );
      assert(!publicResponse.ok, 'Private file public');
      const outside = await manager.rpc('reserve_client_document', {
        t: a.tenant_id,
        c: outsideClient,
        document_data: {
          kind: 'document',
          title: 'BI da outra agência',
          filename: 'bi.pdf',
          mime_type: 'application/pdf',
          size: bytes.length,
          expires_on: '',
        },
      });
      assert(!outside.error);
      assert(
        !(
          await manager.storage
            .from('client-documents')
            .upload(outside.data.path, bytes, {
              contentType: 'application/pdf',
            })
        ).error,
      );
      assert(
        !(
          await manager.rpc('complete_client_document', {
            t: a.tenant_id,
            did: outside.data.id,
          })
        ).error,
      );
      assert(
        (
          await collector.storage
            .from('client-documents')
            .createSignedUrl(outside.data.path, 60)
        ).error,
        'Cross-branch sign permitted',
      );
      assert(
        (
          await collector.storage
            .from('client-documents')
            .download(outside.data.path)
        ).error,
        'Cross-branch download permitted',
      );
      const signed = await reader.storage
        .from('client-documents')
        .createSignedUrl(d.path, 1);
      assert(!signed.error, 'Reader sign failed');
      assert((await fetch(signed.data.signedUrl)).ok, 'Signed URL unavailable');
      await new Promise((resolve) => setTimeout(resolve, 2100));
      assert(
        !(await fetch(signed.data.signedUrl)).ok,
        'Signed URL did not expire',
      );
      assert(
        (
          await manager.storage.from('client-documents').upload(d.path, bytes, {
            contentType: 'application/pdf',
            upsert: true,
          })
        ).error,
        'Ready document overwritten',
      );
    },
  );
  await check(
    '500 imported clients, readable error report and fast search',
    async () => {
      const names = [
        'Amélia',
        'Tomás',
        'Graça',
        'José',
        'Celina',
        'Artur',
        'Fátima',
        'Mateus',
        'Dulce',
        'Joaquim',
      ];
      const surnames = [
        'Cossa',
        'Sitoe',
        'Mucavele',
        'Chissano',
        'Mabunda',
        'Machel',
        'Nhantumbo',
        'Langa',
        'Chongo',
        'Macuácua',
      ];
      const rows = Array.from({ length: 500 }, (_, i) => ({
        row: i + 2,
        data: data(
          `${names[i % 10]} ${surnames[Math.floor(i / 10) % 10]}`,
          branch,
          `+25884${String(1000000 + i)}`,
        ),
      }));
      rows.push({ row: 502, data: rows[0].data });
      rows.push({ row: 503, data: { ...rows[1].data, name: '' } });
      rows.push({
        row: 504,
        data: {
          ...rows[1].data,
          profile: { ...rows[1].data.profile, income: '9999999999999999999' },
        },
      });
      rows.push({ row: 505, data: { ...rows[1].data, branch_id: null } });
      const start = performance.now();
      const imported = await platform.rpc('import_clients', { t, rows });
      assert(!imported.error, 'Batch failed');
      assert.equal(imported.data.filter((x) => !x.error).length, 500);
      assert.deepEqual(
        imported.data.slice(-4).map((x) => x.error),
        ['duplicate', 'invalid', 'invalid', 'invalid'],
      );
      console.log(
        `Import: 500 created, 4 reported errors; ${Math.round(performance.now() - start)} ms`,
      );
      const searchStart = performance.now();
      const found = await platform.rpc('search_clients', {
        t,
        query: '+258841000499',
      });
      assert(!found.error);
      assert.equal(found.data.length, 1);
      const elapsed = performance.now() - searchStart;
      assert(elapsed < 1000, 'Search exceeded 1 second');
      console.log(`Search among 500: ${Math.round(elapsed)} ms`);
      const { rows: money } = await db.query(
        "select data_type from information_schema.columns where table_schema='public' and table_name='clients' and column_name in ('income','expenses')",
      );
      assert(money.every((x) => x.data_type === 'bigint'));
    },
  );
  console.log(`${passed} client/database/Storage checks passed.`);
} finally {
  await db.end();
}
