import 'server-only';
import { requirePermission } from './context';
import { reportSchema, type ReportFilter } from './domain/reports';
export async function readReport(filter: ReportFilter, format?: 'csv' | 'pdf') {
  const context = await requirePermission('reports.read');
  const { db, tenant } = context;
  const { data, error } = await db.rpc('operational_report', {
    t: tenant.id,
    kind: filter.kind,
    from_day: filter.from,
    to_day: filter.to,
    ...(filter.branch ? { b: filter.branch } : {}),
    ...(filter.product ? { product: filter.product } : {}),
    ...(filter.agent ? { agent: filter.agent } : {}),
    ...(filter.client ? { cid: filter.client } : {}),
    ...(format ? { export_format: format } : {}),
  });
  if (error)
    return {
      context,
      report: null,
      error: error.code === '42501' ? 'access' : 'invalid',
    } as const;
  return { context, report: reportSchema.parse(data), error: null };
}
