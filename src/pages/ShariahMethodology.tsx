import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, CardHead, Notice, Seg, Metric, Btn } from '@/components/ui';

export default function ShariahMethodology() {
  const { id } = useParams();
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { methodologies, rows } = useMarket();

  const active = methodologies.find((m) => m.id === id) ?? methodologies[0];

  if (!active) {
    return (
      <div className="stack stack-5">
        <PageHead title={t('sh.methodologyPage')} />
        <Notice>{t('g.unavailable')}</Notice>
      </div>
    );
  }

  const screened = rows.filter((r) => r.screening != null);

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('sh.methodologyPage')}
        sub={t('sh.comparisonSub')}
        right={
          <Seg
            value={active.id}
            onChange={(v) => navigate(`/app/shariah/methodology/${v}`)}
            options={methodologies.map((m) => ({ value: m.id, label: m.shortName }))}
          />
        }
      />

      <Notice tone="warn" icon="warning">
        {t('sh.disclaimer')}
      </Notice>

      <Card>
        <CardHead
          title={L(active.name)}
          sub={active.shortName}
          icon="crescent"
          right={
            active.sourceUrl && (
              <Btn
                size="sm"
                icon="external"
                onClick={() => window.open(active.sourceUrl as string, '_blank', 'noopener')}
              >
                {active.sourceName}
              </Btn>
            )
          }
        />
        <div className="card-body stack stack-5">
          <p className="muted" style={{ lineHeight: 1.8, maxWidth: '80ch' }}>
            {L(active.description)}
          </p>

          <div className="metric-grid">
            <Metric label={t('g.source')} value={<span className="t-lg">{active.sourceName}</span>} size="sm" />
            <Metric label={t('g.lastUpdated')} value={fmt.date(active.lastUpdated)} size="sm" />
            <Metric label={t('sh.rules')} value={fmt.int(active.rules.length)} size="sm" />
            <Metric
              label={t('weight.constituents')}
              value={fmt.int(screened.length)}
              size="sm"
              sub={t('sh.screeningDate')}
            />
          </div>

          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th>{t('sh.rules')}</th>
                  <th className="num-col">{t('sh.threshold')}</th>
                  <th>{t('sh.basis')}</th>
                </tr>
              </thead>
              <tbody>
                {active.rules.map((r) => (
                  <tr key={r.key}>
                    <td style={{ whiteSpace: 'normal', minWidth: 180 }}>{L(r.label)}</td>
                    <td className="num-col num">{r.threshold}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 520, lineHeight: 1.7 }} className="muted">
                      {L(r.basis)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title={t('sh.comparison')} sub={t('sh.comparisonSub')} icon="compare" />
        <div className="table-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>{t('g.methodology')}</th>
                <th className="num-col">{t('sh.ratios')}</th>
                <th>{t('g.source')}</th>
                <th className="num-col">{t('g.lastUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {methodologies.map((m) => (
                <tr
                  key={m.id}
                  className="clickable"
                  onClick={() => navigate(`/app/shariah/methodology/${m.id}`)}
                >
                  <td>
                    <span className="co-name">
                      <span className="n1">{m.shortName}</span>
                      <span className="n2">{L(m.name)}</span>
                    </span>
                  </td>
                  <td className="num-col">
                    <span className="row row-2 row-end">
                      {m.rules
                        .filter((r) => r.threshold !== '—')
                        .map((r) => (
                          <span key={r.key} className="badge badge-outline num">
                            {r.threshold}
                          </span>
                        ))}
                    </span>
                  </td>
                  <td className="t-sm muted">{m.sourceName}</td>
                  <td className="num-col num muted">{fmt.date(m.lastUpdated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Disclaimers shariah />
    </div>
  );
}
