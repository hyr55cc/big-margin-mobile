import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Card, Icon, Notice, type IconName } from '@/components/ui';
import type { MessageKey } from '@/i18n';

export interface CalculatorDef {
  slug: string;
  icon: IconName;
  label: MessageKey;
  desc: MessageKey;
}

export const CALCULATORS: CalculatorDef[] = [
  { slug: 'average-cost', icon: 'calculator', label: 'calc.avgCost', desc: 'calc.avgCostDesc' },
  { slug: 'profit-loss', icon: 'activity', label: 'calc.pnl', desc: 'calc.pnlDesc' },
  { slug: 'break-even', icon: 'target', label: 'calc.breakeven', desc: 'calc.breakevenDesc' },
  { slug: 'target-price', icon: 'trophy', label: 'calc.target', desc: 'calc.targetDesc' },
  { slug: 'averaging', icon: 'layers', label: 'calc.averaging', desc: 'calc.averagingDesc' },
  { slug: 'dividend', icon: 'coins', label: 'calc.dividend', desc: 'calc.dividendDesc' },
  { slug: 'investment', icon: 'wallet', label: 'calc.investment', desc: 'calc.investmentDesc' },
  { slug: 'what-if', icon: 'zap', label: 'calc.whatif', desc: 'calc.whatifDesc' },
];

export default function Calculators() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="stack stack-5">
      <PageHead title={t('calc.title')} sub={t('calc.sub')} />

      <div className="grid grid-4">
        {CALCULATORS.map((c) => (
          <Card
            key={c.slug}
            className="card-pad"
            onClick={() => navigate(`/app/calculators/${c.slug}`)}
          >
            <div className="stack stack-3">
              <span
                className="brand-mark"
                style={{
                  background: 'var(--bm-brand-soft)',
                  color: 'var(--bm-brand)',
                  width: 34,
                  height: 34,
                }}
              >
                <Icon name={c.icon} size={17} />
              </span>
              <div className="stack" style={{ gap: 3 }}>
                <span className="h-card">{t(c.label)}</span>
                <span className="t-xs muted-3">{t(c.desc)}</span>
              </div>
              <span className="t-xs" style={{ color: 'var(--bm-brand)' }}>
                {t('calc.open')} →
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Notice tone="info">{t('calc.sub')}</Notice>

      <Disclaimers />
    </div>
  );
}
