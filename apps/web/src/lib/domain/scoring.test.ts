// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scoringSchema, evaluateScore, evidenceSchema } from './scoring';
const defaults = JSON.parse(readFileSync('supabase/seed/scoring.json', 'utf8'));
it('validates all editable weights, classes, intervals and provision basis', () => {
  expect(scoringSchema.safeParse(defaults).success).toBe(true);
  for (const alter of [
    (v: typeof defaults) => {
      v.criteria[0].bands[1].until = '59';
    },
    (v: typeof defaults) => {
      v.classes[1].minScore = 99;
    },
    (v: typeof defaults) => {
      v.provisions[1].fromDays = 0;
    },
    (v: typeof defaults) => {
      v.criteria.forEach((c: { weight: number }) => (c.weight = 0));
    },
    (v: typeof defaults) => {
      v.provisions[0].percentage = '100.000000001';
    },
  ]) {
    const v = structuredClone(defaults);
    alter(v);
    expect(scoringSchema.safeParse(v).success).toBe(false);
  }
});
it('applies inclusive decimal intervals with exact weighted rounding and missing data', () => {
  const c = scoringSchema.parse(defaults);
  c.criteria.forEach((x) => (x.weight = x.key === 'punctuality' ? 1 : 0));
  expect(evaluateScore(c, { punctuality: '95.000000000000' }).score).toBe(
    '70.00',
  );
  expect(evaluateScore(c, { punctuality: '95.000000000001' }).class).toBe('A');
  expect(evaluateScore(c, {}).score).toBe('50.00');
  c.criteria[0]!.weight = 1;
  c.criteria[1]!.weight = 2;
  c.criteria[0]!.missingScore = 1;
  c.criteria[1]!.missingScore = 0;
  expect(evaluateScore(c, {}).score).toBe('0.33');
});
it('keeps large suggested monetary limits exact and rejects unverified invalid evidence', () => {
  const c = scoringSchema.parse(defaults);
  c.classes.forEach((x) => (x.suggestedLimit = '9007199254740993'));
  expect(evaluateScore(c, {}).suggestedLimit).toBe('9007199254740993');
  expect(
    evidenceSchema.safeParse({
      employmentMonths: 1.5,
      verifiedReferences: null,
      note: 'Fonte',
    }).success,
  ).toBe(false);
  expect(
    evidenceSchema.safeParse({
      employmentMonths: null,
      verifiedReferences: null,
      note: 'Por verificar',
    }).success,
  ).toBe(true);
});
