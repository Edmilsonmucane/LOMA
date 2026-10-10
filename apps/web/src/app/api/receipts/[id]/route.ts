import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { getTenantContext, requestAddress } from '@/lib/context';
import { receiptPdf } from '@/lib/documents/receipt-pdf';
import { formatDate } from '@/lib/domain/dates';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const { db, tenant } = await getTenantContext();
  // Exact monetary transport comes from SQL casts, never JSON numbers for bigint.
  const { data: p } = await db
    .from('payments')
    .select('id,loan_id,receipt_snapshot,reference,paid_on,method,created_at')
    .eq('tenant_id', tenant.id)
    .eq('id', id)
    .maybeSingle();
  if (!p) return new Response(null, { status: 404 });
  const { data: balance, error } = await db.rpc('loan_balance', {
    t: tenant.id,
    l: p.loan_id,
  });
  if (error) return new Response(null, { status: 403 });
  const { balanceSchema } = await import('@/lib/domain/payments');
  const row = balanceSchema.parse(balance).payments.find((r) => r.id === id);
  if (!row) return new Response(null, { status: 404 });
  const { error: access } = await db.rpc('log_receipt_access', {
    t: tenant.id,
    p: id,
  });
  if (access) return new Response(null, { status: 403 });
  const t = await getTranslations('Payments');
  const a = await getTranslations('Applications');
  const d = await getTranslations('Dates');
  const months = Array.from({ length: 12 }, (_, i) => d(`months.${i}`));
  const keys = [
    'receiptNumber',
    'receiptStatus',
    'reversed',
    'receiptValid',
    'client',
    'contract',
    'receivedOn',
    'amount',
    'method',
    'reference',
    'qrHelp',
  ];
  const bytes = await receiptPdf({
    payment: {
      id,
      amount: row.amount,
      number: row.number,
      reference: p.reference,
      snapshot: p.receipt_snapshot,
      createdAt: p.created_at,
    },
    reversed: row.reversed,
    url: await requestAddress(`/api/receipts/${id}`),
    labels: Object.fromEntries(keys.map((k) => [k, t(k)])),
    date: formatDate(p.paid_on, months),
    method: a(`methods.${p.method}`),
  });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${row.number}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
