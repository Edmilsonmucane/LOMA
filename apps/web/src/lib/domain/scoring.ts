import { z } from 'zod';
export const scoreCriteria = [
  'punctuality',
  'averageDelay',
  'previousLoans',
  'tenureDays',
  'paymentRatio',
  'employmentMonths',
  'verifiedReferences',
] as const;
const decimal = z.string().regex(/^\d+(?:\.\d{1,12})?$/);
const money = z
  .string()
  .regex(/^\d{1,19}$/)
  .refine((x) => BigInt(x) <= 9223372036854775807n);
function ratio(s: string): [bigint, bigint] {
  const [whole, fraction = ''] = s.split('.');
  return [BigInt(whole! + fraction), 10n ** BigInt(fraction.length)];
}
function compare(a: string, b: string) {
  const [an, ad] = ratio(a),
    [bn, bd] = ratio(b);
  return an * bd - bn * ad;
}
export const scoringSchema = z
  .object({
    provisionBasis: z.enum(['principal', 'balance']),
    criteria: z
      .array(
        z
          .object({
            key: z.enum(scoreCriteria),
            weight: z.number().int().min(0).max(100),
            missingScore: z.number().int().min(0).max(100),
            bands: z
              .array(
                z
                  .object({
                    until: decimal.nullable(),
                    score: z.number().int().min(0).max(100),
                  })
                  .strict(),
              )
              .min(1)
              .max(12),
          })
          .strict(),
      )
      .length(7),
    classes: z
      .array(
        z
          .object({
            key: z.enum(['A', 'B', 'C', 'D', 'E']),
            minScore: z.number().int().min(0).max(100),
            suggestedLimit: money,
          })
          .strict(),
      )
      .length(5),
    provisions: z
      .array(
        z
          .object({
            name: z.string().trim().min(2).max(80),
            fromDays: z.number().int().min(0).max(36500),
            percentage: decimal.refine((x) => compare(x, '100') <= 0n),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((v, ctx) => {
    const valid =
      new Set(v.criteria.map((x) => x.key)).size === 7 &&
      v.criteria.some((x) => x.weight > 0) &&
      v.criteria.every(
        (x) =>
          x.bands.at(-1)?.until === null &&
          x.bands
            .slice(0, -1)
            .every(
              (b, i) =>
                b.until !== null &&
                (i === 0 || compare(b.until, x.bands[i - 1]!.until!) > 0n),
            ),
      ) &&
      v.classes.map((x) => x.key).join('') === 'ABCDE' &&
      v.classes.at(-1)?.minScore === 0 &&
      v.classes.every(
        (x, i) => i === 0 || x.minScore < v.classes[i - 1]!.minScore,
      ) &&
      v.provisions[0]?.fromDays === 0 &&
      v.provisions.every(
        (x, i) => i === 0 || x.fromDays > v.provisions[i - 1]!.fromDays,
      );
    if (!valid)
      ctx.addIssue({ code: 'custom', message: 'Invalid scoring intervals' });
  });
export type ScoringConfig = z.infer<typeof scoringSchema>;
export function evaluateScore(
  config: ScoringConfig,
  metrics: Record<string, string | null>,
) {
  scoringSchema.parse(config);
  let sum = 0n,
    weights = 0n;
  const details = config.criteria.map((c) => {
    const metric = metrics[c.key] ?? null;
    const points =
      metric === null
        ? c.missingScore
        : (c.bands.find(
            (b) => b.until === null || compare(metric, b.until) <= 0n,
          )?.score ?? c.missingScore);
    sum += BigInt(points * c.weight);
    weights += BigInt(c.weight);
    return {
      key: c.key,
      metric,
      points,
      weight: c.weight,
      missing: metric === null,
    };
  });
  const scaled = (sum * 100n + weights / 2n) / weights;
  const grade = config.classes.find(
    (g) => scaled >= BigInt(g.minScore) * 100n,
  )!;
  return {
    score: `${scaled / 100n}.${String(scaled % 100n).padStart(2, '0')}`,
    class: grade.key,
    suggestedLimit: grade.suggestedLimit,
    details,
  };
}
export const evidenceSchema = z
  .object({
    employmentMonths: z.number().int().min(0).max(1200).nullable(),
    verifiedReferences: z.number().int().min(0).max(100).nullable(),
    note: z.string().trim().min(2).max(1000),
  })
  .strict();
export const scoreResultSchema = z.object({
  score: z.string(),
  class: z.enum(['A', 'B', 'C', 'D', 'E']),
  suggestedLimit: money,
  metrics: z.record(z.string(), z.string().nullable()),
  details: z.array(
    z.object({
      key: z.enum(scoreCriteria),
      metric: z.string().nullable(),
      points: z.number(),
      weight: z.number(),
      missing: z.boolean(),
    }),
  ),
  config: scoringSchema,
  evidence: evidenceSchema
    .omit({ note: true })
    .extend({ note: z.string() })
    .nullable(),
});
