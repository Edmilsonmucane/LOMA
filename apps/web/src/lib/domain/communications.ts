import { z } from 'zod';
import { normalizePhone } from './clients';
export const channels = ['sms', 'whatsapp', 'email'] as const;
export const messageVariables = [
  'nome',
  'valor',
  'data',
  'numero',
  'microcredito',
] as const;
export const templateSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    body: z
      .string()
      .trim()
      .min(2)
      .max(4000)
      .refine((s) =>
        [...s.matchAll(/\{([^}]+)\}/g)].every((m) =>
          messageVariables.includes(m[1] as (typeof messageVariables)[number]),
        ),
      ),
    channel: z.enum(channels),
    active: z.boolean(),
    whatsappName: z.string().regex(/^[a-z0-9_]*$/),
    whatsappVariables: z.array(z.enum(messageVariables)).max(10).default([]),
    whatsappLanguage: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/),
  })
  .strict();
export const rulesSchema = z
  .object({
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    maxPerDay: z.number().int().min(1).max(100),
    maxAttempts: z.number().int().min(1).max(10),
    retrySeconds: z.number().int().min(1).max(86400),
    optOutText: z.string().trim().min(2).max(300),
    buckets: z.array(z.number().int().min(1).max(9999)).min(1).max(10),
  })
  .strict()
  .refine(
    (x) =>
      x.startHour < x.endHour &&
      x.buckets.every((n, i) => i === 0 || n > x.buckets[i - 1]!),
  );
export const automationSchema = z
  .object({
    enabled: z.boolean(),
    event: z.enum([
      'due',
      'submitted',
      'approved',
      'declined',
      'disbursed',
      'payment',
    ]),
    offsetDays: z.number().int().min(-365).max(365),
    template: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
    channel: z.enum(channels),
    activatedAt: z.string().optional(),
  })
  .strict();
export const segmentSchema = z
  .object({
    province: z.string().max(100),
    risk: z.enum(['', 'A', 'B', 'C', 'D', 'E']),
    noActive: z.boolean(),
    birthday: z.boolean(),
    product: z.union([z.literal(''), z.uuid()]),
    settledMonths: z
      .string()
      .regex(/^(|\d{1,3})$/)
      .refine((s) => s === '' || Number(s) <= 120),
  })
  .strict();
export const campaignSchema = z
  .object({
    branch: z.uuid(),
    name: z.string().trim().min(2).max(150),
    channel: z.enum(channels),
    template: z.string().max(40),
    segment: segmentSchema,
    scheduled: z.iso.datetime({ offset: true }),
    requestId: z.uuid(),
  })
  .strict();
export const integrationSchema = z
  .object({
    provider: z.enum(['console', 'http', 'whatsapp']),
    cost: z.string().regex(/^\d{1,18}$/),
    url: z.string().max(1000),
    token: z.string().max(4000),
    phoneId: z.string().max(100),
    graphVersion: z.string().max(30),
    webhookSecret: z
      .string()
      .max(200)
      .refine((x) => !x || x.length >= 16),
    verifyToken: z
      .string()
      .max(200)
      .refine((x) => !x || x.length >= 16),
  })
  .strict()
  .superRefine((x, ctx) => {
    if (x.provider === 'http') {
      try {
        const u = new URL(x.url);
        if (
          u.protocol !== 'https:' ||
          u.username ||
          u.password ||
          (u.port && u.port !== '443')
        )
          throw new Error();
      } catch {
        ctx.addIssue({ code: 'custom', path: ['url'], message: 'endpoint' });
      }
    }
    if (x.provider !== 'console' && !x.token)
      ctx.addIssue({ code: 'custom', path: ['token'], message: 'required' });
    if (
      x.provider === 'whatsapp' &&
      (!/^\d+$/.test(x.phoneId) || !/^v\d+\.\d+$/.test(x.graphVersion))
    )
      ctx.addIssue({ code: 'custom', path: ['phoneId'], message: 'invalid' });
  });
export const leadSchema = z
  .object({
    branch: z.uuid(),
    name: z.string().trim().min(2).max(150),
    phone: z
      .string()
      .transform(normalizePhone)
      .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/)),
    origin: z.string().trim().min(2).max(150),
    status: z.enum(['new', 'contacted', 'simulated', 'submitted', 'approved']),
    client: z.union([z.literal(''), z.uuid()]),
    consent: z.object({
      sms: z.boolean(),
      whatsapp: z.boolean(),
      email: z.boolean(),
      source: z.string().trim().max(500),
    }),
  })
  .strict()
  .refine(
    (x) =>
      (!x.consent.sms && !x.consent.whatsapp && !x.consent.email) ||
      x.consent.source.length >= 2,
  );
export const collectionRowSchema = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  name: z.string(),
  branch_id: z.uuid(),
  phone: z.string().nullable(),
  days: z.number(),
  amount: z.string().regex(/^\d+$/),
  assigned_to: z.uuid().nullable(),
  target: z.string(),
  activities: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(['contact', 'promise', 'visit', 'completed']),
      note: z.string(),
      due: z.string().nullable(),
      amount: z.string().nullable(),
      at: z.string(),
    }),
  ),
});
export type CollectionRow = z.infer<typeof collectionRowSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Lead = z.infer<typeof leadSchema>;
export const emptySegment: Segment = {
  province: '',
  risk: '',
  noActive: false,
  birthday: false,
  product: '',
  settledMonths: '',
};
