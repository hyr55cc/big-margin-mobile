import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { useAlerts, deleteAlert, updateAlert, evaluateAlert, THRESHOLDLESS } from '@/store/watchlist';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  DataTable,
  Empty,
  IconBtn,
  Metric,
  Notice,
  V,
  type Column,
} from '@/components/ui';
import { AlertModal } from '@/components/portfolio/AlertModal';
import { DASH } from '@/lib/format';
import type { Alert } from '@/types';

interface AlertRow extends Alert {
  condition: boolean | null;
  price: number | null;
}

export default function Alerts() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { bySymbol } = useMarket();
  const alerts = useAlerts((s) => s.alerts);
  const [showNew, setShowNew] = useState(false);

  const rows: AlertRow[] = useMemo(
    () =>
      alerts.map((a) => {
        const row = bySymbol.get(a.symbol);
        return {
          ...a,
          price: row?.price ?? null,
          condition: evaluateAlert(a, {
            price: row?.price ?? null,
            changePct: row?.changePct ?? null,
            volume: row?.volume ?? null,
          }),
        };
      }),
    [alerts, bySymbol],
  );

  const triggered = rows.filter((r) => r.active && r.condition === true);

  const columns: Column<AlertRow>[] = [
    {
      key: 'symbol',
      label: t('g.symbol'),
      value: (a) => a.symbol,
      render: (a) => {
        const row = bySymbol.get(a.symbol);
        return (
          <span className="row row-3 clickable" onClick={() => navigate(`/app/stock/${a.symbol}`)}>
            <span className="sym">{a.symbol}</span>
            <span className="t-sm muted truncate">
              {row ? L(row.instrument.shortName) : ''}
            </span>
          </span>
        );
      },
    },
    {
      key: 'kind',
      label: t('al.kind'),
      value: (a) => a.kind,
      render: (a) => <Badge tone="outline">{t(`al.${a.kind}` as 'al.price_above')}</Badge>,
    },
    {
      key: 'threshold',
      label: t('al.threshold'),
      align: 'end',
      value: (a) => a.threshold,
      render: (a) =>
        THRESHOLDLESS.includes(a.kind) ? (
          <span className="muted-3">—</span>
        ) : (
          <V>{fmt.num(a.threshold)}</V>
        ),
    },
    {
      key: 'price',
      label: t('g.price'),
      align: 'end',
      value: (a) => a.price,
      render: (a) => <V>{fmt.num(a.price)}</V>,
    },
    {
      key: 'condition',
      label: t('g.status'),
      value: (a) => (a.condition === true ? 2 : a.condition === false ? 1 : 0),
      render: (a) => {
        if (!a.active) return <Badge tone="neutral">{t('al.paused')}</Badge>;
        if (a.condition === true) return <Badge tone="up" dot pulse>{t('al.triggered')}</Badge>;
        if (a.condition === false) return <Badge tone="outline">{t('al.active')}</Badge>;
        return <span className="unavailable">{t('status.unavailable')}</span>;
      },
    },
    {
      key: 'lastTriggered',
      label: t('al.lastTriggered'),
      align: 'end',
      value: (a) => a.lastTriggeredAt,
      render: (a) =>
        a.lastTriggeredAt ? (
          <span className="num t-sm">{fmt.dateTime(a.lastTriggeredAt)}</span>
        ) : (
          <span className="muted-3 t-sm">{t('al.never')}</span>
        ),
      optional: true,
    },
    { key: 'note', label: t('pf.note'), value: (a) => a.note, optional: true, defaultHidden: true },
    {
      key: 'actions',
      label: t('g.actions'),
      align: 'end',
      sortable: false,
      render: (a) => (
        <span className="row row-2 row-end">
          <IconBtn
            icon={a.active ? 'pause' : 'play'}
            title={a.active ? t('al.paused') : t('al.active')}
            onClick={() => updateAlert(a.id, { active: !a.active })}
          />
          <IconBtn icon="trash" title={t('g.delete')} onClick={() => deleteAlert(a.id)} />
        </span>
      ),
    },
  ];

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('al.title')}
        sub={t('al.sub')}
        right={
          <Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>
            {t('al.newAlert')}
          </Btn>
        }
      />

      <div className="grid grid-4">
        <Card className="card-pad">
          <Metric label={t('g.total')} value={fmt.int(alerts.length)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('al.active')}
            value={fmt.int(alerts.filter((a) => a.active).length)}
            size="xl"
          />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('al.triggered')}
            value={<span className="up">{fmt.int(triggered.length)}</span>}
            size="xl"
          />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('al.paused')}
            value={fmt.int(alerts.filter((a) => !a.active).length)}
            size="xl"
          />
        </Card>
      </div>

      {triggered.length > 0 && (
        <Notice tone="warn" icon="bell">
          {triggered.map((a) => `${a.symbol} · ${t(`al.${a.kind}` as 'al.price_above')} ${a.threshold ?? ''}`).join(' · ')}
        </Notice>
      )}

      <Card>
        <CardHead title={t('al.title')} icon="bell" />
        {alerts.length === 0 ? (
          <Empty
            icon="bell"
            title={t('al.empty')}
            desc={t('al.emptyHint')}
            action={
              <Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>
                {t('al.newAlert')}
              </Btn>
            }
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(a) => a.id}
            initialSort="condition"
            exportName="big-margin-alerts"
            pageSize={30}
          />
        )}
      </Card>

      <Notice tone="info">
        {t('al.sub')} {DASH} {t('set.notifications')}
      </Notice>

      <Disclaimers />

      <AlertModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
