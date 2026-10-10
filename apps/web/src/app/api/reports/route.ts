import { getTranslations } from 'next-intl/server';
import {
  reportFilterSchema,
  reportMatrix,
  reportCsv,
} from '@/lib/domain/reports';
import { readReport } from '@/lib/reports';
import { reportPdf } from '@/lib/documents/report-pdf';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = reportFilterSchema.safeParse(Object.fromEntries(params));
  const format = params.get('format');
  if (!parsed.success || !['csv', 'pdf'].includes(format ?? ''))
    return new Response(null, { status: 400 });
  const { context, report } = await readReport(
    parsed.data,
    format as 'csv' | 'pdf',
  );
  if (!report) return new Response(null, { status: 403 });
  const t = await getTranslations('Reports'),
    dates = await getTranslations('Dates');
  const labels = Object.fromEntries(
    [
      'bucket',
      'count',
      'principal',
      'balance',
      'provision',
      'date',
      'source',
      'amount',
      'client',
      'product',
      'branch',
      'agent',
      'reference',
      'state',
      'opening',
      'expected',
      'counted',
      'difference',
      'reason',
      'payment',
      'disbursement',
      'reversal',
      'open',
      'closed',
    ].map((k) => [k, t(k)]),
  );
  const matrix = reportMatrix(
    report,
    labels,
    Array.from({ length: 12 }, (_, i) => dates(`months.${i}`)),
  );
  const body =
    format === 'csv'
      ? reportCsv(matrix)
      : Buffer.from(
          await reportPdf({
            brand: context.tenant.name,
            title: t(`types.${report.kind}`),
            subtitle: t('exportPeriod', {
              from: report.from,
              to: report.to,
              asOf: report.asOf,
            }),
            matrix,
            notice: report.truncated ? t('truncated') : '',
          }),
        );
  return new Response(body, {
    headers: {
      'Content-Type':
        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
      'Content-Disposition': `attachment; filename="loma-${report.kind}-${report.asOf}.${format}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
