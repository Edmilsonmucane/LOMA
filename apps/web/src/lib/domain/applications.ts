import { z } from 'zod';
import {
  simulateContract,
  formatMoney,
  formatPercent,
  type Terms,
} from '@loma/loan-engine';
import { termsSchema } from './products';
export const loanStates = [
  'active',
  'overdue',
  'settled',
  'renegotiated',
  'written_off',
] as const;
export const applicationStates = [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'declined',
  'disbursed',
  'cancelled',
] as const;
export const applicationSchema = z
  .object({
    client_id: z.uuid(),
    product_id: z.uuid(),
    product_version_id: z.uuid(),
    principal: z.string().regex(/^\d+$/),
    periods: z.number().int().min(1).max(10000),
    start_date: z.iso.date(),
    purpose: z.string().trim().min(2).max(2000),
    guarantees: z.array(z.string().min(1).max(300)).max(100),
  })
  .strict();
export const decisionSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    status: z.enum(applicationStates),
    note: z.string().trim().max(4000),
  })
  .superRefine((v, c) => {
    if (['approved', 'declined'].includes(v.status) && v.note.length < 2)
      c.addIssue({ code: 'custom', message: 'Reason required' });
  });
export const disbursementSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    method: z.enum(['cash', 'mpesa', 'emola', 'mkesh', 'transfer', 'deposit']),
    reference: z.string().trim().min(1).max(200),
    date: z.iso.date(),
    signed: z.iso.date(),
  })
  .strict();
export const templateVariables = [
  'microcredito',
  'nome',
  'contrato',
  'montante',
  'desembolso',
  'total',
  'juros',
  'encargos',
  'taxa_anual',
  'finalidade',
] as const;
export const templateSchema = z
  .object({
    title: z.string().trim().min(2).max(150),
    body: z.string().trim().min(2).max(20000),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const match of value.body.matchAll(/\{([^{}]+)\}/g))
      if (
        !templateVariables.includes(
          match[1] as (typeof templateVariables)[number],
        )
      )
        ctx.addIssue({ code: 'custom', message: 'Unknown variable' });
  });
export const contractSnapshotSchema = z.object({
  principal: z.string(),
  periods: z.number().int(),
  startDate: z.iso.date(),
  terms: termsSchema,
  productName: z.string(),
  productVersion: z.number(),
  client: z.object({
    name: z.string(),
    birthDate: z.string().nullable(),
    profile: z.record(z.string(), z.unknown()),
  }),
  brand: z.object({
    name: z.string(),
    legalName: z.string(),
    license: z.string(),
    contact: z.string(),
    footer: z.string(),
    currency: z.string(),
  }),
  template: templateSchema,
  purpose: z.string(),
  guarantees: z.array(z.string()),
});
export type ContractSnapshot = z.infer<typeof contractSnapshotSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;
export function contractQuote(snapshot: ContractSnapshot, version: number) {
  return simulateContract(version, {
    principal: BigInt(snapshot.principal),
    periods: snapshot.periods,
    startDate: snapshot.startDate,
    terms: snapshot.terms as Terms,
  });
}
export function contractText(
  snapshot: ContractSnapshot,
  id: string,
  version: number,
) {
  const q = contractQuote(snapshot, version);
  const values: Record<(typeof templateVariables)[number], string> = {
    microcredito: snapshot.brand.legalName || snapshot.brand.name,
    nome: snapshot.client.name,
    contrato: id,
    montante: formatMoney(q.requested),
    desembolso: formatMoney(q.disbursed),
    total: formatMoney(q.total),
    juros: formatMoney(q.interest),
    encargos: formatMoney(q.fees + q.taxes),
    taxa_anual: formatPercent(q.annualRate),
    finalidade: snapshot.purpose,
  };
  // One pass avoids treating customer text as another template variable.
  return snapshot.template.body.replace(
    /\{([^{}]+)\}/g,
    (_match, key: string) => values[key as keyof typeof values] ?? '',
  );
}
export function paymentCapacity(payment: bigint, income: bigint) {
  if (income <= 0n) return null;
  const scaled = (payment * 10000n + income / 2n) / income;
  return formatPercent(
    `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, '0')}`,
  );
}
