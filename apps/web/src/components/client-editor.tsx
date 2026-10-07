'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useForm,
  useFieldArray,
  Controller,
  type FieldPath,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Drawer, Field } from '@loma/ui';
import { parseMoney, formatMoney } from '@loma/loan-engine';
import {
  clientSchema,
  emptyClient,
  identityKinds,
  type ClientInput,
} from '@/lib/domain/clients';
import { saveClient } from '@/app/client-actions';
export function ClientEditor({
  branches,
  defaultBranch,
  initial,
  id,
  revision = 0,
}: {
  branches: { id: string; name: string }[];
  defaultBranch: string;
  initial?: ClientInput;
  id?: string | undefined;
  revision?: number;
}) {
  const t = useTranslations('Clients');
  const [open, setOpen] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t(id ? 'edit' : 'create')}
      description={t('formHelp')}
      closeLabel={t('close')}
      trigger={
        <Button variant={id ? 'secondary' : 'primary'}>
          {t(id ? 'edit' : 'create')}
        </Button>
      }
    >
      {open && (
        <Editor
          branches={branches}
          initial={initial ?? emptyClient(defaultBranch)}
          id={id}
          revision={revision}
          close={() => setOpen(false)}
        />
      )}
    </Drawer>
  );
}
function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(() =>
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
function Editor({
  branches,
  initial,
  id,
  revision,
  close,
}: {
  branches: { id: string; name: string }[];
  initial: ClientInput;
  id?: string | undefined;
  revision: number;
  close: () => void;
}) {
  const t = useTranslations('Clients');
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState('');
  const { register, control, handleSubmit } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: initial,
  });
  const identities = useFieldArray({ control, name: 'profile.identities' });
  const contacts = useFieldArray({ control, name: 'profile.contacts' });
  const references = useFieldArray({ control, name: 'profile.references' });
  const guarantors = useFieldArray({ control, name: 'profile.guarantors' });
  const field = (
    name: FieldPath<ClientInput>,
    label: string,
    type = 'text',
  ) => <Field key={name} label={t(label)} type={type} {...register(name)} />;
  return (
    <form
      className="client-form"
      onSubmit={handleSubmit(
        (values) => {
          setError('');
          startTransition(async () => {
            try {
              const result = await saveClient(values, {
                ...(id ? { id } : {}),
                revision,
              });
              if (!result.ok) {
                setError(result.error ?? 'failed');
                return;
              }
              close();
              if (!id) router.push(`/app/clients/${result.id}`);
              else router.refresh();
            } catch {
              setError('failed');
            }
          });
        },
        () => setError('invalid'),
      )}
    >
      {error && (
        <p className="form-error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      <div className="form-grid">
        {field('name', 'name')}
        <label className="ui-field">
          <span className="ui-label">{t('branch')}</span>
          <select className="ui-input" {...register('branch_id')}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {field('birth_date', 'birthDate', 'date')}
        <label className="ui-field">
          <span className="ui-label">{t('classification')}</span>
          <select className="ui-input" {...register('classification')}>
            {['regular', 'vip', 'blacklisted'].map((k) => (
              <option key={k} value={k}>
                {t(`classes.${k}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section>
        <h2>{t('contacts')}</h2>
        {contacts.fields.map((row, i) => (
          <div className="client-array-row" key={row.id}>
            <label className="ui-field">
              <span className="ui-label">{t('contactKind')}</span>
              <select
                className="ui-input"
                {...register(`profile.contacts.${i}.kind`)}
              >
                <option value="phone">{t('phone')}</option>
                <option value="email">{t('email')}</option>
              </select>
            </label>
            {field(`profile.contacts.${i}.value`, 'contactValue')}
            <Button
              variant="ghost"
              disabled={contacts.fields.length === 1}
              aria-label={t('removeContact', { number: i + 1 })}
              onClick={() => contacts.remove(i)}
            >
              {t('remove')}
            </Button>
          </div>
        ))}
        <p className="ui-help">{t('phoneHelp')}</p>
        <Button
          variant="ghost"
          onClick={() => contacts.append({ kind: 'phone', value: '' })}
        >
          {t('addContact')}
        </Button>
      </section>
      <details>
        <summary>{t('identification')}</summary>
        {identities.fields.map((row, i) => (
          <div className="client-array-row" key={row.id}>
            <label className="ui-field">
              <span className="ui-label">{t('identityKind')}</span>
              <select
                className="ui-input"
                {...register(`profile.identities.${i}.kind`)}
              >
                {identityKinds.map((k) => (
                  <option key={k} value={k}>
                    {t(`identities.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            {field(`profile.identities.${i}.value`, 'identityValue')}
            <Button
              variant="ghost"
              aria-label={t('removeIdentity', { number: i + 1 })}
              onClick={() => identities.remove(i)}
            >
              {t('remove')}
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => identities.append({ kind: 'bi', value: '' })}
        >
          {t('addIdentity')}
        </Button>
        <p className="ui-help">{t('duplicateHelp')}</p>
      </details>
      <details>
        <summary>{t('addressTitle')}</summary>
        <div className="form-grid">
          {(['province', 'district', 'neighbourhood', 'address'] as const).map(
            (k) => field(`profile.${k}`, k),
          )}
        </div>
      </details>
      <details>
        <summary>{t('activityTitle')}</summary>
        <div className="form-grid">
          {field('profile.activity', 'activity')}
          {field('profile.employer', 'employer')}
          {(['income', 'expenses'] as const).map((k) => (
            <Controller
              key={k}
              name={`profile.${k}`}
              control={control}
              render={({ field: f }) => (
                <MoneyField
                  label={t(k)}
                  value={f.value}
                  onChange={f.onChange}
                />
              )}
            />
          ))}
        </div>
      </details>
      {(
        [
          ['references', references],
          ['guarantors', guarantors],
        ] as const
      ).map(([kind, array]) => (
        <details key={kind}>
          <summary>{t(kind)}</summary>
          {array.fields.map((row, i) => (
            <div className="client-person-row" key={row.id}>
              {field(`profile.${kind}.${i}.name`, 'personName')}
              {field(`profile.${kind}.${i}.phone`, 'personPhone')}
              {field(`profile.${kind}.${i}.relationship`, 'relationship')}
              <Button
                variant="ghost"
                aria-label={t('removePerson', { number: i + 1 })}
                onClick={() => array.remove(i)}
              >
                {t('remove')}
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              array.append({ name: '', phone: '', relationship: '' })
            }
          >
            {t(kind === 'references' ? 'addReference' : 'addGuarantor')}
          </Button>
        </details>
      ))}
      <section>
        <h2>{t('consentTitle')}</h2>
        <p className="ui-help">{t('consentHelp')}</p>
        <div className="client-consent">
          {(['sms', 'whatsapp', 'email'] as const).map((k) => (
            <label key={k} className="switch-field">
              <input type="checkbox" {...register(`consent.${k}`)} />
              <span className="ui-label">{t(`channels.${k}`)}</span>
            </label>
          ))}
        </div>
        {field('consent.source', 'consentSource')}
      </section>
      <Button type="submit" loading={saving}>
        {t('save')}
      </Button>
    </form>
  );
}
