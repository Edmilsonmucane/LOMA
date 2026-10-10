'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Table, Badge } from '@loma/ui';
export type DataRow = { id: string; [key: string]: string };
export function DataTable({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: DataRow[];
}) {
  const t = useTranslations('App');
  return (
    <Table<DataRow>
      label={t(label)}
      rows={rows}
      columns={columns.map((column) => ({
        key: column.key,
        heading: t(column.label),
        ...(column.numeric ? { align: 'right' as const } : {}),
        render: (row) =>
          column.key === 'status' ? (
            <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
              {t(`status.${row.status}`)}
            </Badge>
          ) : column.key === 'address' ? (
            <Link href={row.address ?? ''}>{row.address}</Link>
          ) : (
            row[column.key]
          ),
      }))}
    />
  );
}
