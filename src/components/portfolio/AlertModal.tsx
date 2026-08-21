import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { createAlert, THRESHOLDLESS } from '@/store/watchlist';
import { Btn, Field, Modal, Notice, NumInput, Select, TextInput } from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import type { AlertKind, MarketId } from '@/types';

const KINDS: AlertKind[] = [
  'price_above',
  'price_below',
  'pct_move',
  'volume_above',
  'weight_change',
  'shariah_change',
  'dividend_announced',
  'corporate_action',
  'earnings_upcoming',
];

export function AlertModal({
  open,
  onClose,
  presetSymbol,
}: {
  open: boolean;
  onClose: () => void;
  presetSymbol?: string;
}) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();

  const [symbol, setSymbol] = useState<string | null>(presetSymbol ?? null);
  const [market, setMarket] = useState<MarketId>('SA');
  const [kind, setKind] = useState<AlertKind>('price_above');
  const [threshold, setThreshold] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const row = symbol ? bySymbol.get(symbol) : null;
  const needsThreshold = !THRESHOLDLESS.includes(kind);

  useEffect(() => {
    if (!open) return;
    setSymbol(presetSymbol ?? null);
    setNote('');
    const r = presetSymbol ? bySymbol.get(presetSymbol) : null;
    setMarket(r?.market ?? 'SA');
    setThreshold(r?.price ?? null);
  }, [open, presetSymbol, bySymbol]);

  const valid = symbol != null && (!needsThreshold || threshold != null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('al.newAlert')}
      footer={
        <>
          <Btn onClick={onClose}>{t('g.cancel')}</Btn>
          <Btn
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (!symbol) return;
              createAlert({ symbol, market, kind, threshold: needsThreshold ? threshold : null, note });
              onClose();
            }}
          >
            {t('g.save')}
          </Btn>
        </>
      }
    >
      <div className="stack stack-4">
        <Field label={t('g.symbol')}>
          {symbol ? (
            <div className="row row-3">
              <span className="sym">{symbol}</span>
              <span className="truncate" style={{ flex: 1 }}>
                {row ? L(row.instrument.shortName) : ''}
              </span>
              {row?.price != null && <span className="num t-sm muted">{fmt.num(row.price)}</span>}
              <Btn size="sm" variant="ghost" icon="close" onClick={() => setSymbol(null)} />
            </div>
          ) : (
            <InstrumentPicker
              onPick={(r) => {
                setSymbol(r.symbol);
                setMarket(r.market);
                setThreshold(r.price);
              }}
            />
          )}
        </Field>

        <Field label={t('al.kind')}>
          <Select
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ value: k, label: t(`al.${k}` as 'al.price_above') }))}
          />
        </Field>

        {needsThreshold && (
          <Field
            label={t('al.threshold')}
            hint={
              kind === 'pct_move' || kind === 'weight_change'
                ? '%'
                : row?.price != null
                  ? `${t('g.price')}: ${fmt.num(row.price)}`
                  : undefined
            }
          >
            <NumInput value={threshold} onChange={setThreshold} step={0.5} />
          </Field>
        )}

        <Field label={t('pf.note')}>
          <TextInput value={note} onChange={setNote} />
        </Field>

        <Notice tone="info">{t('al.sub')}</Notice>
      </div>
    </Modal>
  );
}
