import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export async function reportPdf({
  brand,
  title,
  subtitle,
  matrix,
  notice,
}: {
  brand: string;
  title: string;
  subtitle: string;
  matrix: string[][];
  notice: string;
}) {
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
  doc.setTitle(title);
  doc.setAuthor(brand);
  const ink = rgb(21 / 255, 23 / 255, 26 / 255);
  let page = doc.addPage([841.89, 595.28]),
    y = 550;
  function line(text: string, size = 10) {
    if (y < 40) {
      page = doc.addPage([841.89, 595.28]);
      y = 550;
    }
    let row = '';
    for (const ch of text) {
      if (font.widthOfTextAtSize(row + ch, size) > 760) {
        page.drawText(row, { x: 40, y, size, font, color: ink });
        y -= size + 7;
        row = '';
        if (y < 40) {
          page = doc.addPage([841.89, 595.28]);
          y = 550;
        }
      }
      row += ch;
    }
    page.drawText(row, { x: 40, y, size, font, color: ink });
    y -= size + 7;
  }
  line(brand, 16);
  line(title, 20);
  line(subtitle);
  if (notice) line(notice);
  y -= 10;
  for (const [i, row] of matrix.entries()) {
    line(row.join('  ·  '), i === 0 ? 10 : 9);
    if (i === 0) y -= 6;
  }
  return doc.save();
}
