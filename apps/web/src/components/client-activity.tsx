'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer, Field } from '@loma/ui';
import { addClientNote } from '@/app/client-actions';
export function ClientActivity({ id }: { id: string }) {
  const t = useTranslations('Clients');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, startTransition] = useTransition();
  return (
    <form
      className="client-note"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        startTransition(async () => {
          try {
            const result = await addClientNote(id, note);
            if (!result.ok) setError(result.error ?? 'failed');
            else {
              setNote('');
              router.refresh();
            }
          } catch {
            setError('failed');
          }
        });
      }}
    >
      <label className="ui-field">
        <span className="ui-label">{t('note')}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={2}
          maxLength={2000}
          required
        />
      </label>
      {error && <p role="alert">{t(`errors.${error}`)}</p>}
      <Button type="submit" variant="secondary" loading={saving}>
        {t('addNote')}
      </Button>
    </form>
  );
}
export function ClientDocumentUpload({ id }: { id: string }) {
  const t = useTranslations('Clients');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, startTransition] = useTransition();
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('upload')}
      description={t('fileHelp')}
      closeLabel={t('close')}
      trigger={<Button variant="secondary">{t('upload')}</Button>}
    >
      <form
        className="client-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError('');
          startTransition(async () => {
            try {
              const response = await fetch(`/api/clients/${id}/documents`, {
                method: 'POST',
                body: data,
              });
              const result = await response.json();
              if (!response.ok) {
                setError(result.error ?? 'upload');
                return;
              }
              setOpen(false);
              router.refresh();
            } catch {
              setError('upload');
            }
          });
        }}
      >
        <Field label={t('documentTitle')} name="title" required minLength={2} />
        <label className="ui-field">
          <span className="ui-label">{t('documentKind')}</span>
          <select className="ui-input" name="kind">
            <option value="document">{t('document')}</option>
            <option value="photo">{t('photo')}</option>
          </select>
        </label>
        <Field label={t('expires')} name="expires_on" type="date" />
        <Field
          label={t('file')}
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
        />
        {error && <p role="alert">{t(`errors.${error}`)}</p>}
        <Button type="submit" loading={saving}>
          {t('upload')}
        </Button>
      </form>
    </Drawer>
  );
}
