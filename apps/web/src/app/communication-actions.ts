'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTenantContext, requirePermission } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import {
  templateSchema,
  rulesSchema,
  automationSchema,
  campaignSchema,
  segmentSchema,
  integrationSchema,
  leadSchema,
  channels,
} from '@/lib/domain/communications';
import type { Json } from '@/lib/supabase/database.types';
function failure(error: { code: string } | null) {
  return {
    ok: false as const,
    error:
      error?.code === 'PT422'
        ? 'missingContext'
        : error?.code === 'PT409'
          ? 'stale'
          : error?.code === '42501'
            ? 'denied'
            : error?.code === '23505'
              ? 'duplicate'
              : 'invalid',
  };
}
function refresh() {
  for (const path of [
    '/app/messages',
    '/app/collections',
    '/app',
    '/app/clients',
  ])
    revalidatePath(path, 'layout');
}
export async function saveCommunicationConfig(input: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const p = z
    .object({
      category: z.enum(['communication', 'message_template', 'automation']),
      key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
      settings: z.unknown(),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const schema =
    p.data.category === 'communication'
      ? rulesSchema
      : p.data.category === 'automation'
        ? automationSchema
        : templateSchema;
  const s = schema.safeParse(p.data.settings);
  if (!s.success) return failure(null);
  const { error } = await db.rpc('save_communication_configuration', {
    t: tenant.id,
    category_name: p.data.category,
    key_name: p.data.key,
    settings: s.data as Json,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true as const };
}
export async function queueMessage(input: unknown) {
  const ctx = await getTenantContext();
  if (
    !can(ctx.permissions, 'messages.manage') &&
    !can(ctx.permissions, 'collections.manage')
  )
    return failure({ code: '42501' });
  const p = z
    .object({
      client: z.uuid(),
      channel: z.enum(channels),
      template: z.string().max(40),
      requestId: z.uuid(),
      loan: z.uuid().optional(),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const { data, error } = await ctx.db.rpc('queue_message', {
    t: ctx.tenant.id,
    c: p.data.client,
    ch: p.data.channel,
    template: p.data.template,
    request_id: p.data.requestId,
    ...(p.data.loan ? { loan: p.data.loan } : {}),
  });
  if (error) return failure(error);
  if (!data) return { ok: false as const, error: 'consent' };
  refresh();
  return { ok: true as const, id: data };
}
export async function previewCampaign(input: unknown) {
  const { db, tenant } = await requirePermission('messages.manage');
  const p = z
    .object({
      branch: z.uuid(),
      channel: z.enum(channels),
      template: z.string().max(40),
      segment: segmentSchema,
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const { data, error } = await db.rpc('preview_campaign', {
    t: tenant.id,
    b: p.data.branch,
    ch: p.data.channel,
    template: p.data.template,
    segment: p.data.segment,
  });
  if (error) return failure(error);
  const s = z
    .object({
      count: z.number(),
      body: z.string(),
      sample: z.record(z.string(), z.string()).nullable(),
      active: z.boolean(),
    })
    .safeParse(data);
  if (!s.success) return failure(null);
  return { ok: true as const, preview: s.data };
}
export async function createCampaign(input: unknown) {
  const { db, tenant } = await requirePermission('messages.manage');
  const p = campaignSchema.safeParse(input);
  if (!p.success) return failure(null);
  const x = p.data;
  const { data, error } = await db.rpc('create_campaign', {
    t: tenant.id,
    b: x.branch,
    name: x.name,
    ch: x.channel,
    template: x.template,
    segment: x.segment,
    scheduled: x.scheduled,
    request_id: x.requestId,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true as const, id: data };
}
export async function cancelCampaign(id: string) {
  const { db, tenant } = await requirePermission('messages.manage');
  if (!z.uuid().safeParse(id).success) return failure(null);
  const { error } = await db.rpc('cancel_campaign', { t: tenant.id, c: id });
  if (error) return failure(error);
  refresh();
  return { ok: true as const };
}
export async function recordCollection(input: unknown) {
  const { db, tenant } = await requirePermission('collections.manage');
  const p = z
    .object({
      loan: z.uuid(),
      kind: z.enum(['contact', 'promise', 'visit', 'completed']),
      note: z.string().trim().min(2).max(2000),
      due: z.union([z.literal(''), z.iso.date()]),
      amount: z.string().regex(/^(|\d{1,18})$/),
      requestId: z.uuid(),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const x = p.data;
  const { error } = await db.rpc('record_collection', {
    t: tenant.id,
    l: x.loan,
    kind: x.kind,
    note: x.note,
    request_id: x.requestId,
    ...(x.due ? { due: x.due } : {}),
    ...(x.amount ? { amount: x.amount } : {}),
  });
  if (error) return failure(error);
  refresh();
  return { ok: true as const };
}
export async function assignCollection(input: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const p = z
    .object({
      loan: z.uuid(),
      user: z.uuid(),
      target: z.string().regex(/^\d{1,18}$/),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const { error } = await db.rpc('assign_collection', {
    t: tenant.id,
    l: p.data.loan,
    u: p.data.user,
    target: p.data.target,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true as const };
}
export async function saveLead(input: unknown, id?: string, revision = 0) {
  const { db, tenant } = await requirePermission('messages.manage');
  const p = leadSchema.safeParse(input);
  if (!p.success || (id && !z.uuid().safeParse(id).success))
    return failure(null);
  const { error } = await db.rpc('save_lead', {
    t: tenant.id,
    data: p.data,
    ...(id ? { selected: id, expected_revision: revision } : {}),
  });
  if (error) return failure(error);
  refresh();
  return { ok: true as const };
}
export async function saveIntegration(input: unknown) {
  const { db, tenant } = await requirePermission('tenant.manage');
  const p = z
    .object({ channel: z.enum(channels), settings: integrationSchema })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const { error } = await db.rpc('save_integration', {
    t: tenant.id,
    ch: p.data.channel,
    settings: p.data.settings,
  });
  if (error) return failure(error);
  revalidatePath('/app/settings/integrations');
  return { ok: true as const };
}
export async function setCommunicationConsent(input: unknown) {
  const { db, tenant } = await requirePermission('clients.manage');
  const p = z
    .object({
      client: z.uuid(),
      channel: z.enum(channels),
      enabled: z.boolean(),
      source: z.string().trim().min(2).max(500),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const { error } = await db.rpc('set_communication_consent', {
    t: tenant.id,
    c: p.data.client,
    ch: p.data.channel,
    enabled: p.data.enabled,
    source: p.data.source,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true as const };
}
export async function previewMessage(input: unknown) {
  const ctx = await getTenantContext();
  if (
    !can(ctx.permissions, 'messages.manage') &&
    !can(ctx.permissions, 'collections.manage')
  )
    return failure({ code: '42501' });
  const p = z
    .object({
      client: z.uuid(),
      channel: z.enum(channels),
      template: z.string().max(40),
      loan: z.uuid().optional(),
    })
    .strict()
    .safeParse(input);
  if (!p.success) return failure(null);
  const { data, error } = await ctx.db.rpc('preview_message', {
    t: ctx.tenant.id,
    c: p.data.client,
    ch: p.data.channel,
    template: p.data.template,
    ...(p.data.loan ? { loan: p.data.loan } : {}),
  });
  if (error) return failure(error);
  return {
    ok: true as const,
    preview: z.object({ body: z.string(), allowed: z.boolean() }).parse(data),
  };
}
