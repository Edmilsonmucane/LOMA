import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Bootstrap is restricted to local Supabase');
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
const accounts = existsSync('.local/accounts.json')
  ? JSON.parse(readFileSync('.local/accounts.json', 'utf8'))
  : {};
const definitions = [
  ['platform', 'plataforma@loma.test', 'Administração LOMA'],
  ['manager', 'gestor@demo.loma.test', 'Amélia Mucavele'],
  ['analyst', 'analista@demo.loma.test', 'Olívia Mondlane'],
  ['cashier', 'caixa@demo.loma.test', 'Ernesto Chissano'],
  ['reader', 'leitura@demo.loma.test', 'Tomás Nhantumbo'],
  ['collector', 'cobrador@demo.loma.test', 'Celina Macuácua'],
  ['other', 'gestor@beira.loma.test', 'Inácio Sitoe'],
];
try {
  for (const [key, email, name] of definitions) {
    if (accounts[key]) {
      const { data } = await admin.auth.admin.getUserById(accounts[key].id);
      if (data.user) continue;
    }
    const password = randomBytes(24).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw new Error(`Could not create local ${key} account`);
    accounts[key] = { id: data.user.id, email, password, name };
  }
  writeFileSync('.local/accounts.json', JSON.stringify(accounts, null, 2), {
    mode: 0o600,
  });
  await db.query(
    'insert into public.platform_admins(user_id) values($1) on conflict do nothing',
    [accounts.platform.id],
  );
  const actor = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginError } = await actor.auth.signInWithPassword({
    email: accounts.platform.email,
    password: accounts.platform.password,
  });
  if (loginError) throw new Error('Local admin login failed');
  for (const [slug, name, owner] of [
    ['demo', 'Demo Microcrédito', 'manager'],
    ['beira', 'Macuti Microcrédito', 'other'],
  ]) {
    let { rows } = await db.query(
      'select id from public.tenants where slug=$1',
      [slug],
    );
    if (!rows.length) {
      const { data, error } = await actor.rpc('provision_tenant', {
        tenant_name: name,
        tenant_slug: slug,
        preset_id: '20000000-0000-4000-8000-000000000001',
        selected_plan_id: '10000000-0000-4000-8000-000000000001',
      });
      if (error)
        throw new Error(
          `Local tenant ${slug} provisioning failed: ${error.code}`,
        );
      rows = [{ id: data }];
    }
    const tenantId = rows[0].id;
    for (const [key, role] of [
      [owner, 'manager'],
      ...(slug === 'demo'
        ? [
            ['reader', 'reader'],
            ['analyst', 'analyst'],
            ['cashier', 'cashier'],
            ['collector', 'collector'],
          ]
        : []),
    ]) {
      const branch = await db.query(
        'select id from public.branches where tenant_id=$1 order by name limit 1',
        [tenantId],
      );
      await db.query(
        'insert into public.memberships(tenant_id,user_id,role_id,branch_id,display_name,email) select $1,$2,id,$3,$4,$5 from public.tenant_roles where tenant_id=$1 and key=$6 on conflict(tenant_id,user_id) do nothing',
        [
          tenantId,
          accounts[key].id,
          key === 'collector' ? branch.rows[0].id : null,
          accounts[key].name,
          accounts[key].email,
          role,
        ],
      );
    }
  }
  console.log(
    'Local platform and two isolated tenants prepared. Generated credentials remain in .local/accounts.json.',
  );
} finally {
  await db.end();
}
