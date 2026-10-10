import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import pg from 'pg';
import { demoDataset } from './demo-runtime.mjs';
const { createClient } = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
)('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8')),
  accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local seed only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
async function actor(key) {
  const c = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email: accounts[key].email,
    password: accounts[key].password,
  });
  if (error) throw new Error('Local actor unavailable');
  return c;
}
async function rpc(c, name, args) {
  const r = await c.rpc(name, args);
  if (r.error) throw new Error(`${name}: ${r.error.code} ${r.error.message}`);
  return r.data;
}
try {
  const platform = await actor('platform');
  let { rows } = await db.query(
    "select id,is_demo,demo_generation from public.tenants where slug='demonstracao' and active",
  );
  if (!rows.length) {
    const t = await rpc(platform, 'provision_tenant', {
      tenant_name: 'Demo Microcrédito',
      tenant_slug: 'demonstracao',
      preset_id: '20000000-0000-4000-8000-000000000001',
      selected_plan_id: '10000000-0000-4000-8000-000000000001',
    });
    for (const [key, role] of [
      ['sales', 'manager'],
      ['analyst', 'analyst'],
      ['cashier', 'cashier'],
      ['reader', 'reader'],
      ['collector', 'collector'],
    ])
      await db.query(
        'insert into public.memberships(tenant_id,user_id,role_id,display_name,email) select $1,$2,id,$3,$4 from public.tenant_roles where tenant_id=$1 and key=$5 on conflict do nothing',
        [t, accounts[key].id, accounts[key].name, accounts[key].email, role],
      );
    await rpc(platform, 'enable_demo', { t });
    rows = [{ id: t, is_demo: true, demo_generation: 0 }];
  }
  const t = rows[0];
  if (!t.is_demo) throw new Error('Refusing ordinary tenant');
  if (t.demo_generation > 0) {
    console.log('Demonstração existente preservada.');
    process.exitCode = 0;
  } else {
    const sales = await actor('sales');
    const blueprint = await rpc(sales, 'demo_blueprint', { t: t.id });
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
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Maputo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const dataset = demoDataset(products, today);
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
        dataset,
      },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    );
    await rpc(sales, 'reset_demo', {
      t: t.id,
      expected_generation: blueprint.generation,
      payload,
      signature: createHmac('sha256', key)
        .update('demo:' + payload)
        .digest('hex'),
    });
    console.log(
      'Demonstração preparada: 120 clientes, 60 créditos, pagamentos e mensagens sintéticas.',
    );
  }
} finally {
  await db.end();
}
