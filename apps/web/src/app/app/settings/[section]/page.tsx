import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { securitySchema, permissionKeys } from '@/lib/domain/tenancy';
import { FormDrawer } from '@/components/form-drawer';
import { ActionForm, type FormField } from '@/components/action-form';
import { DataTable } from '@/components/data-table';
import {
  createBranch,
  saveBrand,
  saveSecurity,
  saveRole,
  inviteMember,
  saveMember,
} from '@/app/actions';
export default async function SettingsDetail({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const t = await getTranslations('App');
  if (!['brand', 'team', 'branches', 'security', 'audit'].includes(section))
    notFound();
  const context =
    section === 'brand' || section === 'security'
      ? await requirePermission('tenant.manage')
      : section === 'audit'
        ? await requirePermission('audit.read')
        : await requirePermission('users.manage');
  const { db, tenant } = context;
  let content: React.ReactNode;
  if (section === 'brand') {
    content = (
      <div className="settings-form-panel">
        <ActionForm
          kind="brand"
          action={saveBrand}
          submitLabel="saveBrand"
          fields={[
            'name',
            'accent',
            'legal_name',
            'contact_phone',
            'license_number',
            'footer',
            'logo_url',
          ].map((key) => ({
            name: key,
            label: key,
            type: key === 'accent' ? 'color' : 'text',
            value: String(
              tenant[
                key as
                  | 'name'
                  | 'accent'
                  | 'legal_name'
                  | 'contact_phone'
                  | 'license_number'
                  | 'footer'
                  | 'logo_url'
              ] ?? '',
            ),
            required: key === 'name' || key === 'accent',
          }))}
        />
      </div>
    );
  } else if (section === 'security') {
    const security = securitySchema.parse(tenant.security);
    content = (
      <>
        <div className="security-intro">
          <p className="ui-help">{t('securityEffect')}</p>
          <Link href="/auth/mfa" className="ui-button ui-button-secondary">
            {t('accountSecurity')}
          </Link>
        </div>
        <div className="settings-form-panel">
          <ActionForm
            kind="security"
            action={saveSecurity}
            submitLabel="saveSecurity"
            fields={[
              {
                name: 'require_mfa',
                label: 'requireMfa',
                type: 'switch',
                value: String(security.require_mfa),
              },
              {
                name: 'session_hours',
                label: 'sessionHours',
                type: 'number',
                value: String(security.session_hours),
                required: true,
              },
              {
                name: 'password_min_length',
                label: 'passwordLength',
                type: 'number',
                value: String(security.password_min_length),
                required: true,
              },
            ]}
          />
        </div>
      </>
    );
  } else if (section === 'branches') {
    const { data } = await db
      .from('branches')
      .select('id,name')
      .eq('tenant_id', tenant.id)
      .order('name');
    content = (
      <>
        <div className="section-actions">
          <FormDrawer
            title="newBranch"
            description="branchesHelp"
            trigger="newBranch"
            action={createBranch}
            submitLabel="createBranch"
            fields={[{ name: 'name', label: 'branchName', required: true }]}
          />
        </div>
        <div className="table-frame">
          <DataTable
            label="branches"
            columns={[{ key: 'name', label: 'branchName' }]}
            rows={data ?? []}
          />
        </div>
      </>
    );
  } else if (section === 'audit') {
    const { data } = await db
      .from('audit_events')
      .select('id,action,entity,occurred_at,actor_id,entity_id')
      .eq('tenant_id', tenant.id)
      .order('occurred_at', { ascending: false })
      .limit(100);
    const { data: actors } = await db
      .from('memberships')
      .select('user_id,display_name')
      .eq('tenant_id', tenant.id);
    const actorNames = new Map(
      (actors ?? []).map((member) => [member.user_id, member.display_name]),
    );
    content = (
      <>
        <p className="ui-help audit-note">{t('auditImmutable')}</p>
        <div className="table-frame">
          <DataTable
            label="audit"
            columns={[
              { key: 'date', label: 'date' },
              { key: 'action', label: 'action' },
              { key: 'entity', label: 'entity' },
              { key: 'actor', label: 'actor' },
            ]}
            rows={(data ?? []).map((row) => ({
              id: String(row.id),
              date: new Intl.DateTimeFormat('pt-MZ', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Africa/Maputo',
              }).format(new Date(row.occurred_at)),
              action: t(`auditAction.${row.action}`),
              entity: t(`auditEntity.${row.entity}`),
              actor:
                row.actor_id === context.user.id
                  ? t('you')
                  : row.actor_id
                    ? (actorNames.get(row.actor_id) ?? t('colleague'))
                    : t('system'),
            }))}
          />
        </div>
      </>
    );
  } else {
    const [{ data: members }, { data: roles }, { data: branches }] =
      await Promise.all([
        db
          .from('memberships')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('display_name'),
        db
          .from('tenant_roles')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('name'),
        db
          .from('branches')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('name'),
      ]);
    const roleOptions = (roles ?? []).map((row) => ({
      value: row.id,
      label: row.name,
    }));
    const branchOptions = [
      { value: '', label: t('allBranches') },
      ...(branches ?? []).map((row) => ({ value: row.id, label: row.name })),
    ];
    const inviteFields: FormField[] = [
      { name: 'display_name', label: 'fullName', required: true },
      { name: 'email', label: 'email', type: 'email', required: true },
      { name: 'role_id', label: 'role', type: 'select', options: roleOptions },
      {
        name: 'branch_id',
        label: 'branch',
        type: 'select',
        options: branchOptions,
      },
    ];
    content = (
      <>
        <div className="section-actions">
          <FormDrawer
            title="inviteMember"
            description="inviteHelp"
            trigger="inviteMember"
            action={inviteMember}
            submitLabel="sendInvite"
            fields={inviteFields}
          />
        </div>
        <div className="team-list">
          {(members ?? []).map((member) => (
            <div className="team-row" key={member.id}>
              <div>
                <strong>{member.display_name}</strong>
                <p className="ui-help">{member.email}</p>
              </div>
              <span className="ui-help">
                {roles?.find((role) => role.id === member.role_id)?.name}
              </span>
              <FormDrawer
                secondary
                title="editMember"
                description="memberEffect"
                trigger="edit"
                action={saveMember}
                submitLabel="save"
                fields={[
                  { name: 'id', type: 'hidden', value: member.id },
                  {
                    name: 'role_id',
                    label: 'role',
                    type: 'select',
                    value: member.role_id,
                    options: roleOptions,
                  },
                  {
                    name: 'branch_id',
                    label: 'branch',
                    type: 'select',
                    value: member.branch_id ?? '',
                    options: branchOptions,
                  },
                  {
                    name: 'active',
                    label: 'activeAccess',
                    type: 'switch',
                    value: String(member.active),
                  },
                ]}
              />
            </div>
          ))}
        </div>
        <div className="subsection-heading">
          <h2>{t('roles')}</h2>
          <p>{t('roleHelp')}</p>
        </div>
        <div className="role-list">
          {(roles ?? []).map((role) => (
            <div key={role.id}>
              <span>
                <strong>{role.name}</strong>
                <p className="ui-help">
                  {t('permissionCount', { count: role.permissions.length })}
                </p>
              </span>
              <FormDrawer
                secondary
                title="editRole"
                description="roleEffect"
                trigger="editPermissions"
                action={saveRole}
                submitLabel="save"
                fields={[
                  { name: 'id', type: 'hidden', value: role.id },
                  {
                    name: 'name',
                    label: 'roleName',
                    value: role.name,
                    required: true,
                  },
                  ...permissionKeys.map((key) => ({
                    name: `permission_${key.replace('.', '_')}`,
                    label: `permissions.${key.replace('.', '_')}`,
                    type: 'switch' as const,
                    value: String(role.permissions.includes(key)),
                    disabled:
                      role.key === 'manager' &&
                      ['tenant.read', 'tenant.manage', 'users.manage'].includes(
                        key,
                      ),
                  })),
                ]}
              />
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <Link href="/app/settings" className="back-link">
        {t('backSettings')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{t(section)}</h1>
          <p>{t(`${section}Help`)}</p>
        </div>
      </div>
      {content}
    </>
  );
}
