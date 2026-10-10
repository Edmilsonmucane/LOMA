import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  clientSchema,
  emptyClient,
  normalizePhone,
  formatPhone,
  identityKey,
  parseCsv,
  prepareImport,
  fileType,
} from './clients';
const branch = randomUUID();
describe('clients and CSV', () => {
  it('normalises phones and prevents duplicate identities within one profile', () => {
    expect(normalizePhone('84 123 4567')).toBe('+258841234567');
    expect(formatPhone('+258841234567')).toBe('+258 84 123 4567');
    expect(normalizePhone('00258 84 123 4567')).toBe('+258841234567');
    expect(identityKey('AB-12 /3')).toBe('AB123');
    const c = emptyClient(branch);
    c.name = 'Amélia Cossa';
    c.profile.contacts[0]!.value = '84 123 4567';
    expect(clientSchema.parse(c).profile.contacts[0]!.value).toBe(
      '+258841234567',
    );
    c.profile.identities = [
      { kind: 'bi', value: 'AB-123' },
      { kind: 'bi', value: 'AB123' },
    ];
    expect(clientSchema.safeParse(c).success).toBe(false);
  });
  it('requires consent evidence and exact nonnegative money', () => {
    const c = emptyClient(branch);
    c.name = 'Amélia Cossa';
    c.profile.contacts[0]!.value = '841234567';
    c.consent.sms = true;
    expect(clientSchema.safeParse(c).success).toBe(false);
    c.consent.source = 'Autorizou presencialmente em 7 out 2026';
    expect(clientSchema.safeParse(c).success).toBe(true);
    c.profile.income = '-1';
    expect(clientSchema.safeParse(c).success).toBe(false);
    c.profile.income = '9223372036854775808';
    expect(clientSchema.safeParse(c).success).toBe(false);
    c.profile.income = '10000000000000001';
    expect(clientSchema.parse(c).profile.income).toBe('10000000000000001');
    c.birth_date = '2099-01-01';
    expect(clientSchema.safeParse(c).success).toBe(false);
  });
  it('parses BOM, semicolon, CRLF, quoted separators, escapes and multiline cells with physical row numbers', () => {
    const data = parseCsv(
      '\uFEFFnome;telefone;morada\r\n"Amélia; Cossa";841234567;"Rua ""A""\nMatola"\r\nTomás Sitoe;841234568;Malhangalene\r\n',
    );
    expect(data.headers).toEqual(['nome', 'telefone', 'morada']);
    expect(data.rows[0]).toEqual({
      line: 2,
      values: ['Amélia; Cossa', '841234567', 'Rua "A"\nMatola'],
    });
    expect(data.rows[1]!.line).toBe(4);
    expect(parseCsv('name,phone\nAmélia,841234567').rows).toHaveLength(1);
    expect(parseCsv('"name;full",phone\nAmélia,841234567').headers).toEqual([
      'name;full',
      'phone',
    ]);
  });
  it.each([
    'name,phone\n"unterminated,123',
    'name,phone\n"x"oops,123',
    'name,phone\nx"oops,123',
    'name,name\nx,123',
    'name,phone\nx,123,extra',
    'name,phone',
    'name,\nx,123',
  ])('rejects malformed CSV %s', (csv) =>
    expect(() => parseCsv(csv)).toThrow(),
  );
  it('maps 500 records, validates money and keeps consent disabled', () => {
    const text = [
      'nome;telefone;rendimento',
      ...Array.from(
        { length: 500 },
        (_, i) => `Amélia Cossa;84${String(1000000 + i)};15000,05`,
      ),
    ].join('\n');
    const data = parseCsv(text);
    const rows = prepareImport(data, { name: 0, phone: 1, income: 2 }, branch);
    expect(rows).toHaveLength(500);
    expect(rows.every((x) => x.error === null)).toBe(true);
    expect(rows[499]!.data?.profile.income).toBe('1500005');
    expect(rows[0]!.data?.consent.sms).toBe(false);
  });
  it('reports invalid money, contacts and duplicates by original line', () => {
    const data = parseCsv(
      'nome;telefone;rendimento\nAmélia Cossa;841234567;15000\nTomás Sitoe;841234567;15000\nJosé Mucavele;123;15000\nGraça Chissano;841234569;abc',
    );
    const rows = prepareImport(data, { name: 0, phone: 1, income: 2 }, branch);
    expect(rows.map((x) => x.error)).toEqual([
      null,
      'duplicate',
      'contact',
      'money',
    ]);
    expect(rows.map((x) => x.row)).toEqual([2, 3, 4, 5]);
    expect(() => prepareImport(data, { name: 0, phone: 0 }, branch)).toThrow(
      'mapping',
    );
    expect(() => prepareImport(data, { name: 0 }, branch)).toThrow('mapping');
  });
  it('limits CSV size/rows and allows only supported file signatures', () => {
    expect(() => parseCsv('a'.repeat(2000001))).toThrow('size');
    expect(() =>
      parseCsv(
        'name,phone\n' +
          Array.from({ length: 1001 }, () => `Amélia,841234567`).join('\n'),
      ),
    ).toThrow('rows');
    expect(fileType(new TextEncoder().encode('<svg></svg>'))).toBeNull();
    expect(fileType(new TextEncoder().encode('%PDF-1.7'))).toBe(
      'application/pdf',
    );
    expect(fileType(new Uint8Array([255, 216, 255]))).toBe('image/jpeg');
    expect(fileType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      'image/png',
    );
    expect(fileType(new TextEncoder().encode('RIFF0000WEBP'))).toBe(
      'image/webp',
    );
  });
});
