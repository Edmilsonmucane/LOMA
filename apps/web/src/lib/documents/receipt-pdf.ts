import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { formatMoney } from '@loma/loan-engine';
import { z } from 'zod';
import { receiptTemplateSchema } from '../domain/payments';
const snapshotSchema = z.object({
  brand: z.object({
    name: z.string(),
    footer: z.string().optional(),
    license: z.string().optional(),
  }),
  client: z.string(),
  contract: z.uuid(),
  template: receiptTemplateSchema,
});
export async function receiptPdf({
  payment,
  reversed,
  url,
  labels,
  date,
  method,
}: {
  payment: {
    id: string;
    amount: string;
    number: string;
    reference: string;
    snapshot: unknown;
    createdAt: string;
  };
  reversed: boolean;
  url: string;
  labels: Record<string, string>;
  date: string;
  method: string;
}) {
  const s = snapshotSchema.parse(payment.snapshot);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(
      join(
        process.cwd(),
        'node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff',
      ),
    ),
    { subset: true },
  );
  doc.setTitle(`${s.template.title} ${payment.number}`);
  doc.setAuthor(s.brand.name);
  doc.setCreationDate(new Date(payment.createdAt));
  doc.setModificationDate(new Date(payment.createdAt));
  const ink = rgb(21 / 255, 23 / 255, 26 / 255);
  let page = doc.addPage([595.28, 841.89]);
  let y = 790;
  function write(text: string, size = 11) {
    for (const paragraph of text.split(/\r?\n/)) {
      let row = '';
      for (const character of paragraph) {
        if (font.widthOfTextAtSize(row + character, size) > 495) {
          line(row, size);
          row = '';
        }
        row += character;
      }
      line(row, size);
    }
    y -= 8;
  }
  function line(text: string, size: number) {
    if (y < 65) {
      page = doc.addPage([595.28, 841.89]);
      y = 790;
    }
    page.drawText(text, { x: 50, y, size, font, color: ink });
    y -= size + 7;
  }
  write(s.brand.name, 20);
  write(s.template.title, 16);
  write(`${labels.receiptNumber}: ${payment.number}`);
  write(
    `${labels.receiptStatus}: ${labels[reversed ? 'reversed' : 'receiptValid']}`,
  );
  write(`${labels.client}: ${s.client}`);
  write(`${labels.contract}: ${s.contract}`, 10);
  write(`${labels.receivedOn}: ${date}`);
  write(`${labels.amount}: ${formatMoney(BigInt(payment.amount))}`, 20);
  write(`${labels.method}: ${method}`);
  write(`${labels.reference}: ${payment.reference}`);
  const values: Record<string, string> = {
    nome: s.client,
    valor: formatMoney(BigInt(payment.amount)),
    numero: payment.number,
    data: date,
    referencia: payment.reference,
    microcredito: s.brand.name,
    contrato: s.contract,
  };
  write(
    s.template.body.replace(
      /\{([^{}]+)\}/g,
      (match, key: string) => values[key] ?? match,
    ),
  );
  if (s.brand.license) write(s.brand.license, 10);
  if (s.brand.footer) write(s.brand.footer, 10);
  if (y < 190) {
    page = doc.addPage([595.28, 841.89]);
    y = 790;
  }
  const qr = await doc.embedPng(
    await QRCode.toBuffer(url, {
      type: 'png',
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
    }),
  );
  page.drawImage(qr, { x: 50, y: y - 100, width: 100, height: 100 });
  y -= 125;
  write(labels.qrHelp ?? '', 9);
  return doc.save({ useObjectStreams: false });
}
