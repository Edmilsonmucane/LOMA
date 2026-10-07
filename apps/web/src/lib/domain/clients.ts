import { z } from 'zod';
import { parseMoney } from '@loma/loan-engine';
export const identityKinds = ['bi', 'nuit', 'passport', 'dire'] as const;
export function normalizePhone(value: string) {
  const digits = value.replace(/[\s()-]/g, '');
  return /^\d{9}$/.test(digits)
    ? `+258${digits}`
    : digits.startsWith('00258')
      ? `+${digits.slice(2)}`
      : digits;
}
export function identityKey(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
const phone = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));
const contact = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('phone'), value: phone }),
  z.object({ kind: z.literal('email'), value: z.email().max(150) }),
]);
const money = z
  .string()
  .regex(/^\d{1,19}$/)
  .refine((value) => {
    try {
      return BigInt(value) <= 9223372036854775807n;
    } catch {
      return false;
    }
  });
const person = z.object({
  name: z.string().trim().min(2).max(150),
  phone,
  relationship: z.string().trim().max(100),
});
export const clientSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    branch_id: z.uuid(),
    birth_date: z.union([z.iso.date(), z.literal('')]),
    classification: z.enum(['regular', 'vip', 'blacklisted']),
    profile: z.object({
      identities: z
        .array(
          z.object({
            kind: z.enum(identityKinds),
            value: z
              .string()
              .trim()
              .regex(/^[A-Za-z0-9][A-Za-z0-9 ./-]{1,99}$/),
          }),
        )
        .max(20),
      contacts: z.array(contact).min(1).max(20),
      province: z.string().trim().max(100),
      district: z.string().trim().max(100),
      neighbourhood: z.string().trim().max(100),
      address: z.string().trim().max(500),
      activity: z.string().trim().max(150),
      employer: z.string().trim().max(150),
      income: money,
      expenses: money,
      references: z.array(person).max(20),
      guarantors: z.array(person).max(20),
    }),
    consent: z.object({
      sms: z.boolean(),
      whatsapp: z.boolean(),
      email: z.boolean(),
      source: z.string().trim().max(500),
    }),
  })
  .superRefine((value, ctx) => {
    const keys = [
      ...value.profile.identities.map(
        (x) => `${x.kind}:${identityKey(x.value)}`,
      ),
      ...value.profile.contacts
        .filter((x) => x.kind === 'phone')
        .map((x) => `phone:${x.value}`),
    ];
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: 'custom',
        path: ['profile', 'identities'],
        message: 'duplicate',
      });
    if (
      Object.entries(value.consent).some(
        ([k, v]) => k !== 'source' && v === true,
      ) &&
      value.consent.source.length < 2
    )
      ctx.addIssue({
        code: 'custom',
        path: ['consent', 'source'],
        message: 'consent',
      });
    if (
      value.birth_date &&
      value.birth_date >
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(
          new Date(),
        )
    )
      ctx.addIssue({ code: 'custom', path: ['birth_date'], message: 'date' });
  });
export type ClientInput = z.infer<typeof clientSchema>;
export function emptyClient(branch: string): ClientInput {
  return {
    name: '',
    branch_id: branch,
    birth_date: '',
    classification: 'regular',
    profile: {
      identities: [],
      contacts: [{ kind: 'phone', value: '' }],
      province: '',
      district: '',
      neighbourhood: '',
      address: '',
      activity: '',
      employer: '',
      income: '0',
      expenses: '0',
      references: [],
      guarantors: [],
    },
    consent: { sms: false, whatsapp: false, email: false, source: '' },
  };
}
export const importFields = [
  'name',
  'phone',
  'email',
  'bi',
  'nuit',
  'passport',
  'dire',
  'birth_date',
  'province',
  'district',
  'neighbourhood',
  'address',
  'activity',
  'employer',
  'income',
  'expenses',
  'classification',
] as const;
export type ImportField = (typeof importFields)[number];
export type CsvData = {
  headers: string[];
  rows: { line: number; values: string[] }[];
};
export function parseCsv(text: string): CsvData {
  if (text.length > 2_000_000) throw new Error('size');
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] ?? '';
  let inQuotes = false,
    commas = 0,
    semicolons = 0;
  for (let i = 0; i < first.length; i++) {
    const c = first[i];
    if (c === '"') {
      if (inQuotes && first[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (c === ',') commas++;
      if (c === ';') semicolons++;
    }
  }
  const separator = semicolons > commas ? ';' : ',';
  const records: { line: number; values: string[] }[] = [];
  let values: string[] = [],
    cell = '',
    quoted = false,
    closed = false,
    line = 1,
    start = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === '\n') line++;
      }
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new Error('csv');
      quoted = true;
      continue;
    }
    if (c === separator) {
      values.push(cell);
      cell = '';
      closed = false;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      values.push(cell);
      if (values.some((v) => v.trim())) records.push({ line: start, values });
      values = [];
      cell = '';
      closed = false;
      line++;
      start = line;
      continue;
    }
    if (closed && !/\s/.test(c)) throw new Error('csv');
    if (!closed) cell += c;
  }
  if (quoted) throw new Error('csv');
  values.push(cell);
  if (values.some((v) => v.trim())) records.push({ line: start, values });
  if (records.length < 2 || records.length > 1001) throw new Error('rows');
  const headers = records.shift()!.values.map((x) => x.trim());
  if (
    new Set(headers).size !== headers.length ||
    headers.some((x) => !x) ||
    headers.length > 50
  )
    throw new Error('headers');
  if (records.some((x) => x.values.length !== headers.length))
    throw new Error('columns');
  return { headers, rows: records };
}
export function prepareImport(
  csv: CsvData,
  mapping: Partial<Record<ImportField, number>>,
  branch: string,
) {
  const columns = Object.values(mapping);
  if (
    mapping.name === undefined ||
    mapping.phone === undefined ||
    new Set(columns).size !== columns.length
  )
    throw new Error('mapping');
  const seen = new Set<string>();
  return csv.rows.map((row) => {
    const get = (key: ImportField) =>
      mapping[key] === undefined
        ? ''
        : (row.values[mapping[key]!] ?? '').trim();
    const value = emptyClient(branch);
    value.name = get('name');
    value.birth_date = get('birth_date');
    value.classification = (get('classification') ||
      'regular') as ClientInput['classification'];
    value.profile.contacts = [
      { kind: 'phone', value: get('phone') },
      ...(get('email')
        ? [{ kind: 'email' as const, value: get('email') }]
        : []),
    ];
    value.profile.identities = identityKinds
      .filter((k) => get(k))
      .map((kind) => ({ kind, value: get(kind) }));
    for (const key of [
      'province',
      'district',
      'neighbourhood',
      'address',
      'activity',
      'employer',
    ] as const)
      value.profile[key] = get(key);
    try {
      for (const key of ['income', 'expenses'] as const)
        value.profile[key] = parseMoney(get(key) || '0').toString();
    } catch {
      return { row: row.line, error: 'money', data: null };
    }
    const parsed = clientSchema.safeParse(value);
    if (parsed.success) {
      const keys = [
        ...parsed.data.profile.identities.map(
          (x) => `${x.kind}:${identityKey(x.value)}`,
        ),
        ...parsed.data.profile.contacts
          .filter((x) => x.kind === 'phone')
          .map((x) => `phone:${x.value}`),
      ];
      if (keys.some((k) => seen.has(k)))
        return { row: row.line, error: 'duplicate', data: null };
      keys.forEach((k) => seen.add(k));
    }
    return parsed.success
      ? { row: row.line, error: null, data: parsed.data }
      : {
          row: row.line,
          error: (() => {
            const path = parsed.error.issues[0]?.path.join('.') ?? '';
            return path === 'name'
              ? 'name'
              : path === 'birth_date'
                ? 'date'
                : path === 'classification'
                  ? 'classification'
                  : path.startsWith('profile.contacts')
                    ? 'contact'
                    : path.startsWith('profile.identities')
                      ? 'identity'
                      : path === 'profile.income' || path === 'profile.expenses'
                        ? 'money'
                        : 'invalid';
          })(),
          fields: parsed.error.issues.map((x) => x.path.join('.')),
          data: null,
        };
  });
}
export function fileType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x))
    return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-')
    return 'application/pdf';
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export function formatPhone(value: string) {
  return value.replace(/^\+258(\d{2})(\d{3})(\d{4})$/, '+258 $1 $2 $3');
}
export function clientSummary(client: {
  id: string;
  name: string;
  classification: string;
  profile: unknown;
}) {
  const profile = client.profile as ClientInput['profile'];
  return {
    id: client.id,
    name: client.name,
    classification: client.classification,
    profile: { contacts: profile.contacts, province: profile.province },
  };
}
export type ClientSummary = ReturnType<typeof clientSummary>;
