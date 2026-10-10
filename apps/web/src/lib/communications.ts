import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { templateSchema } from './domain/communications';
export async function communicationTemplates(
  db: SupabaseClient<Database>,
  tenant: string,
) {
  const { data, error } = await db
    .from('tenant_configuration')
    .select('key,value')
    .eq('tenant_id', tenant)
    .eq('category', 'message_template')
    .order('key');
  if (error) throw new Error('Template lookup failed');
  return (data ?? []).map((x) => ({
    key: x.key,
    value: templateSchema.parse(x.value),
  }));
}
