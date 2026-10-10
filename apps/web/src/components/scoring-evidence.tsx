'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Drawer } from '@loma/ui';
import { saveEvidence } from '@/app/scoring-actions';
import type { z } from 'zod';
import type { evidenceSchema } from '@/lib/domain/scoring';
export function ScoringEvidence({
  client,
  initial,
}: {
  client: string;
  initial: z.infer<typeof evidenceSchema> | null;
}) {
  const t = useTranslations('Scoring'),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [error, setError] = useState(false),
    [pending, start] = useTransition();
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('evidenceTitle')}
      description={t('evidenceHelp')}
      closeLabel={t('close')}
      trigger={<Button variant="secondary">{t('editEvidence')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const r = await saveEvidence(client, {
              employmentMonths:
                f.get('employmentMonths') === ''
                  ? null
                  : Number(f.get('employmentMonths')),
              verifiedReferences:
                f.get('verifiedReferences') === ''
                  ? null
                  : Number(f.get('verifiedReferences')),
              note: f.get('note'),
            });
            if (!r.ok) setError(true);
            else {
              setOpen(false);
              router.refresh();
            }
          });
        }}
      >
        <label>
          {t('criteria.employmentMonths')}
          <input
            type="number"
            min="0"
            max="1200"
            aria-label={t('criteria.employmentMonths')}
            name="employmentMonths"
            defaultValue={initial?.employmentMonths ?? ''}
          />
        </label>
        <label>
          {t('criteria.verifiedReferences')}
          <input
            type="number"
            min="0"
            max="100"
            aria-label={t('criteria.verifiedReferences')}
            name="verifiedReferences"
            defaultValue={initial?.verifiedReferences ?? ''}
          />
        </label>
        <label>
          {t('evidenceNote')}
          <textarea
            aria-label={t('evidenceNote')}
            name="note"
            required
            minLength={2}
            maxLength={1000}
            defaultValue={initial?.note ?? ''}
          />
        </label>
        {error && <p role="alert">{t('errors.invalid')}</p>}
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </form>
    </Drawer>
  );
}
