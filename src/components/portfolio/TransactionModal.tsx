import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket } from '@/data/MarketContext';
import { usePortfolio, addTransaction, updateTransaction, blankTransaction } from '@/store/portfolio';
import {
  Btn,
  Field,
  Modal,
  Notice,
  NumInput,
  Seg,
  Select,
  TextInput,
  Metric,
} from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import { buildPosition } from '@/lib/calc/position';
import { dAdd, dMul } from '@/lib/decimal';
import type { Transaction, TxKind } from '@/types';

const KINDS: TxKind[] = ['buy', 'sell', 'dividend', 'deposit', 'withdrawal'];

export function TransactionModal({
  open,
  onClose,
  editing,
  presetSymbol,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  presetSymbol?: string;
}) {
  const { t, L } = useI18n();
  const fmt = useFmt();
  const { bySymbol } = useMarket();
  const activeId = usePortfolio((s) => s.activeId);
  const transactions = usePortfolio((s) => s.transactions);

  const [draft, setDraft] = useState<Omit<Transaction, 'id'>>(() =>
    blankTransaction(activeId),
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id, ...rest } = editing;
      void id;
      setDraft(rest);
    } else {
      const base = blankTransaction(activeId);
      if (presetSymbol) {
        const row = bySymbol.get(presetSymbol);
        setDraft({
          ...base,
          symbol: presetSymbol,
          market: row?.market ?? null,
          currency: row?.instrument.currency ?? 'SAR',
          price: row?.price ?? null,
        });
      } else {
        setDraft(base);
      }
    }
  }, [open, editing, presetSymbol, activeId, bySymbol]);

  const isTrade = draft.kind === 'buy' || draft.kind === 'sell';
  const isCash = draft.kind === 'deposit' || draft.kind === 'withdrawal';
  const row = draft.symbol ? bySymbol.get(draft.symbol) : null;

  const fees = dAdd(draft.commission || 0, draft.fees || 0, draft.otherCosts || 0);
  const gross =
    draft.price != null && draft.quantity != null ? dMul(draft.price, draft.quantity) : null;
  const netCost =
    gross == null
      ? null
      : draft.kind === 'sell'
        ? gross - fees
        : dAdd(gross, fees);

  const sharesHeld = useMemo(() => {
    if (!draft.symbol) return 0;
    return buildPosition(
      draft.symbol,
      transactions.filter((x) => x.portfolioId === activeId && x.id !== editing?.id),
    ).shares;
  }, [draft.symbol, transactions, activeId, editing?.id]);

  const errors: string[] = [];
  if (isTrade) {
    if (!draft.symbol) errors.push(t('g.symbol'));
    if (draft.quantity == null || draft.quantity <= 0) errors.push(t('g.quantity'));
    if (draft.price == null || draft.price < 0) errors.push(t('g.price'));
    if (
      draft.kind === 'sell' &&
      draft.quantity != null &&
      draft.quantity > sharesHeld + 1e-9
    ) {
      errors.push(t('pf.sellTooMany'));
    }
  }
  if (draft.kind === 'dividend' && (draft.price == null || !draft.symbol)) {
    errors.push(t('div.dps'));
  }
  if (isCash && (draft.price == null || draft.price <= 0)) errors.push(t('g.value'));

  const save = () => {
    if (errors.length) return;
    if (editing) updateTransaction(editing.id, draft);
    else addTransaction(draft);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? t('pf.editTransaction') : t('pf.addTransaction')}
      footer={
        <>
          <Btn onClick={onClose}>{t('g.cancel')}</Btn>
          <Btn variant="primary" onClick={save} disabled={errors.length > 0}>
            {t('g.save')}
          </Btn>
        </>
      }
    >
      <div className="stack stack-4">
        <Seg
          value={draft.kind}
          onChange={(k) => setDraft((d) => ({ ...d, kind: k }))}
          options={KINDS.map((k) => ({ value: k, label: t(`pf.kind.${k}` as 'pf.kind.buy') }))}
        />

        {!isCash && (
          <Field label={t('g.symbol')}>
            {draft.symbol ? (
              <div className="row row-3">
                <span className="sym">{draft.symbol}</span>
                <span className="truncate" style={{ flex: 1 }}>
                  {row ? L(row.instrument.shortName) : ''}
                </span>
                {row?.price != null && (
                  <span className="num t-sm muted">{fmt.num(row.price)}</span>
                )}
                <Btn
                  size="sm"
                  variant="ghost"
                  icon="close"
                  onClick={() => setDraft((d) => ({ ...d, symbol: null, market: null }))}
                />
              </div>
            ) : (
              <InstrumentPicker
                onPick={(r) =>
                  setDraft((d) => ({
                    ...d,
                    symbol: r.symbol,
                    market: r.market,
                    currency: r.instrument.currency,
                    price: d.price ?? r.price,
                  }))
                }
              />
            )}
          </Field>
        )}

        <div className="grid grid-3">
          <Field label={t('g.date')}>
            <TextInput
              type="date"
              value={draft.date}
              onChange={(v) => setDraft((d) => ({ ...d, date: v }))}
            />
          </Field>

          {!isCash && (
            <Field
              label={draft.kind === 'dividend' ? t('div.dps') : t('g.price')}
              hint={
                draft.kind === 'sell' && draft.symbol
                  ? `${t('pf.remaining')}: ${fmt.num(sharesHeld, { decimals: 0 })}`
                  : undefined
              }
            >
              <NumInput
                value={draft.price}
                onChange={(v) => setDraft((d) => ({ ...d, price: v }))}
                step={0.05}
                min={0}
              />
            </Field>
          )}

          {isCash && (
            <Field label={t('g.value')}>
              <NumInput
                value={draft.price}
                onChange={(v) => setDraft((d) => ({ ...d, price: v }))}
                step={100}
                min={0}
              />
            </Field>
          )}

          {!isCash && (
            <Field label={t('g.quantity')}>
              <NumInput
                value={draft.quantity}
                onChange={(v) => setDraft((d) => ({ ...d, quantity: v }))}
                min={0}
                invalid={
                  draft.kind === 'sell' &&
                  draft.quantity != null &&
                  draft.quantity > sharesHeld + 1e-9
                }
              />
            </Field>
          )}

          <Field label={t('pf.commission')}>
            <NumInput
              value={draft.commission}
              onChange={(v) => setDraft((d) => ({ ...d, commission: v ?? 0 }))}
              step={1}
              min={0}
            />
          </Field>
          <Field label={t('pf.fees')}>
            <NumInput
              value={draft.fees}
              onChange={(v) => setDraft((d) => ({ ...d, fees: v ?? 0 }))}
              step={1}
              min={0}
            />
          </Field>
          <Field label={t('pf.otherCosts')}>
            <NumInput
              value={draft.otherCosts}
              onChange={(v) => setDraft((d) => ({ ...d, otherCosts: v ?? 0 }))}
              step={1}
              min={0}
            />
          </Field>

          <Field label={t('g.currency')}>
            <Select
              value={draft.currency}
              onChange={(v) => setDraft((d) => ({ ...d, currency: v }))}
              options={[
                { value: 'SAR', label: 'SAR' },
                { value: 'USD', label: 'USD' },
              ]}
            />
          </Field>
        </div>

        <Field label={t('pf.note')}>
          <TextInput value={draft.note} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} />
        </Field>

        {netCost != null && (
          <div className="metric-grid">
            <Metric label={t('ac.grossCost')} value={fmt.money(gross, draft.currency)} size="sm" />
            <Metric label={t('ac.totalFees')} value={fmt.money(fees, draft.currency)} size="sm" />
            <Metric
              label={draft.kind === 'sell' ? t('pnl.positionValue') : t('ac.totalCost')}
              value={fmt.money(netCost, draft.currency)}
              size="sm"
            />
          </div>
        )}

        {errors.length > 0 && (
          <Notice tone="warn" icon="warning">
            {errors.join(' · ')}
          </Notice>
        )}
      </div>
    </Modal>
  );
}
