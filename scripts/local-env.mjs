import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
const status = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
if (
  !status.API_URL?.startsWith('http://127.0.0.1:') ||
  !status.ANON_KEY ||
  !status.SERVICE_ROLE_KEY
)
  throw new Error('Local Supabase is not ready');
const file = 'apps/web/.env.local';
const desired = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  PLATFORM_BASE_DOMAIN: 'localhost',
};
let content = existsSync(file) ? readFileSync(file, 'utf8') : '';
for (const [key, value] of Object.entries(desired)) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (match && match[1] !== value)
    throw new Error(
      `Existing ${key} differs; preserve it and configure the local environment separately`,
    );
  if (!match) content += `${key}=${value}\n`;
}
writeFileSync(file, content, { mode: 0o600 });
mkdirSync('.local', { recursive: true, mode: 0o700 });
writeFileSync('.local/supabase.json', JSON.stringify(status), { mode: 0o600 });
console.log(
  'Local Supabase bindings saved in ignored files. No credential values printed.',
);
