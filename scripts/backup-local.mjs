import { execFileSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
mkdirSync('.local/backups', { recursive: true, mode: 0o700 });
const path = `.local/backups/loma-${new Date().toISOString().replaceAll(':', '-')}.dump`;
const file = openSync(path, 'wx', 0o600);
try {
  execFileSync(
    'docker',
    [
      'exec',
      'loma-local-db-1',
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--format=custom',
    ],
    { stdio: ['ignore', file, 'pipe'] },
  );
} catch {
  throw new Error(
    'Local backup failed. No database credentials were published.',
  );
} finally {
  closeSync(file);
}
console.log(`Private local database backup: ${path}`);
