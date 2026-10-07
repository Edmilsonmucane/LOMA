import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Type generation requires local database');
const databaseUrl = new URL(local.DB_URL);
databaseUrl.hostname = execFileSync(
  'docker',
  [
    'inspect',
    '-f',
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
    'loma-local-db-1',
  ],
  { encoding: 'utf8' },
).trim();
databaseUrl.port = '5432';
try {
  execFileSync(
    'docker',
    ['image', 'inspect', 'public.ecr.aws/supabase/postgres-meta:v0.95.2'],
    { stdio: 'ignore' },
  );
} catch {
  execFileSync('docker', ['pull', 'supabase/postgres-meta:v0.95.2'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  execFileSync(
    'docker',
    [
      'tag',
      'supabase/postgres-meta:v0.95.2',
      'public.ecr.aws/supabase/postgres-meta:v0.95.2',
    ],
    { stdio: 'ignore' },
  );
}
let output;
try {
  output = execFileSync(
    'pnpm',
    [
      'exec',
      'supabase',
      'gen',
      'types',
      'typescript',
      '--db-url',
      databaseUrl.toString(),
      '--schema',
      'public',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (error) {
  writeFileSync('.local/typegen.log', String(error.stderr ?? ''), {
    mode: 0o600,
  });
  throw new Error(
    'Type generation failed; diagnostics are in the private .local/typegen.log.',
  );
}
writeFileSync('apps/web/src/lib/supabase/database.types.ts', output);
console.log('Database types generated from the actual local schema.');
