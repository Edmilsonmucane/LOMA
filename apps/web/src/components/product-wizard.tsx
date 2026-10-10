'use client';
import { useState, useMemo } from 'react';
import {
  useForm,
  useFieldArray,
  useWatch,
  Controller,
  type FieldPath,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button, Drawer, Field, Table } from '@loma/ui';
import {
  simulate,
  formatMoney,
  formatPercent,
  parseMoney,
  percentRate,
  percentValue,
  methods,
  periodicities,
  type Terms,
  type Instalment,
} from '@loma/loan-engine';
import { productSchema, type ProductEditor } from '@/lib/domain/products';
import { saveProduct } from '@/app/product-actions';
type Preset = { name: string; terms: Terms };
type Identity = {
  id: string;
  revision: number;
  status: 'draft' | 'active' | 'archived';
};
export function ProductWizard({
  initial,
  presets,
  roles,
  identity,
  secondary = false,
  readonly = false,
}: {
  initial: Preset;
  presets: Preset[];
  roles: { key: string; name: string }[];
  identity?: Identity;
  secondary?: boolean;
  readonly?: boolean;
}) {
  const t = useTranslations('Products');
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t(readonly ? 'view' : identity ? 'edit' : 'create')}
      description={t('effect')}
      closeLabel={t('close')}
      trigger={
        <Button variant={secondary ? 'secondary' : 'primary'}>
          {t(readonly ? 'view' : identity ? 'edit' : 'create')}
        </Button>
      }
    >
      {open && (
        <Editor
          initial={initial}
          presets={presets}
          roles={roles}
          {...(identity ? { identity } : {})}
          readonly={readonly}
          onClose={() => setOpen(false)}
        />
      )}
    </Drawer>
  );
}
function AmountInput({
  value,
  onChange,
  percentage,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  percentage: boolean;
  label: string;
}) {
  const raw = (v: string) => {
    try {
      return percentage
        ? percentValue(v)
        : formatMoney(BigInt(v)).replace(' MT', '').replaceAll(' ', '');
    } catch {
      return '';
    }
  };
  const [text, setText] = useState(() => raw(value));
  return (
    <Field
      label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(
            percentage
              ? percentRate(e.target.value)
              : parseMoney(e.target.value).toString(),
          );
        } catch {
          onChange('invalid');
        }
      }}
      required
    />
  );
}
function Editor({
  initial,
  presets,
  roles,
  identity,
  readonly,
  onClose,
}: {
  initial: Preset;
  presets: Preset[];
  roles: { key: string; name: string }[];
  identity?: Identity;
  readonly: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('Products');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sampleAmount, setSampleAmount] = useState('10000');
  const [samplePeriods, setSamplePeriods] = useState(
    Math.min(initial.terms.maxPeriods, Math.max(initial.terms.minPeriods, 6)),
  );
  const [sampleDate, setSampleDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Maputo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  );
  const form = useForm<ProductEditor>({
    resolver: zodResolver(productSchema),
    defaultValues: initial,
  });
  const fees = useFieldArray({ control: form.control, name: 'terms.fees' }),
    taxes = useFieldArray({ control: form.control, name: 'terms.taxes' }),
    levels = useFieldArray({
      control: form.control,
      name: 'terms.approvalLevels',
    });
  const values = useWatch({ control: form.control }) as ProductEditor;
  const preview = useMemo(() => {
    try {
      const terms = productSchema.parse(values).terms;
      return {
        quote: simulate({
          principal: parseMoney(sampleAmount),
          periods: samplePeriods,
          startDate: sampleDate,
          terms,
        }),
      };
    } catch {
      return { quote: null };
    }
  }, [values, sampleAmount, samplePeriods, sampleDate]);
  const money = (
    path: FieldPath<ProductEditor>,
    label: string,
    percentage = false,
  ) => (
    <Controller
      key={`${epoch}-${path}-${percentage}`}
      control={form.control}
      name={path}
      render={({ field }) => (
        <AmountInput
          value={String(field.value)}
          onChange={field.onChange}
          percentage={percentage}
          label={t(label)}
        />
      )}
    />
  );
  const number = (
    path: FieldPath<ProductEditor>,
    label: string,
    optional = false,
  ) => (
    <Field
      key={path}
      label={t(label)}
      type="number"
      {...form.register(path, {
        setValueAs: (v: string) => (optional && v === '' ? null : Number(v)),
      })}
      required={!optional}
    />
  );
  const select = (
    path: FieldPath<ProductEditor>,
    label: string,
    options: readonly string[],
    prefix: string,
  ) => (
    <div className="ui-field" key={path}>
      <label className="ui-label" htmlFor={`${epoch}-${path}`}>
        {t(label)}
      </label>
      <select
        className="ui-input"
        id={`${epoch}-${path}`}
        {...form.register(path)}
        onChange={(e) => {
          void form.register(path).onChange(e);
          if (path.endsWith('.kind'))
            form.setValue(
              `${path.slice(0, -4)}value` as FieldPath<ProductEditor>,
              '0',
            );
        }}
      >
        {options.map((v) => (
          <option value={v} key={v}>
            {t(`${prefix}.${v}`)}
          </option>
        ))}
      </select>
    </div>
  );
  const list = (path: FieldPath<ProductEditor>, label: string) => (
    <Controller
      control={form.control}
      name={path}
      render={({ field }) => (
        <Field
          label={t(label)}
          value={(field.value as string[]).join(', ')}
          onChange={(e) =>
            field.onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          help={t('commaHelp')}
        />
      )}
    />
  );
  const chargeFields = (kind: 'fees' | 'taxes', index: number) => {
    const path = `terms.${kind}.${index}` as const;
    const isTax = kind === 'taxes';
    return (
      <fieldset className="charge-fields" key={`${epoch}-${path}`}>
        <legend>{t(isTax ? 'tax' : 'fee', { number: index + 1 })}</legend>
        <Field
          label={t('chargeName')}
          {...form.register(`${path}.key`)}
          required
        />
        {select(`${path}.kind`, 'amountKind', ['fixed', 'percentage'], 'kinds')}
        {money(
          `${path}.value`,
          values.terms[kind][index]?.kind === 'percentage'
            ? 'percentage'
            : 'amount',
          values.terms[kind][index]?.kind === 'percentage',
        )}
        {select(
          `${path}.treatment`,
          'treatment',
          ['deducted', 'financed', 'separate'],
          'treatments',
        )}
        {isTax && (
          <>
            {select(
              `terms.taxes.${index}.basis`,
              'taxBasis',
              ['principal', 'interest', 'fees'],
              'bases',
            )}
            <Field
              label={t('validFrom')}
              type="date"
              {...form.register(`terms.taxes.${index}.from`)}
              required
            />
            <Controller
              control={form.control}
              name={`terms.taxes.${index}.until`}
              render={({ field }) => (
                <Field
                  label={t('validUntil')}
                  type="date"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              )}
            />
          </>
        )}
        <Button
          variant="ghost"
          type="button"
          onClick={() => (isTax ? taxes.remove(index) : fees.remove(index))}
        >
          {t('remove')}
        </Button>
      </fieldset>
    );
  };
  const submit = async (status: 'active' | 'draft' | 'archived') => {
    setError('');
    if (!(await form.trigger()) || !preview.quote) {
      setError('invalid');
      return;
    }
    setSaving(true);
    try {
      const result = await saveProduct(form.getValues(), {
        ...(identity ? { id: identity.id } : {}),
        revision: identity?.revision ?? 0,
        status,
      });
      if (!result.ok) {
        setError(result.error ?? 'invalid');
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError('failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="product-editor">
      <ol className="wizard-steps" aria-label={t('steps')}>
        {['conditions', 'rules', 'review'].map((key, i) => (
          <li key={key} aria-current={i === step ? 'step' : undefined}>
            {i + 1}. {t(key)}
          </li>
        ))}
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) {
            if (step === 0) {
              const p = productSchema.safeParse(form.getValues());
              if (!p.success) {
                setError('invalid');
                return;
              }
            }
            setError('');
            setStep(step + 1);
          } else if (!readonly) void submit('active');
        }}
      >
        <fieldset disabled={readonly || saving} className="wizard-fields">
          {step === 0 && (
            <>
              <div className="ui-field">
                <label className="ui-label" htmlFor="product-preset">
                  {t('preset')}
                </label>
                <select
                  id="product-preset"
                  className="ui-input"
                  defaultValue=""
                  onChange={(e) => {
                    const p = presets[Number(e.target.value)];
                    if (p) {
                      form.reset(structuredClone(p));
                      setSamplePeriods(
                        Math.min(
                          p.terms.maxPeriods,
                          Math.max(p.terms.minPeriods, 6),
                        ),
                      );
                      setSampleAmount(
                        formatMoney(
                          BigInt(p.terms.minPrincipal) <= 1000000n &&
                            BigInt(p.terms.maxPrincipal) >= 1000000n
                            ? 1000000n
                            : BigInt(p.terms.minPrincipal),
                        )
                          .replace(' MT', '')
                          .replaceAll(' ', ''),
                      );
                      setEpoch((x) => x + 1);
                      setError('');
                    }
                  }}
                >
                  <option value="" disabled>
                    {t('choosePreset')}
                  </option>
                  {presets.map((p, i) => (
                    <option value={i} key={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="ui-help">{t('presetHelp')}</p>
              </div>
              <Field label={t('name')} {...form.register('name')} required />
              <div className="form-grid">
                {money('terms.minPrincipal', 'minAmount')}
                {money('terms.maxPrincipal', 'maxAmount')}
                {number('terms.minPeriods', 'minPeriods')}
                {number('terms.maxPeriods', 'maxPeriods')}
              </div>
              {select(
                'terms.periodicity',
                'periodicity',
                periodicities,
                'periods',
              )}
              {select('terms.method', 'method', methods, 'methods')}
              {money('terms.rate', 'rate', true)}
              <p className="ui-help">{t('rateHelp')}</p>
            </>
          )}
          {step === 1 && (
            <>
              <p className="ui-help">{t('rulesHelp')}</p>
              <details open>
                <summary>{t('grace')}</summary>
                <p className="ui-help">{t('graceHelp')}</p>
                {number('terms.grace.periods', 'gracePeriods')}
                {select(
                  'terms.grace.treatment',
                  'graceTreatment',
                  ['free', 'interest_only', 'capitalise'],
                  'graceTreatments',
                )}
              </details>
              <details>
                <summary>{t('fees')}</summary>
                {fees.fields.map((_, i) => chargeFields('fees', i))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    fees.append({
                      key: '',
                      kind: 'fixed',
                      value: '0',
                      treatment: 'separate',
                    })
                  }
                >
                  {t('addFee')}
                </Button>
              </details>
              <details>
                <summary>{t('taxes')}</summary>
                <p className="ui-help">{t('taxHelp')}</p>
                {taxes.fields.map((_, i) => chargeFields('taxes', i))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    taxes.append({
                      key: '',
                      kind: 'percentage',
                      value: '0',
                      treatment: 'separate',
                      basis: 'principal',
                      from: sampleDate,
                      until: null,
                    })
                  }
                >
                  {t('addTax')}
                </Button>
              </details>
              <details>
                <summary>{t('penalties')}</summary>
                {number('terms.penalty.toleranceDays', 'tolerance')}
                {money('terms.penalty.dailyRate', 'dailyRate', true)}
                {select(
                  'terms.penalty.fine.kind',
                  'fineKind',
                  ['fixed', 'percentage'],
                  'kinds',
                )}
                {money(
                  'terms.penalty.fine.value',
                  'fineValue',
                  values.terms.penalty.fine.kind === 'percentage',
                )}
              </details>
              <details>
                <summary>{t('calendar')}</summary>
                {select(
                  'terms.calendar.adjustment',
                  'adjustment',
                  ['none', 'next_business_day'],
                  'adjustments',
                )}
                <p className="ui-help">{t('weekends')}</p>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <label key={day} className="switch-field">
                    <span>{t(`weekdays.${day}`)}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={values.terms.calendar.weekendDays.includes(day)}
                      onChange={(e) =>
                        form.setValue(
                          'terms.calendar.weekendDays',
                          e.target.checked
                            ? [...values.terms.calendar.weekendDays, day]
                            : values.terms.calendar.weekendDays.filter(
                                (x) => x !== day,
                              ),
                        )
                      }
                    />
                  </label>
                ))}
                {list('terms.calendar.holidays', 'holidays')}
                {number('terms.yearDays', 'yearDays')}
              </details>
              <details>
                <summary>{t('payments')}</summary>
                {values.terms.allocation.map((component, i) => (
                  <div key={component} className="allocation-row">
                    <span>
                      {i + 1}. {t(`components.${component}`)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={i === 0}
                      aria-label={t('moveUp', {
                        component: t(`components.${component}`),
                      })}
                      onClick={() => {
                        const order = [...values.terms.allocation];
                        [order[i - 1], order[i]] = [order[i]!, order[i - 1]!];
                        form.setValue('terms.allocation', order);
                      }}
                    >
                      {t('up')}
                    </Button>
                  </div>
                ))}
                {select(
                  'terms.excess',
                  'excess',
                  ['advance', 'credit'],
                  'excessOptions',
                )}
                {select(
                  'terms.settlement',
                  'settlement',
                  [
                    'contract_interest',
                    'proportional_interest',
                    'due_interest',
                  ],
                  'settlements',
                )}
              </details>
              <details>
                <summary>{t('requirements')}</summary>
                {list('terms.requirements.documents', 'documents')}
                {list('terms.requirements.guarantees', 'guarantees')}
                {number('terms.requirements.minAge', 'minAge', true)}
                <Controller
                  control={form.control}
                  name="terms.requirements.minIncome"
                  render={({ field }) => (
                    <Field
                      label={t('minIncome')}
                      inputMode="decimal"
                      defaultValue={
                        field.value === null || !/^\d+$/.test(field.value)
                          ? ''
                          : formatMoney(BigInt(field.value))
                              .replace(' MT', '')
                              .replaceAll(' ', '')
                      }
                      onChange={(e) => {
                        try {
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : parseMoney(e.target.value).toString(),
                          );
                        } catch {
                          field.onChange('invalid');
                        }
                      }}
                    />
                  )}
                />
              </details>
              <details>
                <summary>{t('approval')}</summary>
                {levels.fields.map((_, i) => (
                  <fieldset key={_.id} className="charge-fields">
                    <legend>{t('level', { number: i + 1 })}</legend>
                    {money(`terms.approvalLevels.${i}.upTo`, 'approvalAmount')}
                    <div className="ui-field">
                      <label
                        className="ui-label"
                        htmlFor={`approval-role-${i}`}
                      >
                        {t('approvalRole')}
                      </label>
                      <select
                        className="ui-input"
                        id={`approval-role-${i}`}
                        {...form.register(`terms.approvalLevels.${i}.role`)}
                      >
                        {roles.map((role) => (
                          <option key={role.key} value={role.key}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={levels.fields.length === 1}
                      onClick={() => levels.remove(i)}
                    >
                      {t('remove')}
                    </Button>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    levels.append({
                      upTo: values.terms.maxPrincipal,
                      role: 'manager',
                    })
                  }
                >
                  {t('addLevel')}
                </Button>
                <p className="ui-help">{t('approvalHelp')}</p>
              </details>
            </>
          )}
          {step === 2 && (
            <>
              <h2>{values.name}</h2>
              <p>
                {t(`methods.${values.terms.method}`)} ·{' '}
                {t(`periods.${values.terms.periodicity}`)}
              </p>
              <p className="ui-help">{t('effect')}</p>
              <p className="ui-help">{t('publishEffect')}</p>
              <p>
                {t('limits', {
                  min: formatMoney(BigInt(values.terms.minPrincipal)),
                  max: formatMoney(BigInt(values.terms.maxPrincipal)),
                  from: values.terms.minPeriods,
                  to: values.terms.maxPeriods,
                })}
              </p>
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="ui-error">
            {t(`errors.${error}`)}
          </p>
        )}
        <div className="wizard-actions">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setError('');
                setStep(step - 1);
              }}
            >
              {t('previous')}
            </Button>
          )}
          {step < 2 ? (
            <Button type="submit">{t('next')}</Button>
          ) : (
            !readonly && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void submit('draft')}
                  loading={saving}
                >
                  {t('saveDraft')}
                </Button>
                <Button type="submit" loading={saving}>
                  {t('publish')}
                </Button>
              </>
            )
          )}
        </div>
        {step === 2 && identity && !readonly && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void submit('archived')}
            disabled={saving}
          >
            {t('archive')}
          </Button>
        )}
      </form>
      <section className="live-preview" aria-label={t('preview')}>
        <h2>{t('preview')}</h2>
        <div className="form-grid">
          <Field
            label={t('sampleAmount')}
            inputMode="decimal"
            value={sampleAmount}
            onChange={(e) => setSampleAmount(e.target.value)}
          />
          <Field
            label={t('samplePeriods')}
            type="number"
            value={samplePeriods}
            onChange={(e) => setSamplePeriods(Number(e.target.value))}
          />
        </div>
        <Field
          label={t('startDate')}
          type="date"
          value={sampleDate}
          onChange={(e) => setSampleDate(e.target.value)}
        />
        {preview.quote ? (
          <>
            <p className="preview-value numeric">
              {formatMoney(
                values.terms.method === 'interest_only'
                  ? preview.quote.instalments[values.terms.grace.periods]!
                      .interest
                  : (preview.quote.instalments.find((x) => x.principal > 0n)
                      ?.total ?? preview.quote.instalments[0]!.total),
              )}
            </p>
            <p className="ui-help">
              {t(
                values.terms.method === 'sac'
                  ? 'firstPayment'
                  : values.terms.method === 'interest_only'
                    ? 'interestOnlyPayment'
                    : values.terms.method === 'bullet'
                      ? 'bulletPayment'
                      : 'regularPayment',
              )}
            </p>
            <dl className="preview-totals">
              {[
                ['total', formatMoney(preview.quote.total)],
                ['interestAndFees', formatMoney(preview.quote.cost)],
                ['disbursed', formatMoney(preview.quote.disbursed)],
                ['separate', formatMoney(preview.quote.separate)],
                ['annualRate', formatPercent(preview.quote.annualRate)],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{t(key!)}</dt>
                  <dd className="numeric">{value}</dd>
                </div>
              ))}
            </dl>
            {preview.quote.capitalisedInterest > 0n && (
              <p className="ui-help">
                {t('capitalisedInterest')}:{' '}
                {formatMoney(preview.quote.capitalisedInterest)}.{' '}
                {t('capitalisationHelp')}
              </p>
            )}
            <p className="ui-help">{t('annualHelp')}</p>
            <details>
              <summary>{t('schedule')}</summary>
              <Table
                label={t('schedule')}
                rows={preview.quote.instalments.map((row) => ({
                  ...row,
                  id: String(row.number),
                }))}
                columns={[
                  {
                    key: 'number',
                    heading: t('number'),
                    render: (row) => row.number,
                  },
                  {
                    key: 'date',
                    heading: t('date'),
                    render: (row) =>
                      new Intl.DateTimeFormat('pt-MZ', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Africa/Maputo',
                      }).format(new Date(`${row.dueDate}T00:00:00Z`)),
                  },
                  {
                    key: 'principal',
                    heading: t('principal'),
                    align: 'right',
                    render: (row) => formatMoney(row.principal),
                  },
                  {
                    key: 'interest',
                    heading: t('interest'),
                    align: 'right',
                    render: (row) => formatMoney(row.interest),
                  },
                  ...(preview.quote.capitalisedInterest > 0n
                    ? [
                        {
                          key: 'capitalisedInterest',
                          heading: t('capitalisedInterest'),
                          align: 'right' as const,
                          render: (row: Instalment) =>
                            formatMoney(row.capitalisedInterest),
                        },
                      ]
                    : []),
                  {
                    key: 'total',
                    heading: t('instalment'),
                    align: 'right',
                    render: (row) => formatMoney(row.total),
                  },
                ]}
              />
            </details>
          </>
        ) : (
          <p role="status" className="ui-help">
            {t('previewHelp')}
          </p>
        )}
      </section>
    </div>
  );
}
