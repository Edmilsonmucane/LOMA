import { z } from 'zod';
export const paymentMethods = [
  'cash',
  'mpesa',
  'emola',
  'mkesh',
  'transfer',
  'deposit',
] as const;
export const centsSchema = z
  .string()
  .regex(/^\d+$/)
  .refine(
    (v) =>
      /^\d+$/.test(v) && BigInt(v) > 0n && BigInt(v) <= 9223372036854775807n,
  );
export const paymentSchema = z
  .object({
    loan: z.uuid(),
    amount: centsSchema,
    method: z.enum(paymentMethods),
    reference: z.string().trim().min(1).max(200),
    requestId: z.uuid(),
    revision: z.number().int().positive(),
    day: z.iso.date(),
  })
  .strict();
export const receiptVariables = [
  'nome',
  'valor',
  'numero',
  'data',
  'referencia',
  'microcredito',
  'contrato',
] as const;
export const receiptTemplateSchema = z
  .object({
    title: z.string().trim().min(2).max(150),
    body: z.string().trim().min(2).max(20000),
  })
  .strict()
  .refine((v) =>
    [...v.body.matchAll(/\{([^{}]+)\}/g)].every((m) =>
      receiptVariables.includes(m[1] as (typeof receiptVariables)[number]),
    ),
  );
export const allocationSchema = z.object({
  number: z.number().int().nonnegative(),
  component: z.enum(['fine', 'lateInterest', 'interest', 'principal']),
  amount: z.string().regex(/^\d+$/),
});
export const previewSchema = z.object({
  revision: z.number().int(),
  day: z.iso.date(),
  credit: z.string(),
  allocations: z.array(allocationSchema),
});
export type PaymentPreview = z.infer<typeof previewSchema>;
export const balanceSchema = z.object({
  status: z.string(),
  revision: z.number().int(),
  credit: z.string(),
  total: z.string(),
  rows: z.array(
    z.object({
      number: z.number().int(),
      dueDate: z.iso.date(),
      principal: z.string(),
      interest: z.string(),
      fine: z.string(),
      lateInterest: z.string(),
      total: z.string(),
    }),
  ),
  payments: z.array(
    z.object({
      id: z.uuid(),
      amount: z.string(),
      number: z.string(),
      method: z.string(),
      reference: z.string(),
      date: z.iso.date(),
      reversed: z.boolean(),
    }),
  ),
});
export type LoanBalance = z.infer<typeof balanceSchema>;
export const cashSchema = z.object({
  id: z.uuid(),
  day: z.iso.date(),
  opening: z.string(),
  expected: z.string(),
  counted: z.string().nullable(),
  closed: z.boolean(),
  reason: z.string(),
  movements: z.array(
    z.object({
      id: z.uuid(),
      source: z.string(),
      reference: z.string(),
      amount: z.string(),
      method: z.string(),
      time: z.string(),
    }),
  ),
});
export type CashSummary = z.infer<typeof cashSchema>;
export const todaySchema = z.object({
  due: z.string().nullable(),
  overdue: z.string().nullable(),
  pending: z.number().nullable(),
  disbursed: z.string().nullable(),
  attention: z.array(
    z.object({
      id: z.uuid(),
      client_id: z.uuid(),
      name: z.string(),
      due_date: z.iso.date(),
      phone: z.string().nullable(),
      amount: z.string(),
    }),
  ),
});
