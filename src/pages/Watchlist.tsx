import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/hooks';
import { useMarket, type MarketRow } from '@/data/MarketContext';
import {
  useWatchlists,
  createList,
  deleteList,
  renameList,
  toggleWatch,
  reorderList,
} from '@/store/watchlist';
import { PageHead, Disclaimers } from '@/components/layout/PageHead';
import {
  Btn,
  Card,
  CardHead,
  DataTable,
  Empty,
  Field,
  IconBtn,
  Modal,
  Seg,
  TextInput,
  type Column,
} from '@/components/ui';
import { InstrumentPicker } from '@/components/market/cells';
import { useStockColumns } from '@/components/market/columns';

export default function Watchlist() {
  const { t } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const { bySymbol } = useMarket();
  const cols = useStockColumns();

  const lists = useWatchlists((s) => s.lists);
  const activeId = useWatchlists((s) => s.activeId);
  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [copied, setCopied] = useState(false);

  const rows = useMemo(
    () =>
      (active?.entries ?? [])
        .map((e) => bySymbol.get(e.symbol))
        .filter((r): r is MarketRow => r != null),
    [active, bySymbol],
  );

  const share = () => {
    const encoded = (active?.entries ?? []).map((e) => e.symbol).join(',');
    const url = `${window.location.origin}/app/watchlist?symbols=${encodeURIComponent(encoded)}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };

  const orderColumn: Column<MarketRow> = {
    key: 'order',
    label: '',
    sortable: false,
    width: 74,
    render: (r) => {
      const idx = active?.entries.findIndex((e) => e.symbol === r.symbol) ?? -1;
      return (
        <span className="row row-2">
          <IconBtn
            icon="arrowUp"
            title="↑"
            onClick={() => idx > 0 && reorderList(active!.id, idx, idx - 1)}
          />
          <IconBtn
            icon="arrowDown"
            title="↓"
            onClick={() =>
              idx >= 0 &&
              idx < (active?.entries.length ?? 0) - 1 &&
              reorderList(active!.id, idx, idx + 1)
            }
          />
        </span>
      );
    },
  };

  const removeColumn: Column<MarketRow> = {
    key: 'remove',
    label: t('g.actions'),
    align: 'end',
    sortable: false,
    render: (r) => (
      <IconBtn
        icon="trash"
        title={t('g.remove')}
        onClick={() => active && toggleWatch(active.id, r.symbol, r.market)}
      />
    ),
  };

  return (
    <div className="stack stack-5">
      <PageHead
        title={t('wl.title')}
        sub={t('wl.sub')}
        right={
          <>
            <Btn icon="copy" onClick={share} disabled={rows.length === 0}>
              {copied ? t('g.copied') : t('g.share')}
            </Btn>
            <Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>
              {t('wl.newList')}
            </Btn>
          </>
        }
      />

      <div className="row row-3 row-wrap">
        <Seg
          value={activeId}
          onChange={(id) => useWatchlists.set({ activeId: id })}
          options={lists.map((l) => ({
            value: l.id,
            label: `${l.name} (${l.entries.length})`,
          }))}
        />
        {active && (
          <>
            <Btn
              size="sm"
              icon="settings"
              onClick={() => {
                setRenameValue(active.name);
                setRenaming(true);
              }}
            >
              {t('g.rename')}
            </Btn>
            {lists.length > 1 && (
              <Btn size="sm" variant="danger" icon="trash" onClick={() => deleteList(active.id)}>
                {t('wl.deleteList')}
              </Btn>
            )}
          </>
        )}
      </div>

      <Card>
        <CardHead title={active?.name ?? t('wl.title')} icon="eye" />
        <div className="card-body">
          <InstrumentPicker
            placeholder={t('wl.addSymbol')}
            exclude={active?.entries.map((e) => e.symbol) ?? []}
            onPick={(r) => active && toggleWatch(active.id, r.symbol, r.market)}
          />
        </div>

        {rows.length === 0 ? (
          <Empty icon="eye" title={t('wl.empty')} desc={t('wl.emptyHint')} />
        ) : (
          <DataTable
            rows={rows}
            columns={[
              orderColumn,
              cols.symbol,
              cols.price,
              cols.changePct,
              cols.weight,
              cols.pointsPerUnit,
              cols.dividendYield,
              cols.shariah,
              cols.volume,
              cols.marketCap,
              cols.impactBand,
              removeColumn,
            ]}
            rowKey={(r) => r.symbol}
            initialSort="symbol"
            initialDir="asc"
            onRowClick={(r) => navigate(`/app/stock/${r.symbol}`)}
            exportName="big-margin-watchlist"
            pageSize={50}
            toolbar={
              <span className="t-sm muted-3">
                {fmt.int(rows.length)} {t('g.results')}
              </span>
            }
          />
        )}
      </Card>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title={t('wl.newList')}
        footer={
          <>
            <Btn onClick={() => setShowNew(false)}>{t('g.cancel')}</Btn>
            <Btn
              variant="primary"
              disabled={!newName.trim()}
              onClick={() => {
                createList(newName.trim());
                setNewName('');
                setShowNew(false);
              }}
            >
              {t('g.save')}
            </Btn>
          </>
        }
      >
        <Field label={t('g.name')}>
          <TextInput value={newName} onChange={setNewName} />
        </Field>
      </Modal>

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title={t('g.rename')}
        footer={
          <>
            <Btn onClick={() => setRenaming(false)}>{t('g.cancel')}</Btn>
            <Btn
              variant="primary"
              disabled={!renameValue.trim()}
              onClick={() => {
                if (active) renameList(active.id, renameValue.trim());
                setRenaming(false);
              }}
            >
              {t('g.save')}
            </Btn>
          </>
        }
      >
        <Field label={t('g.name')}>
          <TextInput value={renameValue} onChange={setRenameValue} />
        </Field>
      </Modal>

      <Disclaimers shariah />
    </div>
  );
}
