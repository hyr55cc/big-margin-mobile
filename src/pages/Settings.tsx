import { useState } from 'react';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { clearPersistedState } from '@/store/createStore';
import { useMarket } from '@/data/MarketContext';
import { getProvider, listProviders } from '@/data/registry';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Badge,
  Btn,
  Card,
  CardHead,
  Check,
  Field,
  Metric,
  Modal,
  Notice,
  Seg,
  Select,
} from '@/components/ui';
import { useFmt } from '@/lib/hooks';

export default function Settings() {
  const { t } = useI18n();
  const fmt = useFmt();
  const s = useSettings((x) => x);
  const { isDemo, loadedAt } = useMarket();
  const [confirmReset, setConfirmReset] = useState(false);

  const provider = getProvider();

  return (
    <div className="stack stack-5">
      <PageHead title={t('set.title')} />

      <div className="grid grid-2">
        <Card>
          <CardHead title={t('set.appearance')} icon="sun" />
          <div className="card-body stack stack-4">
            <Field label={t('set.theme')}>
              <Seg
                value={s.theme}
                onChange={(v) => useSettings.set({ theme: v })}
                options={[
                  { value: 'dark', label: t('set.dark') },
                  { value: 'light', label: t('set.light') },
                  { value: 'system', label: t('set.system') },
                ]}
              />
            </Field>
            <Field label={t('set.language')}>
              <Seg
                value={s.language}
                onChange={(v) => useSettings.set({ language: v })}
                options={[
                  { value: 'ar', label: t('set.arabic') },
                  { value: 'en', label: t('set.english') },
                ]}
              />
            </Field>
            <Field label={t('set.numberFormat')}>
              <Check
                checked={s.arabicNumerals}
                onChange={(v) => useSettings.set({ arabicNumerals: v })}
              >
                {t('set.arabicNumerals')}
              </Check>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHead title={t('set.marketPrefs')} icon="candles" />
          <div className="card-body stack stack-4">
            <Field label={t('set.currency')} hint={t('set.currencyNote')}>
              <Seg
                value={s.displayCurrency}
                onChange={(v) => useSettings.set({ displayCurrency: v })}
                options={[
                  { value: 'SAR', label: 'SAR' },
                  { value: 'USD', label: 'USD' },
                ]}
              />
            </Field>
            <Field label={t('set.defaultMarket')}>
              <Seg
                value={s.defaultMarket}
                onChange={(v) => useSettings.set({ defaultMarket: v })}
                options={[
                  { value: 'SA', label: '🇸🇦 ' + t('nav.saudi') },
                  { value: 'US', label: '🇺🇸 ' + t('nav.us') },
                ]}
              />
            </Field>
            <Field label={t('set.defaultPage')}>
              <Select
                value={s.defaultRoute}
                onChange={(v) => useSettings.set({ defaultRoute: v })}
                options={[
                  { value: '/app', label: t('nav.dashboard') },
                  { value: '/app/tasi/weight', label: t('nav.tasiWeight') },
                  { value: '/app/screener', label: t('nav.screener') },
                  { value: '/app/portfolio', label: t('nav.portfolio') },
                  { value: '/app/watchlist', label: t('nav.watchlist') },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHead title={t('set.notifications')} icon="bell" />
          <div className="card-body stack stack-3">
            <Check checked={s.notifyInApp} onChange={(v) => useSettings.set({ notifyInApp: v })}>
              {t('set.notifInApp')}
            </Check>
            <Check checked={s.notifyEmail} onChange={(v) => useSettings.set({ notifyEmail: v })}>
              {t('set.notifEmail')}
            </Check>
            <Notice tone="info">{t('acc.notConnected')}</Notice>
          </div>
        </Card>

        <Card>
          <CardHead title={t('set.dataRefresh')} icon="refresh" />
          <div className="card-body stack stack-4">
            <Field label={t('set.refreshInterval')}>
              <Seg
                value={String(s.refreshSeconds)}
                onChange={(v) => useSettings.set({ refreshSeconds: Number(v) })}
                options={[
                  { value: '0', label: t('set.refreshOff') },
                  { value: '30', label: '30s' },
                  { value: '60', label: '60s' },
                  { value: '300', label: '5m' },
                ]}
              />
            </Field>
            <Metric label={t('g.lastUpdated')} value={fmt.dateTime(loadedAt)} size="sm" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title={t('set.dataSource')}
          icon="database"
          right={
            <Badge tone={isDemo ? 'gold' : 'up'}>
              {isDemo ? t('g.demo') : t('status.live')}
            </Badge>
          }
        />
        <div className="card-body stack stack-4">
          <Metric label={t('set.provider')} value={provider.info.name} />
          <p className="muted t-sm" style={{ lineHeight: 1.8, maxWidth: '80ch' }}>
            {provider.info.description}
          </p>
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th>{t('set.provider')}</th>
                  <th>{t('g.status')}</th>
                  <th>{t('g.dataStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {listProviders().map((p) => (
                  <tr key={p.info.id}>
                    <td>{p.info.name}</td>
                    <td>
                      <Badge tone={p.info.id === provider.info.id ? 'brand' : 'neutral'}>
                        {p.info.id === provider.info.id ? t('al.active') : t('al.paused')}
                      </Badge>
                    </td>
                    <td>
                      <span className="row row-2 row-wrap">
                        {Object.entries(p.info.capabilities)
                          .filter(([, on]) => on)
                          .map(([k]) => (
                            <span key={k} className="badge badge-outline t-xs">
                              {k}
                            </span>
                          ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Notice tone="info">
            VITE_DATA_PROVIDER · VITE_API_BASE_URL — {t('disc.data')}
          </Notice>
        </div>
      </Card>

      <Card>
        <CardHead title={t('set.reset')} icon="trash" />
        <div className="card-body stack stack-3">
          <p className="muted t-sm" style={{ lineHeight: 1.8 }}>
            {t('set.resetHint')}
          </p>
          <div>
            <Btn variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
              {t('set.reset')}
            </Btn>
          </div>
        </div>
      </Card>

      <Disclaimers shariah />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('set.reset')}
        footer={
          <>
            <Btn onClick={() => setConfirmReset(false)}>{t('g.cancel')}</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                clearPersistedState();
                window.location.reload();
              }}
            >
              {t('g.confirm')}
            </Btn>
          </>
        }
      >
        <p className="muted" style={{ lineHeight: 1.8 }}>
          {t('set.resetConfirm')}
        </p>
      </Modal>
    </div>
  );
}
