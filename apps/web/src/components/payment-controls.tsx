'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer, Field } from '@loma/ui';
import { formatMoney, parseMoney } from '@loma/loan-engine';
import {
  previewPayment,
  recordPayment,
  reversePayment,
  saveReceiptTemplate,
} from '@/app/payment-actions';
import {
  paymentMethods,
  receiptVariables,
  type PaymentPreview,
} from '@/lib/domain/payments';
export function PaymentDrawer({
  loan,
  suggested,
  client,
  canPay,
  initialOpen = false,
}: {
  loan: string;
  suggested: string;
  client: string;
  canPay: boolean;
  initialOpen?: boolean;
}) {
  const t = useTranslations('Payments');
  const a = useTranslations('Applications');
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [amount, setAmount] = useState(
    formatMoney(BigInt(suggested)).replace(/ MT$/, '').replaceAll(' ', ''),
  );
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [requestId, setRequestId] = useState('');
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [pending, start] = useTransition();
  if (!canPay) return null;
  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setPreview(null);
          setError('');
          setReceipt('');
          if (!requestId) setRequestId(crypto.randomUUID());
        }
      }}
      title={t('register')}
      description={client}
      closeLabel={t('close')}
      trigger={<Button>{t('register')}</Button>}
    >
      {receipt ? (
        <div className="drawer-form">
          <p role="status">{t('paid')}</p>
          <a
            className="ui-button ui-button-primary"
            href={`/api/receipts/${receipt}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('download')}
          </a>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t('done')}
          </Button>
        </div>
      ) : (
        <form
          className="drawer-form"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              let cents: string;
              try {
                cents = parseMoney(
                  amount.trim().replaceAll(' ', ''),
                ).toString();
              } catch {
                setError('invalid');
                return;
              }
              const id = requestId || crypto.randomUUID();
              if (!requestId) setRequestId(id);
              const ref =
                reference.trim() || (method === 'cash' ? `PAG-${id}` : '');
              if (!ref) {
                setError('invalid');
                return;
              }
              setError('');
              if (!preview) {
                const r = await previewPayment({ loan, amount: cents });
                if (!r.ok) setError(r.error);
                else setPreview(r.preview);
              } else {
                const r = await recordPayment({
                  loan,
                  amount: cents,
                  method,
                  reference: ref,
                  requestId: id,
                  revision: preview.revision,
                  day: preview.day,
                });
                if (!r.ok) {
                  setError(r.error);
                  if (r.error === 'stale') setPreview(null);
                } else {
                  setReceipt(r.id);
                  setRequestId('');
                  router.refresh();
                }
              }
            });
          }}
        >
          {!preview ? (
            <>
              <p className="ui-help">{t('paymentHelp')}</p>
              <Field
                label={t('amount')}
                value={amount}
                inputMode="decimal"
                required
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="ui-field">
                <label className="ui-label" htmlFor="payment-method">
                  {t('method')}
                </label>
                <select
                  id="payment-method"
                  className="ui-input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {paymentMethods.map((m) => (
                    <option value={m} key={m}>
                      {a(`methods.${m}`)}
                    </option>
                  ))}
                </select>
              </div>
              {method !== 'cash' && (
                <Field
                  label={t('reference')}
                  value={reference}
                  required
                  maxLength={200}
                  onChange={(e) => setReference(e.target.value)}
                />
              )}
            </>
          ) : (
            <>
              <h2>{t('allocation')}</h2>
              <dl className="payment-preview">
                <div>
                  <dt>{t('amount')}</dt>
                  <dd>
                    {formatMoney(parseMoney(amount.trim().replaceAll(' ', '')))}
                  </dd>
                </div>
                <div>
                  <dt>{t('method')}</dt>
                  <dd>{a(`methods.${method}`)}</dd>
                </div>
                {preview.allocations.map((r, i) => (
                  <div key={i}>
                    <dt>
                      {r.number === 0
                        ? t('separate')
                        : `${t('number')} ${r.number}`}{' '}
                      {r.number > 0 && <>· {t(r.component)}</>}
                    </dt>
                    <dd>{formatMoney(BigInt(r.amount))}</dd>
                  </div>
                ))}
                {BigInt(preview.credit) > 0n && (
                  <div>
                    <dt>{t('credit')}</dt>
                    <dd>{formatMoney(BigInt(preview.credit))}</dd>
                  </div>
                )}
              </dl>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                {t('back')}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="ui-error">
              {t(`errors.${error}`)}
            </p>
          )}
          <Button type="submit" loading={pending}>
            {t(preview ? 'confirm' : 'preview')}
          </Button>
        </form>
      )}
    </Drawer>
  );
}
export function ReverseDrawer({ id }: { id: string }) {
  const t = useTranslations('Payments');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('reverse')}
      description={t('reverseHelp')}
      closeLabel={t('close')}
      trigger={<Button variant="ghost">{t('reverse')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await reversePayment({ id, reason });
            if (!r.ok) setError(r.error);
            else {
              setOpen(false);
              router.refresh();
            }
          });
        }}
      >
        <Field
          label={t('reason')}
          value={reason}
          required
          minLength={2}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && (
          <p className="ui-error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        <Button type="submit" variant="danger" loading={pending}>
          {t('confirmReverse')}
        </Button>
      </form>
    </Drawer>
  );
}
export function ReceiptTemplateEditor({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const t = useTranslations('Payments');
  const [heading, setHeading] = useState(title);
  const [text, setText] = useState(body);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="drawer-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setSaved(false);
          setError('');
          const r = await saveReceiptTemplate({ title: heading, body: text });
          if (!r.ok) setError(r.error);
          else setSaved(true);
        });
      }}
    >
      <h2>{t('receiptTemplates')}</h2>
      <p className="ui-help">{t('templateHelp')}</p>
      <Field
        label={t('templateTitle')}
        value={heading}
        required
        onChange={(e) => setHeading(e.target.value)}
      />
      <div className="ui-field">
        <label className="ui-label" htmlFor="receipt-body">
          {t('templateBody')}
        </label>
        <textarea
          id="receipt-body"
          className="ui-input template-text"
          value={text}
          required
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <p className="ui-help">
        {t('variables')}: {receiptVariables.map((v) => `{${v}}`).join(' · ')}
      </p>
      {error && (
        <p className="ui-error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {saved && <p role="status">{t('saved')}</p>}
      <Button type="submit" loading={pending}>
        {t('save')}
      </Button>
    </form>
  );
}
