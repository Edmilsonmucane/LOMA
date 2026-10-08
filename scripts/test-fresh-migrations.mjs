import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local verification only');
const admin = new pg.Client({ connectionString: local.DB_URL });
await admin.connect();
const name = 'loma_m8_check_' + randomBytes(5).toString('hex');
let fresh;
try {
  await admin.query(`create database ${name}`);
  const url = new URL(local.DB_URL);
  url.pathname = '/' + name;
  fresh = new pg.Client({ connectionString: url.toString() });
  await fresh.connect();
  await fresh.query(
    'create schema extensions;create extension if not exists pgcrypto with schema extensions;create extension if not exists "uuid-ossp" with schema extensions;',
  );
  const auth = execFileSync(
    'docker',
    [
      'exec',
      'loma-local-db-1',
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--schema-only',
      '--schema=auth',
      '--no-owner',
      '--no-privileges',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await fresh.query(auth.replace(/^\\(?:un)?restrict .*$/gm, ''));
  const storage = execFileSync(
    'docker',
    [
      'exec',
      'loma-local-db-1',
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--schema-only',
      '--schema=storage',
      '--no-owner',
      '--no-privileges',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await fresh.query(
    storage
      .replace(/^\\(?:un)?restrict .*$/gm, '')
      .replace(/^CREATE POLICY[\s\S]*?;$/gm, ''),
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((x) => x.endsWith('.sql'))
    .sort())
    await fresh.query(readFileSync('supabase/migrations/' + file, 'utf8'));
  const { rows } = await fresh.query(
    "select count(*)::int n,bool_and(relrowsecurity) secured from pg_class join pg_namespace ns on ns.oid=relnamespace where ns.nspname='public' and relkind='r'",
  );
  if (rows[0].n !== 39 || !rows[0].secured)
    throw new Error('Fresh schema RLS failed');
  await fresh.query('begin');
  await fresh.query(
    "insert into public.tenants(slug,name,plan_id) values('fresh-m8','Verificação M8','10000000-0000-4000-8000-000000000001')",
  );
  const cfg = await fresh.query(
    "select scoring_private.valid(value) valid from public.tenant_configuration where category='scoring' and key='main'",
  );
  if (!cfg.rows.every((x) => x.valid) || !cfg.rows.length)
    throw new Error('Fresh tenant scoring defaults invalid');
  await fresh.query('rollback');
  console.log(
    'All migrations applied to an empty database; 39 public tables enforce RLS and new-tenant defaults are valid.',
  );
} finally {
  if (fresh) await fresh.end();
  await admin.query(`drop database if exists ${name}`);
  await admin.end();
}
