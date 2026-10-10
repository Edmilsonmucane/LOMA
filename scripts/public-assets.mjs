import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const copy = JSON.parse(readFileSync('apps/web/messages/pt-MZ.json')).Public;
const escape = (v) =>
  v.replace(
    /[&<>"']/g,
    (x) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        x
      ],
  );
writeFileSync(
  'apps/web/public/offline.html',
  `<!doctype html><html lang="pt-MZ"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escape(copy.offlineTitle)}</title><style>body{font:16px system-ui;max-width:32rem;margin:5rem auto;padding:1.5rem;background:#F6F5F2;color:#15171A}h1{font-size:28px}a{display:inline-flex;padding:16px;background:#0E5A4A;color:white;border-radius:6px}</style><main><h1>${escape(copy.offlineTitle)}</h1><p>${escape(copy.offlineHelp)}</p><a href="/">${escape(copy.tryAgain)}</a></main></html>`,
);
const svg = readFileSync('apps/web/public/icon.svg');
for (const size of [192, 512])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`apps/web/public/icon-${size}.png`);
console.log(
  'Public offline copy and installation icons generated from catalogue/local SVG.',
);
