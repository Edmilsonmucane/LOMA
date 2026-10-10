'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { saveSite } from '@/app/site-actions';
import type { SiteSettings } from '@/lib/domain/public-site';
import { Button } from '@loma/ui';
export function SiteEditor({ initial }: { initial: SiteSettings }) {
  const t = useTranslations('Public');
  const [settings, setSettings] = useState(initial),
    [expected, setExpected] = useState(initial),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [faq, setFaq] = useState(
    initial.faq.map((q) => `${q.question} | ${q.answer}`).join('\n'),
  );
  function text(
    key: 'title' | 'intro' | 'image' | 'terms' | 'privacy',
    v: string,
  ) {
    setSettings({ ...settings, [key]: v });
  }
  function move(i: number, offset: number) {
    const sections = [...settings.sections];
    const target = i + offset;
    if (target < 0 || target >= sections.length) return;
    [sections[i], sections[target]] = [sections[target]!, sections[i]!];
    setSettings({ ...settings, sections });
  }
  return (
    <div className="site-editor-grid">
      <form
        className="drawer-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          setMessage('');
          const value = {
            ...settings,
            faq: faq
              .split('\n')
              .filter(Boolean)
              .map((line) => {
                const i = line.indexOf('|');
                return {
                  question: line.slice(0, i).trim(),
                  answer: line.slice(i + 1).trim(),
                };
              }),
          };
          start(async () => {
            const result = await saveSite(value, expected);
            if (!result.ok) setError(t(`errors.${result.error}`));
            else {
              setExpected(value);
              setSettings(value);
              setMessage(t('siteSaved'));
            }
          });
        }}
      >
        <p className="ui-help">{t('siteEffect')}</p>
        <label className="public-checkbox">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) =>
              setSettings({ ...settings, enabled: e.target.checked })
            }
          />
          {t('enabled')}
        </label>
        <label>
          {t('theme')}
          <select
            value={settings.theme}
            onChange={(e) =>
              setSettings({
                ...settings,
                theme: e.target.value as SiteSettings['theme'],
              })
            }
          >
            <option value="classic">{t('classic')}</option>
            <option value="modern">{t('modern')}</option>
          </select>
        </label>
        {(['title', 'intro', 'image'] as const).map((key) => (
          <label key={key}>
            {t(key === 'title' ? 'heroTitle' : key)}
            <input
              type={key === 'image' ? 'url' : 'text'}
              value={settings[key]}
              required={key !== 'image'}
              onChange={(e) => text(key, e.target.value)}
              maxLength={key === 'title' ? 150 : 1000}
            />
          </label>
        ))}
        <fieldset>
          <legend>{t('sectionOrder')}</legend>
          {settings.sections.map((section, i) => (
            <div className="site-section-control" key={section}>
              <span>{t(`sections.${section}`)}</span>
              <Button
                variant="ghost"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`${t('moveUp')}: ${t(`sections.${section}`)}`}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                disabled={i === settings.sections.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`${t('moveDown')}: ${t(`sections.${section}`)}`}
              >
                ↓
              </Button>
            </div>
          ))}
        </fieldset>
        <label>
          {t('stepsText')}
          <textarea
            rows={4}
            value={settings.steps.join('\n')}
            onChange={(e) =>
              setSettings({ ...settings, steps: e.target.value.split('\n') })
            }
          />
        </label>
        <label>
          {t('faqText')}
          <textarea
            rows={5}
            value={faq}
            onChange={(e) => setFaq(e.target.value)}
          />
        </label>
        {(['terms', 'privacy'] as const).map((key) => (
          <label key={key}>
            {t(key)}
            <textarea
              rows={5}
              value={settings[key]}
              required
              onChange={(e) => text(key, e.target.value)}
            />
          </label>
        ))}
        <details>
          <summary>{t('limitsTitle')}</summary>
          {(
            Object.keys(settings.limits) as (keyof SiteSettings['limits'])[]
          ).map((key) => (
            <label key={key}>
              {t(key)}
              <input
                type="number"
                min={1}
                max={100}
                value={settings.limits[key]}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    limits: {
                      ...settings.limits,
                      [key]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </details>
        {error && (
          <p role="alert" className="ui-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <Button type="submit" loading={pending}>
          {t('saveSite')}
        </Button>
      </form>
      <aside
        className={`site-editor-preview public-site public-${settings.theme}`}
      >
        <p className="eyebrow">{t('preview')}</p>
        <h2>{settings.title}</h2>
        <p>{settings.intro}</p>
        <ol>
          {settings.sections.map((section) => (
            <li key={section}>{t(`sections.${section}`)}</li>
          ))}
        </ol>
        <a href="/" target="_blank" rel="noreferrer">
          {t('preview')} →
        </a>
      </aside>
    </div>
  );
}
