import { LogoutButton } from '@/components/logout-button';
import { getTranslations } from 'next-intl/server';
import { getPlatformContext, tenantAddress } from '@/lib/context';
import { FormDrawer } from '@/components/form-drawer';
import { DataTable } from '@/components/data-table';
import { createTenant, savePlan, updateTenantStatus } from '@/app/actions';
import { z } from 'zod';
export default async function PlatformPage() {
  const { db } = await getPlatformContext();
  const t = await getTranslations('App');
  const [
    { data: tenants },
    { data: presets },
    { data: plans },
    { data: usage },
  ] = await Promise.all([
    db.from('tenants').select('*').order('created_at', { ascending: false }),
    db.from('presets').select('id,name').order('name'),
    db.from('plans').select('*').order('name'),
    db.rpc('tenant_usage'),
  ]);
  const tenantRows = await Promise.all(
    (tenants ?? []).map(async (tenant) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.active ? 'active' : 'paused',
      address: await tenantAddress(tenant.slug, '/login'),
      users: String(
        usage?.find((row) => row.tenant_id === tenant.id)?.user_count ?? 0,
      ),
    })),
  );
  return (
    <main className="platform-page">
      <header className="platform-header">
        <strong>{t('platformName')}</strong>
        <LogoutButton />
      </header>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('platformAccess')}</p>
          <h1>{t('tenants')}</h1>
          <p>{t('platformHelp')}</p>
        </div>
        <FormDrawer
          title="createTenant"
          description="createTenantHelp"
          trigger="createTenant"
          action={createTenant}
          submitLabel="createTenant"
          kind="tenant"
          fields={[
            { name: 'name', label: 'tenantName', required: true },
            {
              name: 'slug',
              label: 'subdomain',
              required: true,
              help: 'subdomainHelp',
            },
            {
              name: 'presetId',
              label: 'preset',
              type: 'select',
              options: (presets ?? []).map((row) => ({
                value: row.id,
                label: row.name,
              })),
            },
            {
              name: 'planId',
              label: 'plan',
              type: 'select',
              options: (plans ?? []).map((row) => ({
                value: row.id,
                label: row.name,
              })),
            },
          ]}
        />
      </div>
      <div className="table-frame">
        <DataTable
          label="tenants"
          columns={[
            { key: 'name', label: 'tenantName' },
            { key: 'status', label: 'state' },
            { key: 'users', label: 'activeUsers', numeric: true },
            { key: 'address', label: 'address' },
          ]}
          rows={tenantRows}
        />
      </div>
      <div className="tenant-status-list">
        {(tenants ?? []).map((tenant) => (
          <div key={tenant.id}>
            <span>{tenant.name}</span>
            <FormDrawer
              secondary
              title="tenantStatus"
              description="tenantStatusHelp"
              trigger="edit"
              action={updateTenantStatus}
              submitLabel="save"
              fields={[
                { name: 'id', type: 'hidden', value: tenant.id },
                {
                  name: 'active',
                  label: 'activeTenant',
                  type: 'switch',
                  value: String(tenant.active),
                },
              ]}
            />
          </div>
        ))}
      </div>
      <div className="subsection-heading">
        <h2>{t('plans')}</h2>
        <p>{t('plansHelp')}</p>
      </div>
      <div className="role-list">
        {(plans ?? []).map((plan) => {
          const limits = z
            .object({
              users: z.number(),
              active_loans: z.number(),
              messages: z.number(),
            })
            .parse(plan.limits);
          const features = z
            .object({ campaigns: z.boolean() })
            .parse(plan.features);
          return (
            <div key={plan.id}>
              <span>
                <strong>{plan.name}</strong>
                <p className="ui-help">
                  {t('planSummary', {
                    users: limits.users,
                    loans: limits.active_loans,
                    messages: limits.messages,
                  })}
                </p>
              </span>
              <FormDrawer
                secondary
                title="editPlan"
                description="planEffect"
                trigger="edit"
                action={savePlan}
                submitLabel="save"
                fields={[
                  { name: 'id', type: 'hidden', value: plan.id },
                  {
                    name: 'name',
                    label: 'planName',
                    value: plan.name,
                    required: true,
                  },
                  {
                    name: 'users',
                    label: 'userLimit',
                    type: 'number',
                    value: String(limits.users),
                  },
                  {
                    name: 'active_loans',
                    label: 'loanLimit',
                    type: 'number',
                    value: String(limits.active_loans),
                  },
                  {
                    name: 'messages',
                    label: 'messageLimit',
                    type: 'number',
                    value: String(limits.messages),
                  },
                  {
                    name: 'campaigns',
                    label: 'campaigns',
                    type: 'switch',
                    value: String(features.campaigns),
                  },
                ]}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}
