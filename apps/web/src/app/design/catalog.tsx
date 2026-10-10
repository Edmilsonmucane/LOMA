'use client';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PaletteIcon,
  TextAaIcon,
  CursorClickIcon,
  TextAlignLeftIcon,
  TableIcon,
  SidebarSimpleIcon,
  SpinnerIcon,
  XIcon,
} from '@phosphor-icons/react';
import {
  Badge,
  Button,
  CommandPalette,
  Drawer,
  EmptyState,
  Field,
  Notice,
  Skeleton,
  Table,
  Tabs,
  useHydrated,
} from '@loma/ui';
import { contrastRatio, deriveBrandTokens } from '@loma/ui/theme';
const sections = [
  'colors',
  'type',
  'buttons',
  'fields',
  'tables',
  'panels',
  'states',
] as const;
const icons = [
  PaletteIcon,
  TextAaIcon,
  CursorClickIcon,
  TextAlignLeftIcon,
  TableIcon,
  SidebarSimpleIcon,
  SpinnerIcon,
  XIcon,
];
const clients = [
  {
    id: '1',
    name: 'Amélia Mucavele',
    area: 'Maputo · Hulene',
    status: 'current',
    balance: '24 500,00',
    tone: 'success',
  },
  {
    id: '2',
    name: 'Tomás Nhantumbo',
    area: 'Matola · Liberdade',
    status: 'dueToday',
    balance: '8 750,00',
    tone: 'warning',
  },
  {
    id: '3',
    name: 'Celina Macuácua',
    area: 'Beira · Macuti',
    status: 'overdue',
    balance: '12 400,00',
    tone: 'danger',
  },
] as const;
export default function DesignCatalog() {
  const hydrated = useHydrated();
  const t = useTranslations('Design');
  const [color, setColor] = useState('#0e5a4a');
  const [compact, setCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const brand = deriveBrandTokens(color);
  const style = {
    '--accent': brand.accent,
    '--on-accent': brand.onAccent,
    '--accent-hover': brand.accentHover,
    '--accent-soft': brand.accentSoft,
  } as CSSProperties;
  const scroll = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div style={style} className="catalog" data-ready={hydrated}>
      <a className="skip-link" href="#content">
        {t('skip')}
      </a>
      <header className="catalog-header">
        <Link href="/" className="wordmark">
          {t('brand')}
          <span className="wordmark-dot" />
        </Link>
        <div className="header-right">
          <span className="dev-label">{t('devOnly')}</span>
          <CommandPalette
            title={t('search')}
            description={t('searchHint')}
            searchLabel={t('searchHint')}
            emptyLabel={t('searchEmpty')}
            closeLabel={t('close')}
            trigger={
              <Button variant="secondary" aria-label={t('search')}>
                <MagnifyingGlassIcon aria-hidden />
                <span className="search-button-label">{t('search')}</span>
                <kbd>{t('shortcut')}</kbd>
              </Button>
            }
            items={[
              ...sections.map((id, index) => ({
                id,
                label: t(id),
                icon: icons[index]
                  ? (() => {
                      const Icon = icons[index]!;
                      return <Icon aria-hidden />;
                    })()
                  : undefined,
                onSelect: () => scroll(id),
              })),
              {
                id: 'client',
                label: t('commandAction'),
                icon: <PlusIcon aria-hidden />,
                onSelect: () => setDrawerOpen(true),
              },
            ]}
          />
        </div>
      </header>
      <div className="catalog-layout">
        <aside className="catalog-nav">
          <p className="eyebrow">{t('eyebrow')}</p>
          <nav aria-label={t('navLabel')}>
            {sections.map((id, index) => {
              const Icon = icons[index]!;
              return (
                <a href={`#${id}`} key={id}>
                  <Icon aria-hidden />
                  <span>{t(id)}</span>
                </a>
              );
            })}
          </nav>
          <p className="nav-note">{t('footer')}</p>
        </aside>
        <main id="content" className="catalog-main">
          <div className="catalog-intro">
            <p className="eyebrow">{t('eyebrow')}</p>
            <h1>{t('title')}</h1>
            <p>{t('intro')}</p>
          </div>
          <Section
            id="colors"
            index="01"
            title={t('colors')}
            description={t('colorsDescription')}
          >
            <div className="swatches">
              {['paper', 'surface', 'ink', 'muted', 'line', 'accent'].map(
                (token) => (
                  <div key={token}>
                    <div
                      className="swatch"
                      style={{ background: `var(--${token})` }}
                    />
                    <strong>{t(token)}</strong>
                    <code>
                      {token === 'accent'
                        ? color
                        : (
                            {
                              paper: '#F6F5F2',
                              surface: '#FFFFFF',
                              ink: '#15171A',
                              muted: '#6B6F76',
                              line: '#E7E5E0',
                            } as Record<string, string>
                          )[token]}
                    </code>
                  </div>
                ),
              )}
            </div>
            <div className="brand-preview">
              <div>
                <label className="ui-label" htmlFor="brand-color">
                  {t('brandColor')}
                </label>
                <div className="color-control">
                  <input
                    id="brand-color"
                    disabled={!hydrated}
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                  />
                  <code>{color.toUpperCase()}</code>
                </div>
                <p className="ui-help">{t('brandHelp')}</p>
              </div>
              <div className="brand-preview-action">
                <Button>
                  {t('preview')}
                  <ArrowRightIcon aria-hidden />
                </Button>
                <p className="ui-help numeric">
                  {t('contrast', {
                    ratio: contrastRatio(color, brand.onAccent).toFixed(2),
                  })}
                </p>
              </div>
            </div>
          </Section>
          <Section
            id="type"
            index="02"
            title={t('type')}
            description={t('typeDescription')}
          >
            <div className="type-pair">
              <div>
                <p className="eyebrow">{t('classic')}</p>
                <p className="editorial-title">{t('editorial')}</p>
              </div>
              <div>
                <p className="eyebrow">{t('modernLabel')}</p>
                <p className="modern-title">{t('modern')}</p>
              </div>
            </div>
            <div className="type-details">
              <div className="money-example">
                <p className="ui-help">{t('moneyLabel')}</p>
                <p className="numeric">
                  {t('money')} <span>{t('currency')}</span>
                </p>
                <div className="ui-help numeric">
                  {t('date')}
                  <span aria-hidden> · </span>
                  {t('phone')}
                </div>
              </div>
              <div className="type-scale">
                {[12, 13, 14, 16, 20, 28, 40].map((size) => (
                  <div key={size}>
                    <code>{size}</code>
                    <span
                      style={{
                        fontSize: `var(--text-${({ 12: 'xs', 13: 'sm', 14: 'base', 16: 'lg', 20: 'xl', 28: '2xl', 40: '3xl' } as Record<number, string>)[size]})`,
                      }}
                    >
                      {t('scaleSample')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
          <Section
            id="buttons"
            index="03"
            title={t('buttons')}
            description={t('buttonsDescription')}
          >
            <div className="button-showcase">
              <Button
                onClick={() => {
                  setDrawerOpen(true);
                  scroll('panels');
                }}
              >
                <PlusIcon aria-hidden />
                {t('primary')}
              </Button>
              <Button variant="secondary" onClick={() => scroll('tables')}>
                {t('secondary')}
              </Button>
              <Button variant="ghost" onClick={() => scroll('panels')}>
                {t('ghost')}
                <ArrowRightIcon aria-hidden />
              </Button>
              <Button
                variant="danger"
                onClick={() => setFeedback(t('demoSaved'))}
              >
                {t('danger')}
              </Button>
              <Button disabled>{t('disabled')}</Button>
              <Button loading>{t('loading')}</Button>
            </div>
            <p className="ui-help showcase-help">{t('hoverLabel')}</p>
          </Section>
          <Section
            id="fields"
            index="04"
            title={t('fields')}
            description={t('fieldsDescription')}
          >
            <div className="field-grid">
              <Field
                label={t('name')}
                placeholder={t('namePlaceholder')}
                help={t('nameHelp')}
                autoComplete="name"
              />
              <Field
                label={t('telephone')}
                defaultValue="84 123"
                error={t('telephoneError')}
                type="tel"
              />
              <Field
                label={t('amount')}
                help={t('amountHelp')}
                inputMode="decimal"
                placeholder={t('amountPlaceholder')}
              />
              <Field
                label={t('reference')}
                disabled
                help={t('referenceHelp')}
              />
              <Field label={t('readonly')} readOnly value={t('agency')} />
              <Field
                label={t('name')}
                required
                placeholder={t('namePlaceholder')}
                help={t('required')}
              />
            </div>
          </Section>
          <Section
            id="tables"
            index="05"
            title={t('tables')}
            description={t('tablesDescription')}
          >
            <label className="density-control">
              <input
                type="checkbox"
                disabled={!hydrated}
                checked={compact}
                onChange={(event) => setCompact(event.target.checked)}
              />
              {t('compact')}
            </label>
            <div className="table-frame">
              <Table
                label={t('tableLabel')}
                compact={compact}
                rows={[...clients]}
                columns={[
                  {
                    key: 'client',
                    heading: t('client'),
                    render: (row) => (
                      <div>
                        <strong className="client-name">{row.name}</strong>
                        <p className="ui-help">{row.area}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    heading: t('status'),
                    render: (row) => (
                      <Badge tone={row.tone}>{t(row.status)}</Badge>
                    ),
                  },
                  {
                    key: 'balance',
                    heading: t('balance'),
                    align: 'right',
                    render: (row) => row.balance,
                  },
                  {
                    key: 'action',
                    heading: t('rowActions'),
                    align: 'right',
                    render: (row) => (
                      <Button
                        variant="ghost"
                        className="ui-row-action"
                        aria-label={t('viewClient', { name: row.name })}
                        onClick={() => setDrawerOpen(true)}
                      >
                        <ArrowSquareOutIcon aria-hidden />
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
            <p className="ui-help showcase-help">{t('tableCaption')}</p>
          </Section>
          <Section
            id="panels"
            index="06"
            title={t('panels')}
            description={t('panelsDescription')}
          >
            <Tabs
              label={t('tabsLabel')}
              items={[
                {
                  value: 'general',
                  label: t('general'),
                  content: (
                    <div className="panel-example">
                      <div>
                        <h3>{t('drawerTitle')}</h3>
                        <p className="ui-help">{t('drawerDescription')}</p>
                      </div>
                      <Drawer
                        open={drawerOpen}
                        onOpenChange={setDrawerOpen}
                        title={t('drawerTitle')}
                        description={t('drawerDescription')}
                        closeLabel={t('close')}
                        trigger={
                          <Button>
                            <PlusIcon aria-hidden />
                            {t('openDrawer')}
                          </Button>
                        }
                      >
                        <form
                          className="drawer-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            setDrawerOpen(false);
                            setFeedback(t('demoSaved'));
                          }}
                        >
                          <Field
                            label={t('name')}
                            placeholder={t('namePlaceholder')}
                            required
                          />
                          <Field
                            label={t('telephone')}
                            type="tel"
                            placeholder={t('telephonePlaceholder')}
                            required
                          />
                          <Button type="submit">{t('saveDemo')}</Button>
                        </form>
                      </Drawer>
                    </div>
                  ),
                },
                {
                  value: 'documents',
                  label: t('documents'),
                  content: <p className="ui-help">{t('documentsText')}</p>,
                },
                {
                  value: 'history',
                  label: t('history'),
                  content: <p className="ui-help">{t('historyText')}</p>,
                },
                {
                  value: 'unavailable',
                  label: t('unavailableTab'),
                  content: null,
                  disabled: true,
                },
              ]}
            />
          </Section>
          <Section
            id="states"
            index="07"
            title={t('states')}
            description={t('statesDescription')}
          >
            <div className="badge-showcase" aria-label={t('badgesTitle')}>
              <Badge>{t('pending')}</Badge>
              <Badge tone="success">
                <CheckIcon aria-hidden />
                {t('current')}
              </Badge>
              <Badge tone="warning">{t('dueToday')}</Badge>
              <Badge tone="danger">{t('overdue')}</Badge>
              <Badge tone="success">{t('settled')}</Badge>
            </div>
            <div className="state-grid">
              <div className="state-panel">
                <h3>{t('loadingTitle')}</h3>
                <div
                  className="skeleton-card"
                  role="status"
                  aria-label={t('loadingLabel')}
                >
                  <Skeleton className="skeleton-title" />
                  {[1, 2, 3].map((index) => (
                    <div className="skeleton-row" key={index}>
                      <Skeleton className="skeleton-name" />
                      <Skeleton className="skeleton-value" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="state-panel">
                <EmptyState
                  title={t('emptyTitle')}
                  description={t('emptyDescription')}
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => setDrawerOpen(true)}
                    >
                      <PlusIcon aria-hidden />
                      {t('openDrawer')}
                    </Button>
                  }
                />
              </div>
            </div>
            <Notice
              title={t('errorTitle')}
              description={t('errorDescription')}
              action={
                <Button
                  variant="ghost"
                  onClick={() => setFeedback(t('retryStatus'))}
                >
                  {t('retry')}
                </Button>
              }
            />
            <div className="confirmation">
              <CheckIcon aria-hidden />
              <div>
                <strong>{t('readyTitle')}</strong>
                <p className="ui-help">{t('readyDescription')}</p>
              </div>
            </div>
          </Section>
          <footer className="catalog-footer">{t('footer')}</footer>
        </main>
      </div>
      <div aria-live="polite" className={feedback ? 'feedback' : 'sr-only'}>
        {feedback && (
          <>
            <CheckIcon aria-hidden />
            <span>{feedback}</span>
            <Button
              variant="ghost"
              aria-label={t('close')}
              onClick={() => setFeedback('')}
            >
              <XIcon aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
function Section({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="catalog-section"
      aria-labelledby={`${id}-title`}
    >
      <div className="section-heading">
        <span className="section-index numeric">{index}</span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="section-content">{children}</div>
    </section>
  );
}
