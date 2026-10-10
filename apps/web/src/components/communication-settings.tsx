'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Field } from '@loma/ui';
import {
  saveCommunicationConfig,
  saveIntegration,
} from '@/app/communication-actions';
import { channels, rulesSchema } from '@/lib/domain/communications';
import type { z } from 'zod';
export function CommunicationRules({
  initial,
}: {
  initial: z.infer<typeof rulesSchema>;
}) {
  const t = useTranslations('Communications'),
    router = useRouter();
  const [value, setValue] = useState(initial),
    [buckets, setBuckets] = useState(initial.buckets.join(', ')),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [pending, start] = useTransition();
  return (
    <form
      className="drawer-form settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          const r = await saveCommunicationConfig({
            category: 'communication',
            key: 'rules',
            settings: {
              ...value,
              buckets: buckets.split(',').map((x) => Number(x.trim())),
            },
          });
          if (r.ok) {
            setSaved(true);
            setError('');
            router.refresh();
          } else setError(r.error);
        });
      }}
    >
      <Field
        label={t('timezone')}
        value={value.timezone}
        onChange={(e) => setValue({ ...value, timezone: e.target.value })}
      />
      {(
        [
          'startHour',
          'endHour',
          'maxPerDay',
          'maxAttempts',
          'retrySeconds',
        ] as const
      ).map((k) => (
        <Field
          key={k}
          label={t(k)}
          type="number"
          value={value[k]}
          min={k === 'startHour' ? 0 : 1}
          onChange={(e) => setValue({ ...value, [k]: Number(e.target.value) })}
        />
      ))}
      <Field
        label={t('optOutText')}
        value={value.optOutText}
        onChange={(e) => setValue({ ...value, optOutText: e.target.value })}
      />
      <Field
        label={t('buckets')}
        help={t('bucketsHelp')}
        value={buckets}
        onChange={(e) => setBuckets(e.target.value)}
      />
      <p>{t('rulesHelp')}</p>
      {error && (
        <p role="alert" className="form-error">
          {t(`errors.${error}`)}
        </p>
      )}
      {saved && <p role="status">{t('saved')}</p>}
      <Button type="submit" loading={pending}>
        {t('saveRules')}
      </Button>
    </form>
  );
}
export function IntegrationForm({
  channel,
  provider,
}: {
  channel: (typeof channels)[number];
  provider: string;
}) {
  const t = useTranslations('Communications');
  const [value, setValue] = useState({
      provider: provider as 'console' | 'http' | 'whatsapp',
      cost: '0',
      url: '',
      token: '',
      phoneId: '',
      graphVersion: '',
      webhookSecret: '',
      verifyToken: '',
    }),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [pending, start] = useTransition();
  return (
    <form
      className="drawer-form settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          const r = await saveIntegration({ channel, settings: value });
          if (r.ok) {
            setValue({
              ...value,
              token: '',
              webhookSecret: '',
              verifyToken: '',
            });
            setSaved(true);
            setError('');
          } else setError(r.error);
        });
      }}
    >
      <h2>{t(channel)}</h2>
      <label htmlFor={`provider-${channel}`}>{t('provider')}</label>
      <select
        id={`provider-${channel}`}
        value={value.provider}
        onChange={(e) =>
          setValue({
            ...value,
            provider: e.target.value as typeof value.provider,
          })
        }
      >
        <option value="console">{t('console')}</option>
        {channel === 'whatsapp' ? (
          <option value="whatsapp">{t('whatsappCloud')}</option>
        ) : (
          <option value="http">{t('http')}</option>
        )}
      </select>
      {value.provider !== 'console' && (
        <>
          <Field
            label={t('cost')}
            inputMode="numeric"
            value={value.cost}
            onChange={(e) => setValue({ ...value, cost: e.target.value })}
          />
          {value.provider === 'http' ? (
            <Field
              label={t('endpoint')}
              type="url"
              required
              value={value.url}
              onChange={(e) => setValue({ ...value, url: e.target.value })}
            />
          ) : (
            <>
              <Field
                label={t('phoneId')}
                required
                value={value.phoneId}
                onChange={(e) =>
                  setValue({ ...value, phoneId: e.target.value })
                }
              />
              <Field
                label={t('graphVersion')}
                required
                value={value.graphVersion}
                onChange={(e) =>
                  setValue({ ...value, graphVersion: e.target.value })
                }
              />
            </>
          )}
          <Field
            label={t('token')}
            help={t('tokenHelp')}
            type="password"
            autoComplete="new-password"
            required
            value={value.token}
            onChange={(e) => setValue({ ...value, token: e.target.value })}
          />
        </>
      )}
      {value.provider !== 'console' && (
        <>
          <Field
            label={t('webhookSecret')}
            help={t('webhookSecretHelp')}
            type="password"
            autoComplete="new-password"
            value={value.webhookSecret}
            onChange={(e) =>
              setValue({ ...value, webhookSecret: e.target.value })
            }
          />
          {channel === 'whatsapp' && (
            <Field
              label={t('verifyToken')}
              type="password"
              autoComplete="new-password"
              value={value.verifyToken}
              onChange={(e) =>
                setValue({ ...value, verifyToken: e.target.value })
              }
            />
          )}
        </>
      )}
      <p>{t('integrationHelp')}</p>
      <p>{t('integrationEffect')}</p>
      {error && (
        <p role="alert" className="form-error">
          {t(`errors.${error}`)}
        </p>
      )}
      {saved && <p role="status">{t('saved')}</p>}
      <Button type="submit" loading={pending}>
        {t('saveIntegration')}
      </Button>
    </form>
  );
}
