'use client';
import { useEffect, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Drawer, Field } from '@loma/ui';
import {
  simulate,
  parseMoney,
  formatMoney,
  type Terms,
} from '@loma/loan-engine';
import {
  applicationSchema,
  type ApplicationInput,
} from '@/lib/domain/applications';
import { saveApplication } from '@/app/application-actions';
export type ProductOption = {
  id: string;
  name: string;
  versionId: string;
  terms: Terms;
};
export function ApplicationEditor({
  clients,
  products,
  initial,
  id,
  revision = 0,
}: {
  clients: { id: string; name: string }[];
  products: ProductOption[];
  initial?: ApplicationInput;
  id?: string;
  revision?: number;
}) {
  const t = useTranslations('Applications');
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      title={t(id ? 'edit' : 'create')}
      description={t('editorHelp')}
      closeLabel={t('close')}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant={id ? 'secondary' : 'primary'}
          disabled={!products.length || !clients.length}
        >
          {t(id ? 'edit' : 'create')}
        </Button>
      }
    >
      {open && (
        <Editor
          clients={clients}
          products={products}
          initial={initial}
          id={id}
          revision={revision}
          close={() => setOpen(false)}
        />
      )}
    </Drawer>
  );
}
function Editor({
  clients,
  products,
  initial,
  id,
  revision,
  close,
}: {
  clients: { id: string; name: string }[];
  products: ProductOption[];
  initial: ApplicationInput | undefined;
  id: string | undefined;
  revision: number;
  close: () => void;
}) {
  const t = useTranslations('Applications');
  const fieldId = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const p = products[0]!;
  const form = useForm<ApplicationInput>({
    resolver: zodResolver(applicationSchema),
    defaultValues: initial
      ? {
          ...initial,
          product_version_id:
            products.find((x) => x.id === initial.product_id)?.versionId ??
            initial.product_version_id,
        }
      : {
          client_id: clients[0]!.id,
          product_id: p.id,
          product_version_id: p.versionId,
          principal: p.terms.minPrincipal,
          periods: p.terms.minPeriods,
          start_date: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Maputo',
          }).format(new Date()),
          purpose: '',
          guarantees: [],
        },
  });
  const [clientQuery, setClientQuery] = useState('');
  const [foundClients, setFoundClients] = useState(clients);
  const [chosenClient, setChosenClient] = useState(
    clients.find((c) => c.id === (initial?.client_id ?? clients[0]?.id)),
  );
  const [lookupError, setLookupError] = useState(false);
  useEffect(() => {
    if (!clientQuery) {
      setFoundClients(clients);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/clients/search?q=${encodeURIComponent(clientQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const data = (await response.json()) as {
          clients: { id: string; name: string }[];
        };
        setFoundClients(data.clients);
        setLookupError(false);
      } catch {
        if (!controller.signal.aborted) setLookupError(true);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clientQuery, clients]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const input = form.watch();
  const selected = products.find((x) => x.id === input.product_id);
  let quote;
  try {
    if (selected)
      quote = simulate({
        principal: BigInt(input.principal),
        periods: input.periods,
        startDate: input.start_date,
        terms: selected.terms,
      });
  } catch {}
  return (
    <form
      className="drawer-form"
      onSubmit={form.handleSubmit((value) =>
        start(async () => {
          const result = await saveApplication(value, {
            revision,
            ...(id ? { id } : {}),
          });
          if (!result.ok) setError(result.error ?? 'invalid');
          else {
            close();
            router.push(`/app/applications/${result.id}`);
          }
        }),
      )}
    >
      <Field
        label={t('searchClient')}
        value={clientQuery}
        onChange={(e) => setClientQuery(e.target.value)}
      />
      {lookupError && (
        <p className="ui-error" role="alert">
          {t('loadError')}
        </p>
      )}
      <div className="ui-field">
        <label className="ui-label" htmlFor={`${fieldId}-client`}>
          {t('client')}
        </label>
        <select
          id={`${fieldId}-client`}
          className="ui-input"
          {...form.register('client_id')}
          onChange={(e) => {
            form.setValue('client_id', e.target.value);
            setChosenClient(
              [...clients, ...foundClients].find(
                (c) => c.id === e.target.value,
              ),
            );
          }}
        >
          {[
            ...new Map(
              [...(chosenClient ? [chosenClient] : []), ...foundClients].map(
                (c) => [c.id, c],
              ),
            ).values(),
          ].map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ui-field">
        <label className="ui-label" htmlFor={`${fieldId}-product`}>
          {t('product')}
        </label>
        <select
          id={`${fieldId}-product`}
          className="ui-input"
          {...form.register('product_id')}
          onChange={(e) => {
            form.setValue('product_id', e.target.value);
            const x = products.find((p) => p.id === e.target.value)!;
            form.setValue('product_version_id', x.versionId);
            form.setValue('principal', x.terms.minPrincipal);
            form.setValue('periods', x.terms.minPeriods);
            form.setValue('guarantees', []);
          }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <Controller
        control={form.control}
        name="principal"
        render={({ field }) => (
          <Amount
            key={input.product_id}
            label={t('amount')}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Field
        label={t('periods')}
        type="number"
        min={selected?.terms.minPeriods}
        max={selected?.terms.maxPeriods}
        {...form.register('periods', { valueAsNumber: true })}
      />
      <Field
        label={t('startDate')}
        help={t('dateHelp')}
        type="date"
        {...form.register('start_date')}
      />
      <Field label={t('purpose')} {...form.register('purpose')} />
      {selected?.terms.requirements.guarantees.map((g) => (
        <label className="switch-field" key={g}>
          <input
            type="checkbox"
            checked={input.guarantees.includes(g)}
            onChange={(e) =>
              form.setValue(
                'guarantees',
                e.target.checked
                  ? [...input.guarantees, g]
                  : input.guarantees.filter((x) => x !== g),
              )
            }
          />
          <span>{g}</span>
        </label>
      ))}
      <div className="client-section">
        <h2>{t('simulation')}</h2>
        {quote ? (
          <dl className="client-facts">
            <div>
              <dt>{t('payment')}</dt>
              <dd>
                {formatMoney(
                  quote.instalments.find((x) => x.total > 0n)?.total ?? 0n,
                )}
              </dd>
            </div>
            <div>
              <dt>{t('total')}</dt>
              <dd>{formatMoney(quote.total)}</dd>
            </div>
            <div>
              <dt>{t('disbursed')}</dt>
              <dd>{formatMoney(quote.disbursed)}</dd>
            </div>
          </dl>
        ) : (
          <p className="ui-error">{t('errors.invalid')}</p>
        )}
      </div>
      {(error || Object.keys(form.formState.errors).length > 0) && (
        <p role="alert" className="ui-error">
          {t(`errors.${error || 'invalid'}`)}
        </p>
      )}
      <Button type="submit" loading={pending} disabled={!quote}>
        {t('saveDraft')}
      </Button>
    </form>
  );
}
function Amount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(
    formatMoney(BigInt(value)).replace(' MT', ''),
  );
  return (
    <Field
      label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(parseMoney(e.target.value).toString());
        } catch {
          onChange('invalid');
        }
      }}
    />
  );
}
