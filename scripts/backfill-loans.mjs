import { readFileSync } from 'node:fs';
import pg from 'pg';
import { engine } from './engine-runtime.mjs';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Administrative backfill is local-only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
let count = 0;
try {
  const { rows } = await db.query(
    'select l.id,l.tenant_id,c.snapshot,c.engine_version from public.loans l join public.contracts c on c.id=l.contract_id and c.tenant_id=l.tenant_id where not exists(select 1 from public.loan_accounts a where a.loan_id=l.id) order by l.tenant_id,l.id',
  );
  for (const l of rows) {
    if (l.engine_version !== 1)
      throw new Error('Unsupported historical engine');
    const s = l.snapshot;
    const p = engine.simulate({
      principal: BigInt(s.principal),
      periods: s.periods,
      startDate: s.startDate,
      terms: s.terms,
    });
    const json = JSON.stringify(p, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    await db.query('begin');
    try {
      await db.query('select id from public.tenants where id=$1 for update', [
        l.tenant_id,
      ]);
      await db.query('select financial_private.initialise($1,$2,$3::jsonb)', [
        l.tenant_id,
        l.id,
        json,
      ]);
      await db.query('commit');
      count++;
    } catch (e) {
      await db.query('rollback');
      throw e;
    }
  }
  console.log(
    `Historical plans initialised: ${count}. Existing plans preserved.`,
  );
} finally {
  await db.end();
}
