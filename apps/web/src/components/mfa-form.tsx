'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@loma/ui';
import { enrollMfa, verifyMfa } from '@/app/actions';
import { ActionForm } from './action-form';
export function MfaForm({ verifiedFactor }: { verifiedFactor?: string }) {
  const t = useTranslations('App');
  const [factor, setFactor] = useState(verifiedFactor ?? '');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="mfa-form">
      {!factor && (
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              const result = await enrollMfa();
              if (result.ok && result.factorId && result.qr) {
                setFactor(result.factorId);
                setQr(result.qr);
              } else setError(true);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('enrollMfa')}
        </Button>
      )}
      {error && (
        <p role="alert" className="ui-error">
          {t('errors.failed')}
        </p>
      )}
      {qr && (
        <>
          <p className="ui-help">{t('scanQr')}</p>
          <Image
            unoptimized
            src={qr}
            alt={t('qrAlt')}
            width={200}
            height={200}
          />
        </>
      )}
      {factor && (
        <ActionForm
          action={verifyMfa}
          submitLabel="verifyCode"
          fields={[
            { name: 'factorId', type: 'hidden', value: factor },
            { name: 'code', label: 'code', required: true },
          ]}
        />
      )}
    </div>
  );
}
