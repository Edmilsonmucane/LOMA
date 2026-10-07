import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { randomBytes, createHmac } from 'node:crypto';
mkdirSync('.local', { recursive: true, mode: 0o700 });
const path = '.local/runtime.json';
const runtime = existsSync(path)
  ? JSON.parse(readFileSync(path, 'utf8'))
  : {
      password: randomBytes(24).toString('hex'),
      jwtSecret: randomBytes(32).toString('hex'),
    };
writeFileSync(path, JSON.stringify(runtime), { mode: 0o600 });
writeFileSync(
  '.local/runtime.env',
  `LOMA_LOCAL_DB_PASSWORD=${runtime.password}\nLOMA_LOCAL_JWT_SECRET=${runtime.jwtSecret}\n`,
  { mode: 0o600 },
);
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(role) {
  const value = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'supabase', role, iat: Math.floor(Date.now() / 1000) - 60, exp: Math.floor(Date.now() / 1000) + 31536000 })}`;
  return `${value}.${createHmac('sha256', runtime.jwtSecret).update(value).digest('base64url')}`;
}
try {
  execFileSync(
    'docker',
    [
      'compose',
      '--env-file',
      '.local/runtime.env',
      '-f',
      'supabase/compose.local.yml',
      'up',
      '-d',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch('http://127.0.0.1:54321/auth/v1/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Authentication startup failed');
  execFileSync(
    'docker',
    [
      'exec',
      'loma-local-db-1',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      "create or replace function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$; create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$; create or replace function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;",
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const file = '.local/supabase.json';
  const previous = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : {};
  writeFileSync(
    file,
    JSON.stringify({
      API_URL: 'http://127.0.0.1:54321',
      DB_URL: `postgres://postgres:${runtime.password}@127.0.0.1:54322/postgres`,
      ANON_KEY: previous.ANON_KEY ?? jwt('anon'),
      SERVICE_ROLE_KEY: previous.SERVICE_ROLE_KEY ?? jwt('service_role'),
    }),
    { mode: 0o600 },
  );
  execFileSync(process.execPath, ['scripts/migrate-local.mjs'], {
    stdio: 'inherit',
  });
  console.log('Local PostgreSQL, Supabase Auth, PostgREST and mail are ready.');
} catch (error) {
  if (error.stdout || error.stderr)
    writeFileSync(
      '.local/services.log',
      Buffer.concat([
        error.stdout ?? Buffer.alloc(0),
        error.stderr ?? Buffer.alloc(0),
      ]),
      { mode: 0o600 },
    );
  throw new Error(
    'Local services failed; inspect private .local/services.log and container readiness without publishing credentials.',
  );
}
