import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local migrations require local services');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
try {
  await db.query('create schema if not exists supabase_migrations');
  await db.query(
    'create table if not exists supabase_migrations.local_versions(version text primary key,checksum text not null)',
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    await db.query('begin');
    try {
      await db.query('select pg_advisory_xact_lock(424201)');
      const { rows } = await db.query(
        'select checksum from supabase_migrations.local_versions where version=$1',
        [file],
      );
      if (rows[0]) {
        if (rows[0].checksum !== hash)
          throw new Error('Applied migration changed; add a new version');
      } else {
        await db.query(sql);
        await db.query(
          'insert into supabase_migrations.local_versions values($1,$2)',
          [file, hash],
        );
        console.log(`Applied ${file}`);
      }
      await db.query('commit');
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
  }
  await db.query("notify pgrst,'reload schema'");
} finally {
  await db.end();
}
