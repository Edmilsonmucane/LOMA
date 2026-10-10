import pg from 'pg';
import { readFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import {
  ConsoleProvider,
  HttpProvider,
  WhatsAppCloudProvider,
} from '../packages/messaging/src/index.ts';
export async function publicEndpoint(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  )
    throw new Error('Unsafe endpoint');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) throw new Error('IP endpoints are forbidden');
  const ips = await lookup(hostname, { all: true });
  if (!ips.length || ips.some(({ address }) => !publicAddress(address)))
    throw new Error('Private endpoint');
  return url;
}
export function publicAddress(ip) {
  if (ip.includes(':'))
    return /^2[0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0):/i.test(ip);
  const a = ip.split('.').map(Number);
  return (
    a.length === 4 &&
    a.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) &&
    ![0, 10, 127].includes(a[0]) &&
    a[0] < 224 &&
    !(a[0] === 169 && a[1] === 254) &&
    !(a[0] === 172 && a[1] >= 16 && a[1] <= 31) &&
    !(a[0] === 192 && [0, 168].includes(a[1])) &&
    !(a[0] === 100 && a[1] >= 64 && a[1] <= 127) &&
    !(a[0] === 198 && [18, 19, 51].includes(a[1])) &&
    !(a[0] === 203 && a[1] === 0)
  );
}
// DNS is resolved once and pinned for the connection; TLS still verifies the original hostname.
export async function safeHttpFetch(value, init = {}) {
  const url = await publicEndpoint(String(value));
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((x) => !publicAddress(x.address)))
    throw new Error('Private endpoint');
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: init.method ?? 'GET',
        headers: init.headers,
        agent: false,
        lookup: (_host, options, callback) => {
          const chosen = addresses[0];
          if (options.all) callback(null, addresses);
          else callback(null, chosen.address, chosen.family);
        },
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 262144) {
            req.destroy(new Error('Response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: {
                'content-type':
                  res.headers['content-type'] ?? 'application/json',
              },
            }),
          ),
        );
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Timeout')));
    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error('Aborted'));
        return;
      }
      init.signal.addEventListener(
        'abort',
        () => req.destroy(new Error('Aborted')),
        { once: true },
      );
    }
    if (init.body) req.write(init.body);
    req.end();
  });
}
export async function runMessages({
  database,
  providerFactory,
  max = 100,
} = {}) {
  const db =
    database ??
    new pg.Client({
      connectionString:
        process.env.COMMUNICATION_DATABASE_URL ??
        JSON.parse(readFileSync('.local/supabase.json', 'utf8')).DB_URL,
    });
  if (!database) await db.connect();
  let handled = 0;
  try {
    await db.query('begin');
    const lock = (
      await db.query('select pg_try_advisory_xact_lock(424206) locked')
    ).rows[0].locked;
    if (lock) {
      await db.query('select communication_private.schedule()');
      await db.query(
        'update communication_private.worker_health set last_run=now() where id',
      );
    }
    await db.query('commit');
    const jobs = (
      await db.query(
        "select id,tenant_id from public.message_jobs where status='queued' and available_at<=now() order by available_at limit $1",
        [max],
      )
    ).rows;
    for (const job of jobs) {
      await db.query('begin');
      try {
        const locked = (
          await db.query(
            'select pg_try_advisory_xact_lock(hashtextextended($1,424206)) locked',
            [job.tenant_id],
          )
        ).rows[0].locked;
        if (!locked) {
          await db.query('rollback');
          continue;
        }
        const value = (
          await db.query('select communication_private.prepare($1) payload', [
            job.id,
          ])
        ).rows[0].payload;
        if (!value) {
          await db.query('commit');
          continue;
        }
        await db.query(
          "update public.message_jobs set status='uncertain',reason='dispatching',attempted_at=now() where id=$1",
          [job.id],
        );
        await db.query('commit');
        await db.query('begin');
        await db.query(
          'select pg_advisory_xact_lock(hashtextextended($1,424206))',
          [job.tenant_id],
        );
        const dispatched = (
          await db.query(
            'select communication_private.dispatch_payload($1) payload',
            [job.id],
          )
        ).rows[0].payload;
        if (!dispatched) {
          await db.query('commit');
          continue;
        }
        value.to = dispatched.to;
        const cfg = value.integration;
        let provider;
        if (providerFactory) provider = providerFactory(value);
        else if (cfg.provider === 'console') provider = new ConsoleProvider();
        else if (cfg.provider === 'http') {
          await publicEndpoint(cfg.url);
          provider = new HttpProvider(cfg, safeHttpFetch);
        } else provider = new WhatsAppCloudProvider(cfg, safeHttpFetch);
        const result = await provider.send(value);
        await db.query('select communication_private.finish($1,$2)', [
          job.id,
          result,
        ]);
        await db.query('commit');
        handled++;
      } catch {
        // No automatic resend following an ambiguous provider submission or transaction failure.
        await db.query('rollback');
        await db.query(
          "update public.message_jobs set status='uncertain',reason='worker' where id=$1 and (status='queued' or status='uncertain' and reason='dispatching')",
          [job.id],
        );
        await db.query(
          'insert into public.message_events(tenant_id,message_id,state,detail) values($1,$2,\'uncertain\',\'{"reason":"worker"}\')',
          [job.tenant_id, job.id],
        );
      }
    }
  } finally {
    if (!database) await db.end();
  }
  return handled;
}
if (process.argv[1]?.endsWith('/message-worker.mjs')) {
  do {
    try {
      const n = await runMessages();
      if (n) console.log(`Processed ${n} messages.`);
    } catch {
      console.error(
        'Message worker failed; no credentials or payloads logged.',
      );
      if (!process.argv.includes('--watch')) process.exitCode = 1;
    }
    if (process.argv.includes('--watch'))
      await new Promise((resolve) => setTimeout(resolve, 30000));
  } while (process.argv.includes('--watch'));
}
