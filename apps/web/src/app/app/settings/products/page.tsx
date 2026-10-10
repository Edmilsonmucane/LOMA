import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/context';
import { termsSchema } from '@/lib/domain/products';
import { ProductWizard } from '@/components/product-wizard';
import { Badge } from '@loma/ui';
export default async function ProductsPage() {
  const { db, tenant } = await requirePermission('tenant.manage');
  const t = await getTranslations('Products');
  const [{ data: products }, { data: versions }, { data: roles }] =
    await Promise.all([
      db.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
      db
        .from('product_versions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('version', { ascending: false }),
      db.from('tenant_roles').select('key,name').eq('tenant_id', tenant.id),
    ]);
  const presets = (products ?? [])
    .filter((p) => p.source_key)
    .flatMap((p) => {
      const v = versions?.find(
        (v) =>
          v.product_id === p.id &&
          v.version === (p.active_version ?? p.revision),
      );
      const parsed = termsSchema.safeParse(v?.terms);
      return parsed.success ? [{ name: p.name, terms: parsed.data }] : [];
    });
  return (
    <>
      <Link className="back-link" href="/app/settings">
        {t('back')}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('help')}</p>
        </div>
        {presets[0] && (
          <ProductWizard
            roles={roles ?? []}
            presets={presets}
            initial={presets[0]}
          />
        )}
      </div>
      <div className="product-list">
        {(products ?? []).map((product) => {
          const version = versions?.find(
            (v) =>
              v.product_id === product.id && v.version === product.revision,
          );
          const parsed = termsSchema.safeParse(version?.terms);
          if (!parsed.success) return null;
          return (
            <section key={product.id} className="product-row">
              <div>
                <h2>{product.name}</h2>
                <p className="ui-help">
                  {t(`methods.${parsed.data.method}`)} ·{' '}
                  {t(`periods.${parsed.data.periodicity}`)} ·{' '}
                  {t('version', { version: product.revision })}
                </p>
                {product.active_version !== null &&
                  product.active_version !== product.revision && (
                    <p className="ui-help">
                      {t('pendingVersion', { version: product.active_version })}
                    </p>
                  )}
              </div>
              <Badge tone={product.status === 'active' ? 'success' : 'neutral'}>
                {t(`status.${product.status}`)}
              </Badge>
              <ProductWizard
                roles={roles ?? []}
                secondary
                presets={presets}
                initial={{ name: product.name, terms: parsed.data }}
                identity={{
                  id: product.id,
                  revision: product.revision,
                  status: product.status as 'active' | 'draft' | 'archived',
                }}
              />
              <details className="product-history">
                <summary>{t('history')}</summary>
                <p className="ui-help">{t('effect')}</p>
                {versions
                  ?.filter((v) => v.product_id === product.id)
                  .map((v) => (
                    <div key={v.id}>
                      <span>
                        {t('version', { version: v.version })} · {v.name}
                        {product.active_version === v.version
                          ? ` · ${t('published')}`
                          : ''}
                      </span>
                      <ProductWizard
                        roles={roles ?? []}
                        secondary
                        readonly
                        presets={presets}
                        initial={{
                          name: v.name,
                          terms: termsSchema.parse(v.terms),
                        }}
                        identity={{
                          id: product.id,
                          revision: v.version,
                          status: product.status as
                            'active' | 'draft' | 'archived',
                        }}
                      />
                    </div>
                  ))}
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}
