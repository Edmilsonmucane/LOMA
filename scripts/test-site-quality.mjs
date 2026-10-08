import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const fixture = process.env.PUBLIC_SITE_TEST_URL
  ? null
  : JSON.parse(readFileSync('.local/m7.json', 'utf8'));
const root = new URL(
  process.env.PUBLIC_SITE_TEST_URL ?? `http://${fixture.slug}.localhost:3200`,
);
assert(['http:', 'https:'].includes(root.protocol));
assert(!root.username && !root.password && !root.search && !root.hash);
const paths = ['/', '/simulate'];
mkdirSync('.local/site-quality', { recursive: true, mode: 0o700 });
for (const [index, path] of paths.entries()) {
  const url = new URL(path, root);
  if (path === '/simulate' && fixture)
    url.searchParams.set('product', fixture.product);
  const reportPath = `.local/site-quality/${index ? 'simulator' : 'home'}.json`;
  const exit = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        require.resolve('lighthouse/cli/index.js'),
        url.href,
        '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
        '--only-categories=performance,accessibility',
        '--output=json',
        `--output-path=${reportPath}`,
        '--quiet',
      ],
      { stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('exit', resolve);
  });
  assert.equal(exit, 0, `Lighthouse failed for ${path}`);
  chmodSync(reportPath, 0o600);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert(!report.runtimeError, report.runtimeError?.message);
  assert.equal(report.configSettings.formFactor, 'mobile');
  assert.equal(report.configSettings.throttlingMethod, 'simulate');
  const performance = Math.round(report.categories.performance.score * 100);
  const accessibility = Math.round(report.categories.accessibility.score * 100);
  const scripts = report.audits['network-requests'].details.items.filter(
    (item) => item.resourceType === 'Script',
  );
  const scriptBytes = scripts.reduce(
    (total, item) => total + item.transferSize,
    0,
  );
  console.log(
    `${path}: mobile performance ${performance}, accessibility ${accessibility}, JavaScript transfer ${scriptBytes} bytes (${scripts.length} resources).`,
  );
  assert(performance >= 90, `Mobile performance below 90 for ${path}`);
  assert(accessibility >= 90, `Mobile accessibility below 90 for ${path}`);
  assert(scripts.length > 0, 'JavaScript measurement did not execute');
  assert(
    scriptBytes < 150_000,
    `JavaScript transfer exceeds 150 kB for ${path}`,
  );
}
