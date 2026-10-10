import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  contractText,
  contractQuote,
  type ContractSnapshot,
} from '../domain/applications';
import { formatMoney, formatPercent } from '@loma/loan-engine';
import { formatDate } from '../domain/dates';
export async function contractPdf({
  snapshot,
  id,
  version,
  labels,
  months,
  approvedAt,
}: {
  snapshot: ContractSnapshot;
  id: string;
  version: number;
  labels: Record<string, string>;
  months: string[];
  approvedAt: string;
}) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await readFile(
    join(
      process.cwd(),
      'node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff',
    ),
  );
  const font = await doc.embedFont(bytes, { subset: true });
  const q = contractQuote(snapshot, version);
  const approved = new Date(approvedAt);
  doc.setTitle(snapshot.template.title);
  doc.setAuthor(snapshot.brand.name);
  doc.setCreationDate(approved);
  doc.setModificationDate(approved);
  let page = doc.addPage([595.28, 841.89]);
  let y = 790;
  const ink = rgb(21 / 255, 23 / 255, 26 / 255);
  const line = rgb(231 / 255, 229 / 255, 224 / 255);
  const addPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 790;
  };
  const write = (text: string, size = 11) => {
    for (const row of wrap(text, font, size, 495)) {
      if (y < 60) addPage();
      page.drawText(row, { x: 50, y, size, font, color: ink });
      y -= size + 7;
    }
    y -= 6;
  };
  write(snapshot.brand.name, 20);
  write(snapshot.template.title, 16);
  write(`${labels.contract}: ${id}`, 10);
  write(`${labels.approvedOn}: ${formatDate(approvedAt, months)}`, 10);
  if (snapshot.brand.license)
    write(`${labels.license}: ${snapshot.brand.license}`, 10);
  write(contractText(snapshot, id, version).replaceAll('\\n', '\n'));
  write(
    `${snapshot.productName} · ${labels.versionLabel} ${snapshot.productVersion}`,
    12,
  );
  for (const [key, value] of [
    ['amount', q.requested],
    ['disbursed', q.disbursed],
    ['total', q.total],
    ['interest', q.interest],
    ['fees', q.fees],
    ['taxes', q.taxes],
    ['separate', q.separate],
    ['cost', q.cost],
  ] as const)
    write(`${labels[key]}: ${formatMoney(value)}`, 11);
  write(`${labels.annualRate}: ${formatPercent(q.annualRate)}`);
  write(labels.plan ?? '', 14);
  const header = () => {
    if (y < 100) addPage();
    write(
      `${labels.number} / ${labels.date} / ${labels.principal} / ${labels.interestPeriod} / ${labels.payment}`,
      10,
    );
  };
  header();
  for (const row of q.instalments) {
    if (y < 95) {
      addPage();
      header();
    }
    write(
      `${row.number} · ${formatDate(row.dueDate, months)} · ${formatMoney(row.principal)} · ${formatMoney(row.interest)} · ${formatMoney(row.total)}`,
      10,
    );
    if (row.capitalisedInterest > 0n)
      write(
        `${labels.capitalisedInterest}: ${formatMoney(row.capitalisedInterest)}`,
        10,
      );
  }
  if (snapshot.guarantees.length)
    write(`${labels.guarantees}: ${snapshot.guarantees.join(' · ')}`);
  if (snapshot.brand.footer) write(snapshot.brand.footer, 10);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: 50, y: 42 },
      end: { x: 545, y: 42 },
      thickness: 1,
      color: line,
    });
    p.drawText(`${snapshot.brand.name} · ${i + 1}/${pages.length}`, {
      x: 50,
      y: 25,
      size: 9,
      font,
      color: ink,
    });
  });
  return doc.save({ useObjectStreams: false });
}
function wrap(text: string, font: PDFFont, size: number, width: number) {
  return text.split(/\r?\n/).flatMap((paragraph) => {
    const result: string[] = [];
    let row = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = row ? `${row} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        row = next;
        continue;
      }
      if (row) result.push(row);
      row = '';
      for (const char of word) {
        if (font.widthOfTextAtSize(row + char, size) > width) {
          result.push(row);
          row = '';
        }
        row += char;
      }
    }
    result.push(row);
    return result;
  });
}
