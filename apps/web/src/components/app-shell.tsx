'use client';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, CommandPalette, Drawer } from '@loma/ui';
import {
  CalendarBlankIcon,
  UsersIcon,
  TrayIcon,
  NotebookIcon,
  PhoneIcon,
  ChatTextIcon,
  ChartBarIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  ListIcon,
  SignOutIcon,
} from '@phosphor-icons/react';
import { can, type Permission } from '@/lib/domain/tenancy';
import { logout } from '@/app/actions';
const modules = [
  ['today', '/app', CalendarBlankIcon],
  ['clients', '/app/clients', UsersIcon],
  ['applications', '/app/applications', TrayIcon],
  ['loans', '/app/loans', NotebookIcon],
  ['collections', '/app/collections', PhoneIcon],
  ['messages', '/app/messages', ChatTextIcon],
] as const;
export function AppShell({
  name,
  logoUrl,
  footer,
  person,
  branch,
  canManage,
  canAudit,
  permissions,
  searchItems,
  children,
}: {
  name: string;
  logoUrl: string | null;
  footer: string;
  person: string;
  branch: string;
  canManage: boolean;
  canAudit: boolean;
  permissions: readonly string[];
  searchItems: { id: string; label: string; path: string }[];
  children: React.ReactNode;
}) {
  const t = useTranslations('App');
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = (
    <>
      <nav aria-label={t('navigation')} className="app-nav">
        {modules
          .filter(([key]) =>
            can(
              permissions,
              (
                {
                  today: 'tenant.read',
                  clients: 'clients.read',
                  applications: 'applications.read',
                  loans: 'loans.read',
                  collections: 'collections.manage',
                  messages: 'messages.manage',
                } as Record<string, Permission>
              )[key]!,
            ),
          )
          .map(([key, url, Icon]) => (
            <Link
              key={key}
              href={url}
              onClick={() => setMenuOpen(false)}
              aria-current={path === url ? 'page' : undefined}
            >
              <Icon aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          ))}
      </nav>
      <nav aria-label={t('administration')} className="app-nav app-nav-bottom">
        {can(permissions, 'reports.read') && (
          <Link href="/app/reports" onClick={() => setMenuOpen(false)}>
            <ChartBarIcon aria-hidden />
            {t('nav.reports')}
          </Link>
        )}
        <Link
          href="/app/settings"
          onClick={() => setMenuOpen(false)}
          aria-current={path.startsWith('/app/settings') ? 'page' : undefined}
        >
          <GearSixIcon aria-hidden />
          {t('nav.settings')}
        </Link>
      </nav>
    </>
  );
  return (
    <div className="app-shell">
      <a href="#app-content" className="skip-link">
        {t('skip')}
      </a>
      <aside className="app-sidebar">
        <Link href="/app" className="app-brand">
          {logoUrl && (
            <Image unoptimized src={logoUrl} alt="" width={32} height={32} />
          )}
          <span>{name}</span>
        </Link>
        <p className="ui-help">{branch}</p>
        {nav}
        <div className="app-person">
          <span>{person}</span>
          <Button
            variant="ghost"
            aria-label={t('logout')}
            onClick={async () => {
              const result = await logout();
              if (result.redirect) router.push(result.redirect);
              router.refresh();
            }}
          >
            <SignOutIcon aria-hidden />
          </Button>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div className="mobile-navigation">
            <Drawer
              open={menuOpen}
              onOpenChange={setMenuOpen}
              title={name}
              description={branch}
              closeLabel={t('close')}
              trigger={
                <Button variant="ghost" aria-label={t('navigation')}>
                  <ListIcon aria-hidden />
                </Button>
              }
            >
              {nav}
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
            </Drawer>
            <strong>{name}</strong>
          </div>
          <CommandPalette
            title={t('search')}
            description={t('searchHelp')}
            searchLabel={t('searchHelp')}
            emptyLabel={t('searchEmpty')}
            closeLabel={t('close')}
            trigger={
              <Button variant="ghost" aria-label={t('search')}>
                <MagnifyingGlassIcon aria-hidden />
                <span>{t('search')}</span>
                <kbd>{t('shortcut')}</kbd>
              </Button>
            }
            items={[
              {
                id: 'today',
                label: t('nav.today'),
                onSelect: () => router.push('/app'),
              },
              {
                id: 'settings',
                label: t('nav.settings'),
                onSelect: () => router.push('/app/settings'),
              },
              ...(canManage
                ? [
                    {
                      id: 'team',
                      label: t('team'),
                      onSelect: () => router.push('/app/settings/team'),
                    },
                    {
                      id: 'brand',
                      label: t('brand'),
                      onSelect: () => router.push('/app/settings/brand'),
                    },
                  ]
                : []),
              ...(canAudit
                ? [
                    {
                      id: 'audit',
                      label: t('audit'),
                      onSelect: () => router.push('/app/settings/audit'),
                    },
                  ]
                : []),
              ...searchItems.map((item) => ({
                id: item.id,
                label: item.label,
                onSelect: () => router.push(item.path),
              })),
            ]}
          />
        </header>
        <main id="app-content" className="app-content">
          {children}
          {footer && <p className="ui-help initial-note">{footer}</p>}
        </main>
      </div>
    </div>
  );
}
