import { z } from 'zod';
import {
  methods,
  periodicities,
  validateTerms,
  simulate,
  type Terms,
} from '@loma/loan-engine';
const money = z.string().regex(/^\d+$/);
const rate = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const charge = z
  .object({
    key: z.string().min(1).max(100),
    kind: z.enum(['fixed', 'percentage']),
    value: rate,
    treatment: z.enum(['deducted', 'financed', 'separate']),
  })
  .strict();
export const termsSchema = z
  .object({
    method: z.enum(methods),
    periodicity: z.enum(periodicities),
    rate,
    minPrincipal: money,
    maxPrincipal: money,
    minPeriods: z.number().int(),
    maxPeriods: z.number().int(),
    grace: z.object({
      periods: z.number().int(),
      treatment: z.enum(['free', 'interest_only', 'capitalise']),
    }),
    fees: z.array(charge).max(50),
    taxes: z
      .array(
        charge.extend({
          from: z.iso.date(),
          until: z.iso.date().nullable(),
          basis: z.enum(['principal', 'interest', 'fees']),
        }),
      )
      .max(50),
    penalty: z.object({
      toleranceDays: z.number().int(),
      dailyRate: rate,
      fine: z.object({ kind: z.enum(['fixed', 'percentage']), value: rate }),
    }),
    calendar: z.object({
      holidays: z.array(z.iso.date()).max(1000),
      weekendDays: z.array(z.number().int()),
      adjustment: z.enum(['none', 'next_business_day']),
    }),
    allocation: z.array(
      z.enum(['fine', 'lateInterest', 'interest', 'principal']),
    ),
    excess: z.enum(['advance', 'credit']),
    settlement: z.enum([
      'contract_interest',
      'proportional_interest',
      'due_interest',
    ]),
    yearDays: z.number().int(),
    requirements: z.object({
      documents: z.array(z.string().min(1)),
      guarantees: z.array(z.string().min(1)),
      minAge: z.number().int().nullable(),
      minIncome: money.nullable(),
    }),
    approvalLevels: z
      .array(z.object({ upTo: money, role: z.string().min(1) }))
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      validateTerms(value as Terms);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid conditions' });
    }
  });
export const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  terms: termsSchema,
});
export type ProductEditor = z.infer<typeof productSchema>;
export function validateProduct(input: unknown) {
  const parsed = productSchema.parse(input);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Maputo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  for (const startDate of new Set([
    today,
    ...parsed.terms.taxes.map((tax) => tax.from),
  ]))
    simulate({
      principal: BigInt(parsed.terms.minPrincipal),
      periods: parsed.terms.maxPeriods,
      startDate,
      terms: parsed.terms,
    });
  return parsed;
}
