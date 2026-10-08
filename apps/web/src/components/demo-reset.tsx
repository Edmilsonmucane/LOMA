'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button, Drawer } from '@loma/ui';
import { resetDemo } from '@/app/demo-actions';
export function DemoReset({ generation }: { generation: number }) {
  const t = useTranslations('Demo'),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [pending, start] = useTransition(),
    [error, setError] = useState('');
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('reset')}
      description={t('effect')}
      closeLabel={t('close')}
      trigger={<Button>{t('reset')}</Button>}
    >
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          start(async () => {
            const r = await resetDemo(generation);
            if (!r.ok) setError(t(`errors.${r.error}`));
            else {
              setOpen(false);
              router.refresh();
            }
          });
        }}
      >
        <p>{t('effect')}</p>
        <p>{t('console')}</p>
        <label className="public-checkbox">
          <input type="checkbox" required />
          {t('confirm')}
        </label>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={pending}>
          {t(pending ? 'resetting' : 'reset')}
        </Button>
      </form>
    </Drawer>
  );
}
