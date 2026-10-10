import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { termsSchema } from './domain/products';
export async function activeProducts(
  db: SupabaseClient<Database>,
  tenantId: string,
) {
  const [{ data: products }, { data: versions }] = await Promise.all([
    db
      .from('products')
      .select('id,name,active_version')
      .eq('tenant_id', tenantId)
      .neq('status', 'archived')
      .not('active_version', 'is', null),
    db
      .from('product_versions')
      .select('id,product_id,version,name,terms')
      .eq('tenant_id', tenantId),
  ]);
  return (products ?? []).flatMap((p) => {
    const v = versions?.find(
      (v) => v.product_id === p.id && v.version === p.active_version,
    );
    const terms = termsSchema.safeParse(v?.terms);
    return terms.success && v
      ? [{ id: p.id, name: v.name, versionId: v.id, terms: terms.data }]
      : [];
  });
}
