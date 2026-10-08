import { getTranslations } from 'next-intl/server';
import { getTenantContext } from '@/lib/context';
import { can } from '@/lib/domain/tenancy';
import { scoreResultSchema } from '@/lib/domain/scoring';
import { ScoringEvidence } from './scoring-evidence';
import { formatMoney } from '@loma/loan-engine';
export async function ScorePanel({
  client,
  payment,
}: {
  client: string;
  payment?: string;
}) {
  const { db, tenant, permissions } = await getTenantContext();
  const t = await getTranslations('Scoring');
  if (!can(permissions, 'clients.read')) return null;
  const { data, error } = await db.rpc('client_score', {
    t: tenant.id,
    cid: client,
    ...(payment ? { payment } : {}),
  });
  if (error)
    return (
      <section className="client-section">
        <h2>{t('title')}</h2>
        <p>{t('unavailable')}</p>
      </section>
    );
  const score = scoreResultSchema.parse(data);
  return (
    <section className="client-section score-panel">
      <div className="report-toolbar">
        <div>
          <h2>{t('title')}</h2>
          <p className="score-value">
            {t('grade', { grade: score.class })}{' '}
            <span>{score.score.replace('.', ',')} / 100</span>
          </p>
          <p>
            {t('suggested', {
              value: formatMoney(BigInt(score.suggestedLimit)),
            })}
          </p>
        </div>
        {can(permissions, 'clients.manage') && (
          <ScoringEvidence client={client} initial={score.evidence} />
        )}
      </div>
      <p className="ui-help">
        {t(payment ? 'applicationEffect' : 'notApproval')}
      </p>
      <details>
        <summary>{t('why')}</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={t('why')}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('criterion')}</th>
                <th>{t('observed')}</th>
                <th>{t('points')}</th>
                <th>{t('weight')}</th>
              </tr>
            </thead>
            <tbody>
              {score.details.map((d) => (
                <tr key={d.key}>
                  <td>{t(`criteria.${d.key}`)}</td>
                  <td className="tabular">
                    {d.metric?.replace('.', ',') ?? t('missing')}
                  </td>
                  <td className="tabular">{d.points}</td>
                  <td className="tabular">{d.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
