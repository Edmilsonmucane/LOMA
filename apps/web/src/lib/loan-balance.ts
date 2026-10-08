import 'server-only';
import { getTenantContext } from './context';
import { attestContract } from './financial-plan';
import { balanceSchema } from './domain/payments';
export async function loadLoanBalance(id: string) {
  const { db, tenant, user } = await getTenantContext();
  const { data: loan } = await db
    .from('loans')
    .select('*,contracts(*)')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle();
  if (!loan) return null;
  const { data: account } = await db
    .from('loan_accounts')
    .select('loan_id')
    .eq('tenant_id', tenant.id)
    .eq('loan_id', id)
    .maybeSingle();
  if (!account) {
    const { error } = await db.rpc('initialise_loan', {
      t: tenant.id,
      l: id,
      ...attestContract(tenant.id, user.id, loan.contracts),
    });
    if (error) throw new Error('Loan initialisation failed');
  }
  const { error: refreshError } = await db.rpc('refresh_loan', {
    t: tenant.id,
    l: id,
  });
  if (refreshError) throw new Error('Loan refresh failed');
  const { data, error } = await db.rpc('loan_balance', { t: tenant.id, l: id });
  if (error) throw new Error('Balance unavailable');
  return { loan, balance: balanceSchema.parse(data) };
}
