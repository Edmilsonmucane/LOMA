'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer, Field } from '@loma/ui';
import {
  transitionApplication,
  disburseApplication,
  saveContractTemplate,
} from '@/app/application-actions';
import { templateVariables } from '@/lib/domain/applications';
export function ApplicationControls({
  id,
  revision,
  status,
  canManage,
  canDecide,
  canDisburse,
  startDate,
  initialOpinion,
}: {
  id: string;
  revision: number;
  status: string;
  canManage: boolean;
  canDecide: boolean;
  canDisburse: boolean;
  startDate: string;
  initialOpinion: string;
}) {
  const t = useTranslations('Applications');
  const [note, setNote] = useState(initialOpinion);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const change = (status: string) =>
    start(async () => {
      setError('');
      const r = await transitionApplication({ id, revision, status, note });
      if (!r.ok) setError(r.error ?? 'invalid');
    });
  if (
    (!canManage ||
      !['draft', 'submitted', 'in_review', 'approved'].includes(status)) &&
    !(status === 'approved' && canDisburse) &&
    !error
  )
    return null;
  return (
    <section className="client-section">
      {canManage && (
        <>
          {status === 'draft' && (
            <Button loading={pending} onClick={() => change('submitted')}>
              {t('submit')}
            </Button>
          )}
          {status === 'submitted' && (
            <Button loading={pending} onClick={() => change('in_review')}>
              {t('review')}
            </Button>
          )}
          {status === 'in_review' && (
            <>
              <Field
                label={t('opinion')}
                help={t('decisionHelp')}
                value={note}
                maxLength={4000}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="form-actions">
                <Button
                  variant="secondary"
                  loading={pending}
                  onClick={() => change('in_review')}
                >
                  {t('saveOpinion')}
                </Button>
                {canDecide ? (
                  <>
                    <Button
                      loading={pending}
                      disabled={note.trim().length < 2}
                      onClick={() => change('approved')}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      variant="danger"
                      loading={pending}
                      disabled={note.trim().length < 2}
                      onClick={() => change('declined')}
                    >
                      {t('decline')}
                    </Button>
                  </>
                ) : (
                  <p className="ui-help">{t('anotherApprover')}</p>
                )}
              </div>
            </>
          )}
          {['draft', 'submitted', 'in_review', 'approved'].includes(status) && (
            <details>
              <summary>{t('more')}</summary>
              {['submitted', 'in_review'].includes(status) && (
                <Button
                  variant="secondary"
                  loading={pending}
                  onClick={() => change('draft')}
                >
                  {t('revise')}
                </Button>
              )}
              <p className="ui-help">{t('cancelHelp')}</p>
              <Button
                variant="ghost"
                loading={pending}
                onClick={() => change('cancelled')}
              >
                {t('cancel')}
              </Button>
            </details>
          )}
        </>
      )}
      {status === 'approved' && canDisburse && (
        <Disbursement id={id} revision={revision} startDate={startDate} />
      )}
      {error && (
        <p role="alert" className="ui-error">
          {t(`errors.${error}`)}
        </p>
      )}
    </section>
  );
}
function Disbursement({
  id,
  revision,
  startDate,
}: {
  id: string;
  revision: number;
  startDate: string;
}) {
  const t = useTranslations('Applications');
  const [open, setOpen] = useState(false);
  const [signed, setSigned] = useState(startDate);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('disburse')}
      description={t('disburseHelp')}
      closeLabel={t('close')}
      trigger={<Button>{t('disburse')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await disburseApplication({
              id,
              revision,
              method,
              reference,
              date: startDate,
              signed,
            });
            if (!r.ok) setError(r.error ?? 'invalid');
            else {
              setOpen(false);
              router.push(`/app/loans/${r.id}`);
            }
          });
        }}
      >
        <Field label={t('startDate')} type="date" value={startDate} readOnly />
        <Field
          label={t('signedOn')}
          type="date"
          value={signed}
          max={startDate}
          required
          onChange={(e) => setSigned(e.target.value)}
        />
        <label className="ui-field">
          <span className="ui-label">{t('method')}</span>
          <select
            className="ui-input"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {['cash', 'mpesa', 'emola', 'mkesh', 'transfer', 'deposit'].map(
              (x) => (
                <option key={x} value={x}>
                  {t(`methods.${x}`)}
                </option>
              ),
            )}
          </select>
        </label>
        <Field
          label={t('reference')}
          value={reference}
          required
          maxLength={200}
          onChange={(e) => setReference(e.target.value)}
        />
        <label className="switch-field">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{t('confirmSigned')}</span>
        </label>
        {error && (
          <p role="alert" className="ui-error">
            {t(`errors.${error}`)}
          </p>
        )}
        <Button
          type="submit"
          loading={pending}
          disabled={!confirmed || !reference.trim()}
        >
          {t('confirmDisburse')}
        </Button>
      </form>
    </Drawer>
  );
}
export function ContractTemplateEditor({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const t = useTranslations('Applications');
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
          const r = await saveContractTemplate({ title: heading, body: text });
          setError(r.ok ? '' : (r.error ?? 'invalid'));
          setSaved(r.ok);
        });
      }}
    >
      <p className="ui-help">{t('templateEffect')}</p>
      <Field
        label={t('templateTitle')}
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        required
        maxLength={150}
      />
      <label className="ui-field">
        <span className="ui-label">{t('templateBody')}</span>
        <textarea
          className="ui-input contract-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={20000}
        />
      </label>
      <p className="ui-help">
        {t('templateVariables')}{' '}
        {templateVariables.map((x) => `{${x}}`).join(' · ')}
      </p>
      {error && (
        <p role="alert" className="ui-error">
          {t(`errors.${error}`)}
        </p>
      )}
      {saved && <p role="status">{t('saved')}</p>}
      <Button type="submit" loading={pending}>
        {t('saveTemplate')}
      </Button>
    </form>
  );
}
