'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@loma/ui';
import { logout } from '@/app/actions';
export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations('App');
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await logout();
        router.push('/login');
        router.refresh();
      }}
    >
      {t('logout')}
    </Button>
  );
}
