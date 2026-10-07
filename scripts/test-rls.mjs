import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import pg from 'pg';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('RLS verification requires isolated local Supabase');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
let passed = 0;
let extraBranch;
let factorId;
let originalSecurity;
let actor;
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
  assert(!error, 'Fixture login failed');
  return client;
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.toUpperCase().replace(/=+$/, ''))
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((value) => parseInt(value, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac('sha1', bytes).update(counter).digest();
  const offset = hash[19] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    '0',
  );
}
try {
  actor = await signIn('manager');
  const other = await signIn('other');
  const reader = await signIn('reader');
  const collector = await signIn('collector');
  const { rows: tenants } = await db.query(
    "select * from public.tenants where slug in ('demo','beira')",
  );
  const a = tenants.find((row) => row.slug === 'demo');
  const b = tenants.find((row) => row.slug === 'beira');
  assert(a && b, 'Tenant fixtures missing');
  originalSecurity = a.security;
  await check('RLS enabled on every business and platform table', async () => {
    const { rows } = await db.query(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and relname in ('platform_admins','plans','presets','tenants','branches','tenant_roles','memberships','tenant_configuration','audit_events','platform_audit_events','products','product_versions','clients','client_keys','client_events','client_documents','applications','application_events','contracts','loans')",
    );
    assert.equal(rows.length, 20);
    assert(rows.every((row) => row.relrowsecurity));
  });
  for (const table of [
    'tenants',
    'branches',
    'tenant_roles',
    'memberships',
    'tenant_configuration',
    'audit_events',
    'products',
    'product_versions',
    'clients',
    'client_keys',
    'client_events',
    'client_documents',
  ])
    await check(`Tenant A cannot read B: ${table}`, async () => {
      const { data, error } = await actor
        .from(table)
        .select('*')
        .eq(table === 'tenants' ? 'id' : 'tenant_id', b.id);
      assert(!error);
      assert.equal(data.length, 0);
    });
  await check('Tenant B cannot read A', async () => {
    const { data, error } = await other
      .from('tenant_configuration')
      .select('*')
      .eq('tenant_id', a.id);
    assert(!error);
    assert.equal(data.length, 0);
  });
  await check('Tenant A cannot insert into B', async () => {
    const { error } = await actor
      .from('branches')
      .insert({ tenant_id: b.id, name: 'Agência sem autorização' });
    assert.equal(error?.code, '42501');
  });
  await check('Tenant A cannot update B', async () => {
    const { data, error } = await actor
      .from('tenants')
      .update({ name: 'Alteração sem autorização' })
      .eq('id', b.id)
      .select();
    assert(!error);
    assert.equal(data.length, 0);
    const { rows } = await db.query(
      'select name from public.tenants where id=$1',
      [b.id],
    );
    assert.equal(rows[0].name, b.name);
  });
  await check('Read-only user cannot write', async () => {
    const { data, error } = await reader
      .from('tenants')
      .update({ name: 'Alteração sem autorização' })
      .eq('id', a.id)
      .select();
    assert(!error);
    assert.equal(data.length, 0);
    const denied = await reader
      .from('branches')
      .insert({ tenant_id: a.id, name: 'Agência sem autorização' });
    assert.equal(denied.error?.code, '42501');
  });
  await check(
    'Tenant role cannot be borrowed from another tenant',
    async () => {
      const { rows } = await db.query(
        "select id from public.tenant_roles where tenant_id=$1 and key='reader'",
        [b.id],
      );
      const { error } = await actor.from('memberships').insert({
        tenant_id: a.id,
        user_id: accounts.other.id,
        role_id: rows[0].id,
        display_name: 'Inácio Sitoe',
        email: accounts.other.email,
      });
      assert.equal(error?.code, '23503');
    },
  );
  await check('Manager profile retains essential permissions', async () => {
    const { rows } = await db.query(
      "select id from public.tenant_roles where tenant_id=$1 and key='manager'",
      [a.id],
    );
    const { error } = await actor
      .from('tenant_roles')
      .update({ permissions: ['tenant.read'] })
      .eq('id', rows[0].id);
    assert.equal(error?.code, '42501');
  });
  await check('Tenant user limit is enforced by the database', async () => {
    const { rows: plans } = await db.query(
      'select id,limits from public.plans where id=$1',
      [a.plan_id],
    );
    const { rows: roles } = await db.query(
      "select id from public.tenant_roles where tenant_id=$1 and key='reader'",
      [a.id],
    );
    try {
      await db.query(
        "update public.plans set limits=jsonb_set(limits,'{users}','1') where id=$1",
        [a.plan_id],
      );
      const { error } = await actor.from('memberships').insert({
        tenant_id: a.id,
        user_id: accounts.other.id,
        role_id: roles[0].id,
        display_name: 'Inácio Sitoe',
        email: accounts.other.email,
      });
      assert.equal(error?.code, '23514');
    } finally {
      await db.query('update public.plans set limits=$1 where id=$2', [
        plans[0].limits,
        a.plan_id,
      ]);
    }
  });
  extraBranch = randomUUID();
  await db.query(
    'insert into public.branches(id,tenant_id,name) values($1,$2,$3)',
    [extraBranch, a.id, `Matola · Verificação ${extraBranch.slice(0, 8)}`],
  );
  await check('Branch-scoped collector sees only assigned branch', async () => {
    const { data, error } = await collector
      .from('branches')
      .select('id')
      .eq('tenant_id', a.id);
    assert(!error);
    assert.equal(data.length, 1);
    assert.notEqual(data[0].id, extraBranch);
    const managerRows = await actor
      .from('branches')
      .select('id')
      .eq('tenant_id', a.id);
    assert(managerRows.data.some((row) => row.id === extraBranch));
  });
  await check('Tenant identity cannot be moved', async () => {
    const { error } = await actor
      .from('branches')
      .update({ tenant_id: b.id })
      .eq('id', extraBranch);
    assert.equal(error?.code, '42501');
  });
  await check(
    'Audit captures actual actor and before/after values',
    async () => {
      const { error } = await actor
        .from('branches')
        .update({ name: `Matola · Confirmada ${extraBranch.slice(0, 8)}` })
        .eq('id', extraBranch);
      assert(!error);
      const { rows } = await db.query(
        "select * from public.audit_events where entity_id=$1 and action='update' order by id desc limit 1",
        [extraBranch],
      );
      assert.equal(rows[0].actor_id, accounts.manager.id);
      assert.notEqual(rows[0].previous.name, rows[0].current.name);
    },
  );
  await check('Audit modification rejected by database trigger', async () => {
    await assert.rejects(
      db.query('update public.audit_events set action=$1 where entity_id=$2', [
        'tamper',
        extraBranch,
      ]),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      db.query('delete from public.audit_events where entity_id=$1', [
        extraBranch,
      ]),
      (error) => error.code === '42501',
    );
  });
  await check(
    'User cannot self-promote to platform administration',
    async () => {
      const { error } = await actor
        .from('platform_admins')
        .insert({ user_id: accounts.manager.id });
      assert.equal(error?.code, '42501');
      const rpc = await actor.rpc('provision_tenant', {
        tenant_name: 'Sem autorização',
        tenant_slug: 'sem-autorizacao',
        preset_id: '20000000-0000-4000-8000-000000000001',
        selected_plan_id: '10000000-0000-4000-8000-000000000001',
      });
      assert.equal(rpc.error?.code, '42501');
    },
  );
  await check(
    'Product revisions are isolated, immutable and reject stale edits',
    async () => {
      const { rows: templates } = await db.query(
        'select terms from public.product_versions where tenant_id=$1 order by version limit 1',
        [a.id],
      );
      const conditions = templates[0].terms;
      const created = await actor.rpc('save_product', {
        t: a.id,
        product_name: `Produto verificado ${randomUUID().slice(0, 8)}`,
        conditions,
        expected_revision: 0,
        product_status: 'active',
      });
      assert(!created.error);
      const p = created.data;
      const old = await actor
        .from('product_versions')
        .select('*')
        .eq('product_id', p)
        .single();
      assert(!old.error);
      const changed = { ...conditions, rate: '0.07' };
      const saved = await actor.rpc('save_product', {
        t: a.id,
        selected_product: p,
        product_name: 'Produto actualizado',
        conditions: changed,
        expected_revision: 1,
        product_status: 'draft',
      });
      assert(!saved.error);
      const head = await actor
        .from('products')
        .select('*')
        .eq('id', p)
        .single();
      assert.equal(head.data.revision, 2);
      assert.equal(head.data.active_version, 1);
      const previous = await actor
        .from('product_versions')
        .select('*')
        .eq('id', old.data.id)
        .single();
      assert.deepEqual(previous.data.terms, old.data.terms);
      const stale = await actor.rpc('save_product', {
        t: a.id,
        selected_product: p,
        product_name: 'Edição antiga',
        conditions,
        expected_revision: 1,
        product_status: 'active',
      });
      assert.equal(stale.error?.code, 'PT409');
      const cross = await other.rpc('save_product', {
        t: b.id,
        selected_product: p,
        product_name: 'Sem acesso',
        conditions,
        expected_revision: 2,
        product_status: 'active',
      });
      assert.equal(cross.error?.code, '42501');
      const readonly = await reader.rpc('save_product', {
        t: a.id,
        product_name: 'Sem acesso',
        conditions,
        expected_revision: 0,
        product_status: 'active',
      });
      assert.equal(readonly.error?.code, '42501');
      const invalid = await actor.rpc('save_product', {
        t: a.id,
        product_name: 'Sem regras',
        conditions: { ...conditions, rate: null },
        expected_revision: 0,
        product_status: 'active',
      });
      assert.equal(invalid.error?.code, '23514');
      await assert.rejects(
        db.query('update public.product_versions set name=$1 where id=$2', [
          'Alteração',
          old.data.id,
        ]),
        (e) => e.code === '42501',
      );
      await assert.rejects(
        db.query('delete from public.product_versions where id=$1', [
          old.data.id,
        ]),
        (e) => e.code === '42501',
      );
      const wrongRole = await actor.rpc('save_product', {
        t: a.id,
        product_name: 'Perfil errado',
        conditions: {
          ...conditions,
          approvalLevels: [
            { upTo: conditions.maxPrincipal, role: 'inexistent' },
          ],
        },
        expected_revision: 0,
        product_status: 'active',
      });
      assert.equal(wrongRole.error?.code, '23514');
    },
  );
  const enrolled = await actor.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `RLS ${randomUUID().slice(0, 8)}`,
  });
  assert(!enrolled.error);
  factorId = enrolled.data.id;
  await db.query(
    "update public.tenants set security=jsonb_set(security,'{require_mfa}','true') where id=$1",
    [a.id],
  );
  await check('Required MFA rejects aal1 sessions', async () => {
    const { data, error } = await actor
      .from('tenant_configuration')
      .select('id')
      .eq('tenant_id', a.id);
    assert(!error);
    assert.equal(data.length, 0);
  });
  await check('Real TOTP verification grants aal2 access', async () => {
    const verified = await actor.auth.mfa.challengeAndVerify({
      factorId,
      code: totp(enrolled.data.totp.secret),
    });
    assert(!verified.error, 'TOTP challenge failed');
    const { data, error } = await actor
      .from('tenant_configuration')
      .select('id')
      .eq('tenant_id', a.id);
    assert(!error);
    assert(data.length >= 7);
  });
  await db.query('update public.tenants set security=$1 where id=$2', [
    originalSecurity,
    a.id,
  ]);
  const {
    data: { session },
  } = await actor.auth.getSession();
  const claims = JSON.parse(
    Buffer.from(session.access_token.split('.')[1], 'base64url').toString(),
  );
  const { rows: sessions } = await db.query(
    'select created_at from auth.sessions where id=$1',
    [claims.session_id],
  );
  try {
    await db.query(
      "update auth.sessions set created_at=now()-interval '31 days' where id=$1",
      [claims.session_id],
    );
    await check(
      'Tenant-configured session expiry rejects stale session',
      async () => {
        const { data, error } = await actor
          .from('tenants')
          .select('id')
          .eq('id', a.id);
        assert(!error);
        assert.equal(data.length, 0);
      },
    );
  } finally {
    await db.query('update auth.sessions set created_at=$1 where id=$2', [
      sessions[0].created_at,
      claims.session_id,
    ]);
  }
  console.log(
    `${passed} database and authentication checks passed; no mocked policies.`,
  );
} finally {
  const { rows } = await db.query(
    "select id from public.tenants where slug='demo'",
  );
  if (originalSecurity && rows[0])
    await db.query('update public.tenants set security=$1 where id=$2', [
      originalSecurity,
      rows[0].id,
    ]);
  if (factorId && actor) await actor.auth.mfa.unenroll({ factorId });
  if (extraBranch)
    await db.query('delete from public.branches where id=$1', [extraBranch]);
  await db.end();
}
