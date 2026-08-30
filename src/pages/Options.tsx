import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import { Badge, Btn, Card, CardHead, Empty, Notice } from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import { OptionsPanel } from '@/components/options/OptionsPanel';
import { useOptionsStore } from '@/store/options';
import { useOptionsMeta } from '@/data/options/hooks';

/**
 * The standalone options desk. The underlying lives in the URL so a chain can
 * be linked to and reloaded, which is the one thing a per-stock tab cannot do.
 */
export default function OptionsPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { bySymbol, rows } = useMarket();
  const meta = useOptionsMeta();
  const [params, setParams] = useSearchParams();

  const urlSymbol = params.get('symbol');
  const [symbol, setSymbol] = useState<string | null>(urlSymbol);

  useEffect(() => {
    setSymbol(urlSymbol);
  }, [urlSymbol]);

  const pick = (next: string | null) => {
    if (next) setParams({ symbol: next }, { replace: true });
    else setParams({}, { replace: true });
  };

  const row = symbol ? (bySymbol.get(symbol) ?? null) : null;

  const watched = useOptionsStore((s) => s.watched);

  // Underlyings the user is already following, offered as shortcuts so the
  // page is not a blank search box on every visit.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of watched) {
      if (!seen.has(w.underlying)) {
        seen.add(w.underlying);
        out.push(w.underlying);
      }
    }
    return out.slice(0, 8);
  }, [watched]);

  const usCount = useMemo(() => rows.filter((r) => r.market === 'US').length, [rows]);

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('opt.title')}
        sub={t('opt.pageSub')}
        right={
          row ? (
            <Btn size="sm" variant="ghost" onClick={() => pick(null)}>
              {t('g.clear')}
            </Btn>
          ) : null
        }
      />

      <Card>
        <CardHead title={t('opt.pickSymbol')} sub={t('opt.pickSymbolHint')} icon="search" />
        <div className="card-body stack stack-3">
          <InstrumentPicker
            marketFilter="US"
            placeholder={t('g.search')}
            onPick={(r) => pick(r.symbol)}
          />
          {recent.length > 0 && (
            <div className="row row-2 row-wrap">
              {recent.map((s) => (
                <Btn key={s} size="sm" variant="ghost" active={s === symbol} onClick={() => pick(s)}>
                  {s}
                </Btn>
              ))}
            </div>
          )}
          {!row && (
            <div className="row row-3 row-wrap t-sm muted">
              <Badge tone="neutral">{fmt.int(usCount)}</Badge>
              <span>{t('opt.pickSymbolHint')}</span>
            </div>
          )}
        </div>
      </Card>

      {!meta.enabled && (
        <Notice tone="warn">{t('opt.providerOffHint')}</Notice>
      )}

      {row ? (
        <OptionsPanel
          symbol={row.symbol}
          spot={row.price}
          currency={row.instrument.currency}
          hasOptionsMarket={row.market === 'US'}
        />
      ) : symbol ? (
        <Card>
          <Empty icon="search" title={t('g.noResults')} desc={t('opt.pickSymbolHint')} />
        </Card>
      ) : null}

      <Disclaimers />
    </div>
  );
}
