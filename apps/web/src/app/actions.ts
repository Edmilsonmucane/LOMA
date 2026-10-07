'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  getPublicTenant,
  getTenantContext,
  getPlatformContext,
  requirePermission,
  tenantAddress,
} from '@/lib/context';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import {
  tenantSchema,
  loginSchema,
  brandSchema,
  securitySchema,
  permissionKeys,
  can,
} from '@/lib/domain/tenancy';
export type ActionResult = { ok: boolean; error?: string; redirect?: string };
function failure(code?: string): ActionResult {
  return {
    ok: false,
    error:
      code === '23505'
        ? 'duplicate'
        : code === '23514'
          ? 'limit'
          : code === '42501'
            ? 'denied'
            : 'failed',
  };
}
export async function login(
  values: Record<string, string>,
): Promise<ActionResult> {
  const result = loginSchema.safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword(result.data);
  if (error) return { ok: false, error: 'login' };
  const tenant = await getPublicTenant();
  if (!tenant) {
    const { data: isAdmin } = await db.rpc('is_platform_admin');
    if (!isAdmin) {
      await db.auth.signOut();
      return { ok: false, error: 'tenantAddress' };
    }
    await db.rpc('log_platform_access');
    return { ok: true, redirect: '/platform' };
  }
  if (tenant.require_mfa) return { ok: true, redirect: '/auth/mfa' };
  const { data: allowed } = await db.rpc('has_permission', {
    t: tenant.id,
    p: 'tenant.read',
  });
  if (!allowed) {
    await db.auth.signOut();
    return { ok: false, error: 'denied' };
  }
  const { error: auditError } = await db.rpc('log_access', { t: tenant.id });
  if (auditError) return failure(auditError.code);
  return { ok: true, redirect: '/app' };
}
export async function logout(): Promise<ActionResult> {
  const db = await supabaseServer();
  await db.auth.signOut();
  return { ok: true, redirect: '/login' };
}
export async function createTenant(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db } = await getPlatformContext();
  const result = tenantSchema.safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const { name, slug, presetId, planId } = result.data;
  const { error } = await db.rpc('provision_tenant', {
    tenant_name: name,
    tenant_slug: slug,
    preset_id: presetId,
    selected_plan_id: planId,
  });
  if (error) return failure(error.code);
  revalidatePath('/platform');
  return { ok: true };
}
export async function updateTenantStatus(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db } = await getPlatformContext();
  const result = z
    .object({ id: z.uuid(), active: z.enum(['true', 'false']) })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const { error } = await db
    .from('tenants')
    .update({ active: result.data.active === 'true' })
    .eq('id', result.data.id);
  if (error) return failure(error.code);
  revalidatePath('/platform');
  return { ok: true };
}
export async function savePlan(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db } = await getPlatformContext();
  const result = z
    .object({
      id: z.uuid(),
      name: z.string().min(2).max(100),
      users: z.coerce.number().int().min(1),
      active_loans: z.coerce.number().int().min(1),
      messages: z.coerce.number().int().min(0),
      campaigns: z.enum(['true', 'false']),
    })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const data = result.data;
  const { error } = await db
    .from('plans')
    .update({
      name: data.name,
      limits: {
        users: data.users,
        active_loans: data.active_loans,
        messages: data.messages,
      },
      features: { campaigns: data.campaigns === 'true' },
    })
    .eq('id', data.id);
  if (error) return failure(error.code);
  revalidatePath('/platform');
  return { ok: true };
}
export async function saveBrand(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db, tenant } = await requirePermission('tenant.manage');
  const result = brandSchema.safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const { error } = await db
    .from('tenants')
    .update({ ...result.data, logo_url: result.data.logo_url || null })
    .eq('id', tenant.id);
  if (error) return failure(error.code);
  revalidatePath('/app', 'layout');
  return { ok: true };
}
export async function saveSecurity(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db, tenant } = await requirePermission('tenant.manage');
  const result = securitySchema.safeParse({
    require_mfa: values.require_mfa === 'true',
    session_hours: Number(values.session_hours),
    password_min_length: Number(values.password_min_length),
  });
  if (!result.success) return { ok: false, error: 'invalid' };
  if (result.data.require_mfa) {
    const { data } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== 'aal2')
      return { ok: false, error: 'enrollFirst' };
  }
  const { error } = await db
    .from('tenants')
    .update({ security: result.data })
    .eq('id', tenant.id);
  if (error) return failure(error.code);
  revalidatePath('/app/settings/security');
  return { ok: true };
}
export async function createBranch(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db, tenant } = await requirePermission('users.manage');
  const result = z
    .object({ name: z.string().trim().min(2).max(100) })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const { error } = await db
    .from('branches')
    .insert({ tenant_id: tenant.id, name: result.data.name });
  if (error) return failure(error.code);
  revalidatePath('/app/settings/branches');
  return { ok: true };
}
export async function saveRole(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db, tenant } = await requirePermission('users.manage');
  const result = z
    .object({ id: z.uuid(), name: z.string().trim().min(2).max(100) })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const permissions = permissionKeys.filter(
    (key) => values[`permission_${key.replace('.', '_')}`] === 'true',
  );
  const { error } = await db
    .from('tenant_roles')
    .update({ name: result.data.name, permissions: [...permissions] })
    .eq('tenant_id', tenant.id)
    .eq('id', result.data.id);
  if (error) return failure(error.code);
  revalidatePath('/app/settings/team');
  return { ok: true };
}
export async function inviteMember(
  values: Record<string, string>,
): Promise<ActionResult> {
  const { db, tenant } = await requirePermission('users.manage');
  const result = z
    .object({
      email: z.email(),
      display_name: z.string().trim().min(2).max(100),
      role_id: z.uuid(),
      branch_id: z.union([z.uuid(), z.literal('')]),
    })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const { data: role } = await db
    .from('tenant_roles')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('id', result.data.role_id)
    .maybeSingle();
  if (!role) return { ok: false, error: 'invalid' };
  if (result.data.branch_id) {
    const { data: branch } = await db
      .from('branches')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', result.data.branch_id)
      .maybeSingle();
    if (!branch) return { ok: false, error: 'invalid' };
  }
  const { data: linked, error: linkError } = await db.rpc(
    'link_existing_member',
    {
      t: tenant.id,
      member_email: result.data.email,
      member_name: result.data.display_name,
      selected_role: result.data.role_id,
      ...(result.data.branch_id
        ? { selected_branch: result.data.branch_id }
        : {}),
    },
  );
  if (linkError) return failure(linkError.code);
  if (linked) {
    revalidatePath('/app/settings/team');
    return { ok: true };
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    result.data.email,
    {
      data: { name: result.data.display_name, tenant_name: tenant.name },
      redirectTo: await tenantAddress(tenant.slug, '/auth/callback'),
    },
  );
  if (error) return { ok: false, error: 'invite' };
  const { error: insertError } = await db.from('memberships').insert({
    tenant_id: tenant.id,
    user_id: data.user.id,
    role_id: result.data.role_id,
    branch_id: result.data.branch_id || null,
    display_name: result.data.display_name,
    email: result.data.email,
  });
  if (insertError) return failure(insertError.code);
  revalidatePath('/app/settings/team');
  return { ok: true };
}
export async function saveMember(
  values: Record<string, string>,
): Promise<ActionResult> {
  const context = await getTenantContext();
  if (!can(context.permissions, 'users.manage'))
    return { ok: false, error: 'denied' };
  const result = z
    .object({
      id: z.uuid(),
      role_id: z.uuid(),
      branch_id: z.union([z.uuid(), z.literal('')]),
      active: z.enum(['true', 'false']),
    })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'invalid' };
  const { error } = await context.db
    .from('memberships')
    .update({
      role_id: result.data.role_id,
      branch_id: result.data.branch_id || null,
      active: result.data.active === 'true',
    })
    .eq('tenant_id', context.tenant.id)
    .eq('id', result.data.id);
  if (error) return failure(error.code);
  revalidatePath('/app/settings/team');
  return { ok: true };
}
export async function setPassword(
  values: Record<string, string>,
): Promise<ActionResult> {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'denied' };
  const tenant = await getPublicTenant();
  const result = z
    .string()
    .min(tenant?.password_min_length ?? 8)
    .max(128)
    .safeParse(values.password);
  if (!result.success) return { ok: false, error: 'password' };
  const { error } = await db.auth.updateUser({ password: result.data });
  if (error) return failure(error.code);
  return { ok: true, redirect: tenant?.require_mfa ? '/auth/mfa' : '/app' };
}
export async function enrollMfa(): Promise<{
  ok: boolean;
  error?: string;
  factorId?: string;
  qr?: string;
}> {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'denied' };
  const { data: factors } = await db.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === 'unverified')
      await db.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await db.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'LOMA',
  });
  if (error) return { ok: false, error: 'failed' };
  return {
    ok: true,
    factorId: data.id,
    qr: data.totp.qr_code.startsWith('data:image/')
      ? data.totp.qr_code
      : `data:image/svg+xml;base64,${Buffer.from(data.totp.qr_code).toString('base64')}`,
  };
}
export async function verifyMfa(
  values: Record<string, string>,
): Promise<ActionResult> {
  const result = z
    .object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
    .safeParse(values);
  if (!result.success) return { ok: false, error: 'code' };
  const db = await supabaseServer();
  const { error } = await db.auth.mfa.challengeAndVerify(result.data);
  if (error) return { ok: false, error: 'code' };
  const tenant = await getPublicTenant();
  if (tenant) {
    const { error: logError } = await db.rpc('log_access', { t: tenant.id });
    if (logError) return failure(logError.code);
  }
  return { ok: true, redirect: tenant ? '/app' : '/platform' };
}
