'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer, Field } from '@loma/ui';
import { parseMoney, formatMoney } from '@loma/loan-engine';
import { manageCash } from '@/app/payment-actions';
export function CashControl({
  branch,
  operation,
  expected = '0',
}: {
  branch: string;
  operation: 'open' | 'close' | 'deposit';
  expected?: string;
}) {
  const t = useTranslations('Cash');
  const p = useTranslations('Payments');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');
  const [pending, start] = useTransition();
  let difference: bigint | null = null;
  try {
    difference = parseMoney(value.replaceAll(' ', '')) - BigInt(expected);
  } catch {}
  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !requestId) setRequestId(crypto.randomUUID());
      }}
      title={t(operation)}
      description={t(
        operation === 'close'
          ? 'closingHelp'
          : operation === 'deposit'
            ? 'depositHelp'
            : 'help',
      )}
      closeLabel={t('closeDrawer')}
      trigger={
        <Button variant={operation === 'deposit' ? 'secondary' : 'primary'}>
          {t(operation)}
        </Button>
      }
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            let amount: string;
            try {
              amount = parseMoney(value.replaceAll(' ', '')).toString();
            } catch {
              setError('invalid');
              return;
            }
            const r = await manageCash({
              branch,
              operation,
              amount,
              reference,
              requestId: requestId || crypto.randomUUID(),
            });
            if (!r.ok) setError(r.error);
            else {
              setOpen(false);
              setRequestId('');
              router.refresh();
            }
          });
        }}
      >
        {operation === 'close' && (
          <dl className="payment-preview">
            <div>
              <dt>{t('expected')}</dt>
              <dd>{formatMoney(BigInt(expected))}</dd>
            </div>
          </dl>
        )}
        <Field
          label={t(
            operation === 'open'
              ? 'opening'
              : operation === 'close'
                ? 'counted'
                : 'amount',
          )}
          value={value}
          required
          inputMode="decimal"
          onChange={(e) => setValue(e.target.value)}
        />
        {operation === 'close' && difference !== null && (
          <dl className="payment-preview">
            <div>
              <dt>{t('difference')}</dt>
              <dd>{formatMoney(difference)}</dd>
            </div>
          </dl>
        )}
        {operation !== 'open' && (
          <Field
            label={t(operation === 'close' ? 'reason' : 'reference')}
            value={reference}
            required={operation === 'deposit' || difference !== 0n}
            maxLength={operation === 'deposit' ? 200 : 2000}
            onChange={(e) => setReference(e.target.value)}
          />
        )}
        {error && (
          <p className="ui-error" role="alert">
            {p(`errors.${error}`)}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {t('confirm')}
        </Button>
      </form>
    </Drawer>
  );
}
