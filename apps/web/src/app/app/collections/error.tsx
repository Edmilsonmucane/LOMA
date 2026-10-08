'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@loma/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('Communications');
  return (
    <div className="drawer-form">
      <p role="alert">{t('loadError')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
