import { z } from 'zod';
import { formatMoney } from '@loma/loan-engine';
import { formatDate } from './dates';
export const reportKinds = [
  'arrears',
  'movements',
  'forecast',
  'portfolio',
  'statement',
  'cash',
] as const;
const optionalId = z.uuid().or(z.literal('')).default('');
export const reportFilterSchema = z
  .object({
    kind: z.enum(reportKinds).default('arrears'),
    from: z.iso.date(),
    to: z.iso.date(),
    branch: optionalId,
    product: optionalId,
    agent: optionalId,
    client: optionalId,
  })
  .refine(
    (v) =>
      v.from <= v.to &&
      new Date(v.to).getTime() - new Date(v.from).getTime() <= 3660 * 86400000,
  )
  .refine((v) => v.kind !== 'statement' || v.client !== '')
  .refine((v) => v.kind !== 'cash' || (!v.product && !v.agent && !v.client));
export type ReportFilter = z.infer<typeof reportFilterSchema>;
export const reportSchema = z.object({
  kind: z.enum(reportKinds),
  asOf: z.iso.date(),
  from: z.iso.date(),
  to: z.iso.date(),
  rows: z.array(z.record(z.string(), z.string())),
  count: z.number().int(),
  truncated: z.boolean(),
  summary: z.record(z.string(), z.string()),
  total: z.string().regex(/^-?\d+$/),
  provisionBasis: z.enum(['principal', 'balance']),
});
export type Report = z.infer<typeof reportSchema>;
export const reportColumns: Record<Report['kind'], string[]> = {
  arrears: ['bucket', 'count', 'principal', 'balance', 'provision'],
  movements: ['date', 'source', 'count', 'amount'],
  forecast: ['date', 'client', 'product', 'branch', 'amount'],
  portfolio: [
    'product',
    'branch',
    'agent',
    'count',
    'principal',
    'balance',
    'provision',
  ],
  statement: ['date', 'source', 'product', 'reference', 'amount'],
  cash: [
    'date',
    'branch',
    'state',
    'opening',
    'expected',
    'counted',
    'difference',
    'reason',
  ],
};
export const reportSummaryColumns: Record<Report['kind'], string[]> = {
  arrears: ['principal', 'balance', 'provision'],
  portfolio: ['principal', 'balance', 'provision'],
  movements: ['disbursement', 'payment', 'reversal'],
  statement: ['disbursement', 'payment', 'reversal'],
  forecast: ['amount'],
  cash: [],
};
const moneyColumns = new Set([
  'principal',
  'balance',
  'provision',
  'amount',
  'opening',
  'expected',
  'counted',
  'difference',
]);
export function reportCell(
  key: string,
  value: string,
  labels: Record<string, string>,
  months: string[],
) {
  if (!value) return '—';
  if (moneyColumns.has(key)) return formatMoney(BigInt(value));
  if (key === 'date') return formatDate(value, months);
  if (key === 'source' || key === 'state') return labels[value] ?? value;
  return value;
}
export function reportMatrix(
  report: Report,
  labels: Record<string, string>,
  months: string[],
) {
  const columns = reportColumns[report.kind];
  return [
    columns.map((c) => labels[c] ?? c),
    ...report.rows.map((row) =>
      columns.map((c) => reportCell(c, row[c] ?? '', labels, months)),
    ),
    ...(reportSummaryColumns[report.kind].length
      ? [
          [],
          ...reportSummaryColumns[report.kind].map((key) => [
            labels[key] ?? key,
            formatMoney(BigInt(report.summary[key] ?? '0')),
          ]),
        ]
      : []),
  ];
}
// Quote every cell, neutralise spreadsheet formulas, preserve UTF-8 names and exact money.
export function reportCsv(matrix: string[][]) {
  return (
    '\ufeff' +
    matrix
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              (/^[\s]*[=+@-]/.test(v) ? "'" + v : v).replaceAll('"', '""') +
              '"',
          )
          .join(';'),
      )
      .join('\r\n') +
    '\r\n'
  );
}
