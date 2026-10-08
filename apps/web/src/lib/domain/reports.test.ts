// @vitest-environment node
import { expect, it } from 'vitest';
import { reportCsv, reportFilterSchema, reportMatrix } from './reports';
it('neutralises spreadsheet formulas, quotes newlines and preserves exact monetary text', () => {
  const csv = reportCsv([
    ['Nome', 'Valor'],
    ['=HYPERLINK("x")', '90 071 992 547 409,93 MT'],
    ['  @SUM(1)', 'Linha\nseguinte'],
  ]);
  expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  expect(csv).toContain('"\'  @SUM(1)"');
  expect(csv).toContain('90 071 992 547 409,93 MT');
  expect(csv.startsWith('\ufeff')).toBe(true);
});
it('rejects inverted dates, statement without client and meaningless cash filters', () => {
  const base = { kind: 'arrears', from: '2026-01-01', to: '2026-12-31' };
  expect(reportFilterSchema.safeParse(base).success).toBe(true);
  for (const f of [
    { ...base, to: '2025-12-31' },
    { ...base, kind: 'statement' },
    { ...base, kind: 'cash', product: '00000000-0000-4000-8000-000000000001' },
    { ...base, branch: 'unsafe' },
  ])
    expect(reportFilterSchema.safeParse(f).success).toBe(false);
});
it('exports the same exact formatted money, states and dates as the report table', () => {
  expect(
    reportMatrix(
      {
        kind: 'movements',
        asOf: '2026-10-08',
        from: '2026-01-01',
        to: '2026-10-08',
        count: 1,
        truncated: false,
        total: '1000001',
        summary: { payment: '1000001', disbursement: '0', reversal: '0' },
        provisionBasis: 'principal',
        rows: [
          {
            date: '2026-10-07',
            source: 'payment',
            count: '1',
            amount: '1000001',
          },
        ],
      },
      {
        date: 'Data',
        source: 'Movimento',
        count: 'Movimentos',
        amount: 'Valor',
        payment: 'Recebimento',
      },
      [
        'jan',
        'fev',
        'mar',
        'abr',
        'mai',
        'jun',
        'jul',
        'ago',
        'set',
        'out',
        'nov',
        'dez',
      ],
    )[1],
  ).toEqual(['7 out 2026', 'Recebimento', '1', '10 000,01 MT']);
});
