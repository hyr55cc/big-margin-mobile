import { useI18n } from '@/i18n';
import { useAsync, useFmt } from '@/lib/hooks';
import { getProvider } from '@/data/registry';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  DataTable,
  Empty,
  Metric,
  Notice,
  V,
  type Column,
} from '@/components/ui';
import type { SyncJobStatus, ValidationIssue } from '@/data/provider';

const STATE_TONE: Record<SyncJobStatus['state'], 'up' | 'gold' | 'down' | 'neutral'> = {
  ok: 'up',
  stale: 'gold',
  failed: 'down',
  never_run: 'neutral',
};

export default function Admin() {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { refresh, rows, methodologies, indices } = useMarket();

  const provider = getProvider();
  const sync = useAsync(() => provider.getSyncStatus(), []);
  const issues = useAsync(() => provider.getValidationIssues(), []);

  const syncColumns: Column<SyncJobStatus>[] = [
    {
      key: 'job',
      label: t('adm.job'),
      value: (j) => L(j.label),
      render: (j) => (
        <span className="co-name">
          <span className="n1">{L(j.label)}</span>
          <span className="n2 mono">{j.id}</span>
        </span>
      ),
    },
    { key: 'schedule', label: 'cron', value: (j) => j.schedule, render: (j) => <span className="mono t-sm">{j.schedule}</span> },
    {
      key: 'state',
      label: t('g.status'),
      value: (j) => j.state,
      render: (j) => <Badge tone={STATE_TONE[j.state]}>{j.state}</Badge>,
    },
    {
      key: 'records',
      label: t('adm.records'),
      align: 'end',
      value: (j) => j.records,
      render: (j) => <V>{fmt.int(j.records)}</V>,
    },
    {
      key: 'last',
      label: t('adm.lastRun'),
      align: 'end',
      value: (j) => j.lastRunAt,
      render: (j) => <V>{fmt.dateTime(j.lastRunAt)}</V>,
    },
    {
      key: 'next',
      label: t('adm.nextRun'),
      align: 'end',
      value: (j) => j.nextRunAt,
      render: (j) => <V>{fmt.dateTime(j.nextRunAt)}</V>,
    },
    { key: 'message', label: t('adm.message'), value: (j) => j.message ?? null, optional: true },
  ];

  const issueColumns: Column<ValidationIssue>[] = [
    {
      key: 'severity',
      label: t('adm.severity'),
      value: (i) => i.severity,
      render: (i) => (
        <Badge tone={i.severity === 'error' ? 'down' : 'gold'}>{i.severity}</Badge>
      ),
    },
    { key: 'entity', label: 'entity', value: (i) => i.entity },
    { key: 'record', label: 'record', value: (i) => i.recordId, render: (i) => <span className="mono">{i.recordId}</span> },
    { key: 'field', label: t('adm.field'), value: (i) => i.field, render: (i) => <span className="mono t-sm">{i.field}</span> },
    {
      key: 'message',
      label: t('adm.message'),
      value: (i) => L(i.message),
      render: (i) => (
        <span style={{ whiteSpace: 'normal', maxWidth: 480 }} className="muted">
          {L(i.message)}
        </span>
      ),
    },
    {
      key: 'detected',
      label: t('g.date'),
      align: 'end',
      value: (i) => i.detectedAt,
      render: (i) => <span className="num t-sm">{fmt.dateTime(i.detectedAt)}</span>,
    },
  ];

  const errors = (issues.data ?? []).filter((i) => i.severity === 'error');
  const warnings = (issues.data ?? []).filter((i) => i.severity === 'warning');

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('adm.title')}
        sub={t('adm.sub')}
        right={
          <Btn
            variant="primary"
            icon="refresh"
            onClick={() => {
              refresh();
              sync.reload();
              issues.reload();
            }}
          >
            {t('adm.runSync')}
          </Btn>
        }
      />

      <Notice tone="warn" icon="warning">
        {t('adm.readOnly')}
      </Notice>

      <div className="grid grid-4">
        <Card className="card-pad">
          <Metric label={t('set.provider')} value={<span className="t-lg">{provider.info.name}</span>} size="sm" />
        </Card>
        <Card className="card-pad">
          <Metric label={t('weight.constituents')} value={fmt.int(rows.length)} size="xl" />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('adm.validation')}
            value={<span className={errors.length ? 'down' : 'up'}>{fmt.int(errors.length)}</span>}
            size="xl"
            sub={`${fmt.int(warnings.length)} warnings`}
          />
        </Card>
        <Card className="card-pad">
          <Metric
            label={t('g.methodology')}
            value={fmt.int(methodologies.length)}
            size="xl"
            sub={`${indices.length} indices`}
          />
        </Card>
      </div>

      <Card>
        <CardHead title={t('adm.providers')} icon="database" />
        <div className="card-body stack stack-3">
          <div className="row row-between">
            <span className="muted">{provider.info.id}</span>
            <Badge tone={provider.info.production ? 'up' : 'gold'}>
              {provider.info.production ? t('status.live') : t('g.demo')}
            </Badge>
          </div>
          <p className="t-sm muted" style={{ lineHeight: 1.8 }}>
            {provider.info.description}
          </p>
          <div className="row row-2 row-wrap">
            {Object.entries(provider.info.capabilities).map(([k, on]) => (
              <Badge key={k} tone={on ? 'brand' : 'neutral'}>
                {k}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title={t('adm.syncJobs')} icon="refresh" />
        <DataTable
          rows={sync.data ?? []}
          columns={syncColumns}
          rowKey={(j) => j.id}
          initialSort="last"
          loading={sync.loading}
          exportName="big-margin-sync"
          pageSize={20}
        />
      </Card>

      <Card>
        <CardHead
          title={t('adm.validation')}
          icon="warning"
          right={
            <Badge tone={errors.length ? 'down' : 'up'}>
              {fmt.int((issues.data ?? []).length)}
            </Badge>
          }
        />
        {issues.data && issues.data.length === 0 ? (
          <Empty icon="check" title={t('adm.noErrors')} />
        ) : (
          <DataTable
            rows={issues.data ?? []}
            columns={issueColumns}
            rowKey={(i) => i.id}
            initialSort="severity"
            loading={issues.loading}
            exportName="big-margin-validation"
            pageSize={25}
          />
        )}
      </Card>

      <Disclaimers />
    </div>
  );
}
