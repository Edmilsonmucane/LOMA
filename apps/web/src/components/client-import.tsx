'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer, Field, Table } from '@loma/ui';
import {
  parseCsv,
  prepareImport,
  importFields,
  type CsvData,
  type ImportField,
} from '@/lib/domain/clients';
import { importClients } from '@/app/client-actions';
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function safeCell(value: string) {
  return `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
}
export function ClientImport({
  branches,
  defaultBranch,
}: {
  branches: { id: string; name: string }[];
  defaultBranch: string;
}) {
  const t = useTranslations('Clients');
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('import.title')}
      description={t('import.help')}
      closeLabel={t('close')}
      trigger={<Button variant="ghost">{t('import.title')}</Button>}
    >
      {open && <Importer branches={branches} defaultBranch={defaultBranch} />}
    </Drawer>
  );
}
function Importer({
  branches,
  defaultBranch,
}: {
  branches: { id: string; name: string }[];
  defaultBranch: string;
}) {
  const t = useTranslations('Clients');
  const router = useRouter();
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>(
    {},
  );
  const [branch, setBranch] = useState(defaultBranch);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, startTransition] = useTransition();
  const [results, setResults] = useState<
    { row: number; error: string | null; id?: string }[] | null
  >(null);
  let prepared: ReturnType<typeof prepareImport> = [];
  try {
    if (csv) prepared = prepareImport(csv, mapping, branch);
  } catch {}
  const errors = results
    ? results.filter((x) => x.error)
    : prepared.filter((x) => x.error);
  const valid = prepared.filter((x) => x.data);
  const tableRows = prepared.slice(0, 20).map((x) => ({
    id: String(x.row),
    row: x.row,
    name:
      x.data?.name ??
      csv?.rows.find((r) => r.line === x.row)?.values[mapping.name ?? 0] ??
      '',
    error: x.error,
  }));
  return (
    <div className="client-form">
      <p className="ui-help">{t(`import.steps.${step}`)}</p>
      {error && <p role="alert">{t(`import.errors.${error}`)}</p>}
      {step === 0 && (
        <>
          <p>{t('import.help')}</p>
          <Button
            variant="secondary"
            onClick={() =>
              download(
                `${[t('name'), t('phone'), t('income')].join(';')}\n"Amélia Cossa";"+258841234567";"15000,00"\n`,
                'clientes-modelo.csv',
              )
            }
          >
            {t('import.template')}
          </Button>
          <Field
            label={t('import.file')}
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              setError('');
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = parseCsv(await file.text());
                setCsv(data);
                const m: Partial<Record<ImportField, number>> = {};
                for (const key of importFields) {
                  const label =
                    key === 'income' || key === 'expenses'
                      ? t(key)
                      : identityKindsLabel(key, t);
                  const index = data.headers.findIndex(
                    (h) =>
                      h.toLowerCase() === key ||
                      h.toLowerCase() === label.toLowerCase(),
                  );
                  if (index >= 0) m[key] = index;
                }
                setMapping(m);
              } catch (e) {
                setCsv(null);
                setError(e instanceof Error ? e.message : 'csv');
              }
            }}
          />
          {csv && <p>{t('import.found', { count: csv.rows.length })}</p>}
          <Button disabled={!csv} onClick={() => setStep(1)}>
            {t('continue')}
          </Button>
        </>
      )}
      {step === 1 && csv && (
        <>
          <label className="ui-field">
            <span className="ui-label">{t('branch')}</span>
            <select
              className="ui-input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <p className="ui-help">{t('import.mapHelp')}</p>
          <div className="form-grid">
            {importFields.map((key) => (
              <label key={key} className="ui-field">
                <span>{identityKindsLabel(key, t)}</span>
                <select
                  className="ui-input"
                  value={mapping[key] ?? ''}
                  onChange={(e) =>
                    setMapping((previous) => {
                      const next = { ...previous };
                      if (e.target.value === '') delete next[key];
                      else next[key] = Number(e.target.value);
                      return next;
                    })
                  }
                >
                  <option value="">{t('import.skip')}</option>
                  {csv.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="drawer-actions">
            <Button variant="ghost" onClick={() => setStep(0)}>
              {t('previous')}
            </Button>
            <Button
              onClick={() => {
                try {
                  prepareImport(csv, mapping, branch);
                  setError('');
                  setStep(2);
                } catch {
                  setError('mapping');
                }
              }}
            >
              {t('import.preview')}
            </Button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p>
            {t('import.summary', {
              valid: results
                ? results.filter((x) => !x.error).length
                : valid.length,
              errors: errors.length,
            })}
          </p>
          <p className="ui-help">{t('import.consent')}</p>
          {!results && (
            <Table
              label={t('import.preview')}
              rows={tableRows}
              columns={[
                { key: 'row', heading: t('import.row'), render: (r) => r.row },
                { key: 'name', heading: t('name'), render: (r) => r.name },
                {
                  key: 'status',
                  heading: t('import.status'),
                  render: (r) =>
                    r.error ? t(`import.errors.${r.error}`) : t('import.valid'),
                },
              ]}
            />
          )}
          <p className="ui-help">{t('import.previewLimit')}</p>
          {errors.length > 0 && (
            <>
              <Table
                label={t('import.errorReport')}
                rows={errors
                  .slice(0, 20)
                  .map((x, i) => ({ ...x, id: String(i) }))}
                columns={[
                  {
                    key: 'row',
                    heading: t('import.row'),
                    render: (r) => r.row,
                  },
                  {
                    key: 'error',
                    heading: t('import.status'),
                    render: (r) => t(`import.errors.${r.error}`),
                  },
                ]}
              />
              <Button
                variant="secondary"
                onClick={() =>
                  download(
                    [
                      `${t('import.row')};${t('import.status')}`,
                      ...errors.map(
                        (x) =>
                          `${x.row};${safeCell(t(`import.errors.${x.error}`))}`,
                      ),
                    ].join('\n'),
                    'clientes-erros.csv',
                  )
                }
              >
                {t('import.downloadErrors')}
              </Button>
            </>
          )}
          {results ? (
            <p role="status">{t('import.finished')}</p>
          ) : (
            <div className="drawer-actions">
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => setStep(1)}
              >
                {t('previous')}
              </Button>
              <Button
                disabled={!valid.length}
                loading={saving}
                onClick={() => {
                  setError('');
                  startTransition(async () => {
                    try {
                      const result = await importClients(
                        valid.map((x) => ({ row: x.row, data: x.data })),
                      );
                      if (!result.ok) {
                        setError(result.error ?? 'failed');
                        return;
                      }
                      setResults(
                        [
                          ...prepared
                            .filter((x) => x.error)
                            .map((x) => ({ row: x.row, error: x.error })),
                          ...result.results,
                        ].sort((a, b) => a.row - b.row),
                      );
                      router.refresh();
                    } catch {
                      setError('failed');
                    }
                  });
                }}
              >
                {t('import.confirm', { count: valid.length })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function identityKindsLabel(
  key: ImportField,
  t: ReturnType<typeof useTranslations>,
) {
  return ['bi', 'nuit', 'passport', 'dire'].includes(key)
    ? t(`identities.${key}`)
    : t(key === 'birth_date' ? 'birthDate' : key);
}
