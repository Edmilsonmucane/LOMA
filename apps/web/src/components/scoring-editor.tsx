'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@loma/ui';
import { formatMoney, parseMoney } from '@loma/loan-engine';
import {
  evaluateScore,
  scoringSchema,
  type ScoringConfig,
} from '@/lib/domain/scoring';
import { saveScoring } from '@/app/scoring-actions';
export function ScoringEditor({
  initial,
  metrics,
  clientName,
}: {
  initial: ScoringConfig;
  metrics: Record<string, string | null>;
  clientName: string;
}) {
  const t = useTranslations('Scoring'),
    [cfg, setCfg] = useState(initial),
    [expected, setExpected] = useState(initial),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [pending, start] = useTransition();
  const valid = scoringSchema.safeParse(cfg);
  const preview = valid.success ? evaluateScore(valid.data, metrics) : null;
  function criterion(
    i: number,
    field: 'weight' | 'missingScore',
    value: number,
  ) {
    setCfg({
      ...cfg,
      criteria: cfg.criteria.map((c, j) =>
        i === j ? { ...c, [field]: value } : c,
      ),
    });
  }
  function band(i: number, j: number, field: 'until' | 'score', value: string) {
    setCfg({
      ...cfg,
      criteria: cfg.criteria.map((c, k) =>
        i === k
          ? {
              ...c,
              bands: c.bands.map((b, l) =>
                j === l
                  ? { ...b, [field]: field === 'score' ? Number(value) : value }
                  : b,
              ),
            }
          : c,
      ),
    });
  }
  return (
    <form
      className="scoring-editor"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        setSaved(false);
        start(async () => {
          const r = await saveScoring(cfg, expected);
          if (!r.ok) setError(t(`errors.${r.error}`));
          else {
            setExpected(cfg);
            setSaved(true);
          }
        });
      }}
    >
      <p>{t('effect')}</p>
      <aside className="score-preview" aria-live="polite">
        <h2>{t('preview', { name: clientName })}</h2>
        {preview ? (
          <>
            <p className="score-value">
              {t('grade', { grade: preview.class })}{' '}
              <span>{preview.score.replace('.', ',')} / 100</span>
            </p>
            <p>
              {t('suggested', {
                value: formatMoney(BigInt(preview.suggestedLimit)),
              })}
            </p>
          </>
        ) : (
          <p>{t('errors.invalid')}</p>
        )}
        <p className="ui-help">{t('notApproval')}</p>
      </aside>
      <h2>{t('criteriaTitle')}</h2>
      <p className="ui-help">{t('criteriaHelp')}</p>
      {cfg.criteria.map((c, i) => (
        <details key={c.key} className="score-criterion">
          <summary>
            {t(`criteria.${c.key}`)} · {t('weightValue', { value: c.weight })}
          </summary>
          <div className="score-fields">
            <label>
              {t('weight')}
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={c.weight}
                onChange={(e) => criterion(i, 'weight', Number(e.target.value))}
              />
            </label>
            <label>
              {t('missingScore')}
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={c.missingScore}
                onChange={(e) =>
                  criterion(i, 'missingScore', Number(e.target.value))
                }
              />
            </label>
          </div>
          <div className="score-bands">
            {c.bands.map((b, j) => (
              <div className="score-fields" key={j}>
                <label>
                  {b.until === null ? t('above') : t('until')}
                  <input
                    aria-label={t('until')}
                    value={b.until === null ? t('remaining') : b.until}
                    disabled={b.until === null}
                    inputMode="decimal"
                    onChange={(e) =>
                      band(i, j, 'until', e.target.value.replace(',', '.'))
                    }
                  />
                </label>
                <label>
                  {t('points')}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={b.score}
                    onChange={(e) => band(i, j, 'score', e.target.value)}
                  />
                </label>
                {b.until !== null && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setCfg({
                        ...cfg,
                        criteria: cfg.criteria.map((x, k) =>
                          i === k
                            ? { ...x, bands: x.bands.filter((_, l) => l !== j) }
                            : x,
                        ),
                      })
                    }
                  >
                    {t('removeInterval')}
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              disabled={c.bands.length >= 12}
              onClick={() =>
                setCfg({
                  ...cfg,
                  criteria: cfg.criteria.map((x, k) =>
                    i === k
                      ? {
                          ...x,
                          bands: [
                            ...x.bands.slice(0, -1),
                            { until: '', score: 50 },
                            x.bands.at(-1)!,
                          ],
                        }
                      : x,
                  ),
                })
              }
            >
              {t('addInterval')}
            </Button>
          </div>
        </details>
      ))}
      <h2>{t('classesTitle')}</h2>
      <p className="ui-help">{t('classesHelp')}</p>
      {cfg.classes.map((c, i) => (
        <div className="score-fields" key={c.key}>
          <strong>{t('grade', { grade: c.key })}</strong>
          <label>
            {t('minimum')}
            <input
              type="number"
              min="0"
              max="100"
              value={c.minScore}
              disabled={i === 4}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  classes: cfg.classes.map((x, j) =>
                    i === j ? { ...x, minScore: Number(e.target.value) } : x,
                  ),
                })
              }
            />
          </label>
          <label>
            {t('limit')}
            <input
              inputMode="decimal"
              defaultValue={formatMoney(BigInt(c.suggestedLimit)).replace(
                ' MT',
                '',
              )}
              onChange={(e) => {
                try {
                  const n = parseMoney(e.target.value).toString();
                  e.target.setCustomValidity('');
                  setCfg({
                    ...cfg,
                    classes: cfg.classes.map((x, j) =>
                      i === j ? { ...x, suggestedLimit: n } : x,
                    ),
                  });
                } catch {
                  e.target.setCustomValidity(t('errors.invalid'));
                  setError(t('errors.invalid'));
                }
              }}
            />
          </label>
        </div>
      ))}
      <h2>{t('provisionsTitle')}</h2>
      <p className="ui-help">{t('provisionsHelp')}</p>
      <label>
        {t('basis')}
        <select
          value={cfg.provisionBasis}
          onChange={(e) =>
            setCfg({
              ...cfg,
              provisionBasis: e.target.value as ScoringConfig['provisionBasis'],
            })
          }
        >
          <option value="principal">{t('principal')}</option>
          <option value="balance">{t('balance')}</option>
        </select>
      </label>
      {cfg.provisions.map((p, i) => (
        <div className="score-fields" key={i}>
          <label>
            {t('tierName')}
            <input
              value={p.name}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  provisions: cfg.provisions.map((x, j) =>
                    i === j ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <label>
            {t('fromDays')}
            <input
              type="number"
              min="0"
              max="36500"
              disabled={i === 0}
              value={p.fromDays}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  provisions: cfg.provisions.map((x, j) =>
                    i === j ? { ...x, fromDays: Number(e.target.value) } : x,
                  ),
                })
              }
            />
          </label>
          <label>
            {t('percentage')}
            <input
              inputMode="decimal"
              value={p.percentage}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  provisions: cfg.provisions.map((x, j) =>
                    i === j
                      ? { ...x, percentage: e.target.value.replace(',', '.') }
                      : x,
                  ),
                })
              }
            />
          </label>
          {i > 0 && (
            <Button
              variant="ghost"
              onClick={() =>
                setCfg({
                  ...cfg,
                  provisions: cfg.provisions.filter((_, j) => i !== j),
                })
              }
            >
              {t('removeTier')}
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={cfg.provisions.length >= 12}
        onClick={() =>
          setCfg({
            ...cfg,
            provisions: [
              ...cfg.provisions,
              {
                name: '',
                fromDays: cfg.provisions.at(-1)!.fromDays + 1,
                percentage: '0',
              },
            ],
          })
        }
      >
        {t('addTier')}
      </Button>
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}
      {saved && <p role="status">{t('saved')}</p>}
      <Button type="submit" disabled={pending || !valid.success}>
        {t(pending ? 'saving' : 'save')}
      </Button>
    </form>
  );
}
