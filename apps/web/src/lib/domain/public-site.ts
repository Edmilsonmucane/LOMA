import { z } from 'zod';
import { normalizePhone } from './clients';
export const siteSections = [
  'simulator',
  'products',
  'steps',
  'faq',
  'branches',
] as const;
export const siteSchema = z
  .object({
    enabled: z.boolean(),
    theme: z.enum(['classic', 'modern']),
    title: z.string().trim().min(2).max(150),
    intro: z.string().trim().min(2).max(1000),
    image: z.union([
      z.literal(''),
      z.url().refine((v) => v.startsWith('https://')),
    ]),
    sections: z
      .array(z.enum(siteSections))
      .length(5)
      .refine((v) => new Set(v).size === 5),
    steps: z.array(z.string().trim().min(2).max(500)).min(1).max(8),
    faq: z
      .array(
        z.object({
          question: z.string().min(2).max(300),
          answer: z.string().min(2).max(2000),
        }),
      )
      .max(20),
    terms: z.string().min(2).max(10000),
    privacy: z.string().min(2).max(10000),
    limits: z.object({
      otpPerHour: z.number().int().min(1).max(100),
      requestsPerDay: z.number().int().min(1).max(100),
      leadsPerDay: z.number().int().min(1).max(100),
      sessionHours: z.number().int().min(1).max(100),
    }),
  })
  .strict();
export const publicPhone = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+258\d{9}$/));
export const publicDraftSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    birth_date: z.union([z.iso.date(), z.literal('')]),
    branch_id: z.uuid(),
    product_version_id: z.uuid(),
    principal: z.string().regex(/^\d{1,19}$/),
    periods: z.number().int().positive().max(10000),
    purpose: z.string().trim().min(2).max(2000),
    guarantees: z.array(z.string().min(1).max(300)).max(100),
    profile: z.object({
      identities: z
        .array(
          z.object({
            kind: z.enum(['bi', 'nuit', 'passport', 'dire']),
            value: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ./-]{1,99}$/),
          }),
        )
        .max(20),
      contacts: z
        .array(z.object({ kind: z.literal('phone'), value: publicPhone }))
        .min(1)
        .max(1),
      province: z.string().max(100),
      district: z.string().max(100),
      neighbourhood: z.string().max(100),
      address: z.string().max(500),
      activity: z.string().max(150),
      employer: z.string().max(150),
      income: z.string().regex(/^\d{1,19}$/),
      expenses: z.string().regex(/^\d{1,19}$/),
      references: z
        .array(
          z.object({
            name: z.string(),
            phone: publicPhone,
            relationship: z.string(),
          }),
        )
        .max(20),
      guarantors: z
        .array(
          z.object({
            name: z.string(),
            phone: publicPhone,
            relationship: z.string(),
          }),
        )
        .max(20),
    }),
  })
  .strict();
export type SiteSettings = z.infer<typeof siteSchema>;
