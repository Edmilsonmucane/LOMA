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
const storagePath = path.replace('.dump', '.storage.tar');
const storageFile = openSync(storagePath, 'wx', 0o600);
try {
  execFileSync(
    'docker',
    [
      'exec',
      'loma-local-storage-1',
      'tar',
      '-C',
      '/var/lib/storage',
      '-cf',
      '-',
      '.',
    ],
    { stdio: ['ignore', storageFile, 'pipe'] },
  );
} catch {
  throw new Error(
    'Storage backup failed; database dump alone does not contain document files.',
  );
} finally {
  closeSync(storageFile);
}
console.log(
  `Private local database and Storage backups: ${path}, ${storagePath}`,
);
