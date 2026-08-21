import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { getProvider } from '@/data/registry';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Card,
  CardHead,
  DataTable,
  Seg,
  Select,
  StatusBadge,
  V,
  type Column,
} from '@/components/ui';
import { SymbolCell } from '@/components/market/cells';
import { DASH } from '@/lib/format';
import type { CorporateAction, CorporateActionKind, MarketId } from '@/types';

type Window = 'today' | 'week' | 'month' | 'upcoming' | 'all';

const KIND_TONE: Record<CorporateActionKind, 'up' | 'gold' | 'violet' | 'neutral' | 'down'> = {
  cash_dividend: 'up',
  stock_dividend: 'up',
  rights_issue: 'violet',
  capital_increase: 'violet',
  capital_reduction: 'down',
  split: 'gold',
  reverse_split: 'gold',
  share_grant: 'neutral',
  general_meeting: 'neutral',
};

const ALL_KINDS: CorporateActionKind[] = [
  'cash_dividend',
  'stock_dividend',
  'rights_issue',
  'capital_increase',
  'capital_reduction',
  'split',
  'reverse_split',
  'share_grant',
  'general_meeting',
];

function inWindow(date: string | null, win: Window): boolean {
  if (win === 'all') return true;
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  switch (win) {
    case 'today':
      return diffDays === 0;
    case 'week':
      return diffDays >= 0 && diffDays <= 7;
    case 'month':
      return diffDays >= 0 && diffDays <= 31;
    case 'upcoming':
      return diffDays >= 0;
  }
}

export default function CorporateActions() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { bySymbol } = useMarket();

  const [market, setMarket] = useState<MarketId | 'all'>('all');
  const [win, setWin] = useState<Window>('upcoming');
  const [kind, setKind] = useState<CorporateActionKind | 'all'>('all');

  const state = useAsync(() => getProvider().listCorporateActions({}), []);

  const rows = useMemo(() => {
    return (state.data ?? [])
      .filter((c) => market === 'all' || c.market === market)
      .filter((c) => kind === 'all' || c.kind === kind)
      .filter((c) => inWindow(c.effectiveDate, win))
      .sort((a, b) => ((a.effectiveDate ?? '') < (b.effectiveDate ?? '') ? -1 : 1));
  }, [state.data, market, kind, win]);

  const columns: Column<CorporateAction>[] = [
    {
      key: 'date',
      label: t('ca.effectiveDate'),
      align: 'end',
      value: (c) => c.effectiveDate,
      render: (c) => <V>{fmt.date(c.effectiveDate)}</V>,
      width: 120,
    },
    {
      key: 'symbol',
      label: t('g.company'),
      value: (c) => c.symbol,
      render: (c) => {
        const row = bySymbol.get(c.symbol);
        return row ? <SymbolCell row={row} showFlag /> : <span className="sym">{c.symbol}</span>;
      },
    },
    {
      key: 'kind',
      label: t('g.type'),
      value: (c) => c.kind,
      render: (c) => (
        <Badge tone={KIND_TONE[c.kind]}>{t(`ca.${c.kind}` as 'ca.split')}</Badge>
      ),
    },
    {
      key: 'detail',
      label: t('ca.detail'),
      value: (c) => L(c.detail),
      render: (c) => (
        <span className="muted" style={{ whiteSpace: 'normal', maxWidth: 420 }}>
          {L(c.detail)}
        </span>
      ),
    },
    {
      key: 'ratio',
      label: t('ca.ratio'),
      align: 'end',
      value: (c) => c.ratio,
      render: (c) => <V>{c.ratio ?? DASH}</V>,
    },
    {
      key: 'announced',
      label: t('div.declaredDate'),
      align: 'end',
      value: (c) => c.announcedDate,
      render: (c) => <V>{fmt.date(c.announcedDate)}</V>,
      optional: true,
    },
    {
      key: 'source',
      label: t('g.dataStatus'),
      align: 'end',
      value: (c) => c.provenance.status,
      render: (c) => <StatusBadge provenance={c.provenance} />,
      optional: true,
    },
  ];

  return (
    <div className="stack stack-5">
      <PageHead title={t('ca.title')} sub={t('ca.sub')} />

      <Card>
        <CardHead title={t('ca.title')} icon="briefcase" />
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          initialSort="date"
          initialDir="asc"
          onRowClick={(c) => navigate(`/app/stock/${c.symbol}`)}
          exportName="big-margin-corporate-actions"
          loading={state.loading}
          pageSize={30}
          toolbar={
            <>
              <Seg
                value={win}
                onChange={setWin}
                options={[
                  { value: 'today', label: t('g.today') },
                  { value: 'week', label: t('g.thisWeek') },
                  { value: 'month', label: t('g.thisMonth') },
                  { value: 'upcoming', label: t('g.upcoming') },
                  { value: 'all', label: t('g.all') },
                ]}
              />
              <Seg
                value={market}
                onChange={setMarket}
                options={[
                  { value: 'all', label: t('g.all') },
                  { value: 'SA', label: '🇸🇦' },
                  { value: 'US', label: '🇺🇸' },
                ]}
              />
              <Select
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'all', label: t('g.type') },
                  ...ALL_KINDS.map((k) => ({
                    value: k,
                    label: t(`ca.${k}` as 'ca.split'),
                  })),
                ]}
              />
            </>
          }
        />
      </Card>

      <Disclaimers />
    </div>
  );
}
