import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, RotateCcw, FileText, BookOpen, Briefcase, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  FILTER_CLASS,
  TH_CLASS,
  PAGE_SIZES,
  TableSearch,
  ResetFiltersButton,
  TableFrame,
  TablePagination,
  TableNotice
} from './AdminTable';

type TrashKind = 'instruction' | 'course' | 'case';

interface TrashRow {
  id: string;
  kind: TrashKind;
  materialId: string;
  title: string;
  department: string;
  deletedAt: string;
  deletedByName: string;
  questionCount: number;
  courseCount: number;
  instructionCount: number;
}

interface TrashListResponse {
  items: TrashRow[];
  total: number;
  counts: Record<TrashKind, number>;
  totalAll: number;
  deleters: Array<{ id: string; name: string }>;
}

const KIND_META: Record<TrashKind, { label: string; icon: React.ReactNode; tone: string }> = {
  instruction: { label: 'Інструкція', icon: <FileText className="w-4 h-4" />, tone: 'bg-blue-50 text-blue-600 border-blue-100' },
  course: { label: 'Курс', icon: <BookOpen className="w-4 h-4" />, tone: 'bg-purple-50 text-purple-600 border-purple-100' },
  case: { label: 'Кейс', icon: <Briefcase className="w-4 h-4" />, tone: 'bg-orange-50 text-orange-600 border-orange-100' }
};

const formatDateTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
};

/** Що саме повернеться разом з матеріалом — щоб було видно масштаб. */
function describeRow(row: TrashRow): string {
  const parts: string[] = [];
  if (row.department) parts.push(row.department);
  if (row.kind === 'instruction' && row.questionCount) parts.push(`питань: ${row.questionCount}`);
  if (row.kind === 'course' && row.instructionCount) parts.push(`інструкцій: ${row.instructionCount}`);
  if (row.courseCount) parts.push(`у курсах: ${row.courseCount}`);
  return parts.join(' · ');
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Не вдалося виконати дію');
  return data;
}

interface Props {
  /** Перечитати матеріали після відновлення. */
  onRefresh?: () => Promise<void>;
  /** Повідомити навігацію про нову кількість матеріалів у корзині. */
  onCountChange?: (count: number) => void;
}

/**
 * «Матеріали → Корзина»: видалені інструкції, курси й кейси. Звідси матеріал
 * можна відновити (разом з питаннями та місцем у курсах) або видалити назавжди.
 */
export const TrashPanel: React.FC<Props> = ({ onRefresh, onCountChange }) => {
  const [kind, setKind] = useState<'all' | TrashKind>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deletedBy, setDeletedBy] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const [data, setData] = useState<TrashListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  /** Що саме чекає підтвердження: остаточне видалення вибраних / одного / усієї корзини. */
  const [confirming, setConfirming] = useState<{ ids: string[] | 'all'; label: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [kind, debouncedSearch, deletedBy, from, to, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page + 1), limit: String(pageSize) });
      if (kind !== 'all') qs.set('kind', kind);
      if (debouncedSearch) qs.set('search', debouncedSearch);
      if (deletedBy) qs.set('deletedBy', deletedBy);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/v2/trash?${qs.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Не вдалося завантажити корзину');
      setData(json);
      onCountChange?.(json.totalAll);
      // Вибір стосується лише видимих рядків
      setSelected(prev => new Set([...prev].filter(id => json.items.some((r: TrashRow) => r.id === id))));
    } catch (err: any) {
      setNotice({ tone: 'error', text: err?.message || 'Не вдалося завантажити корзину' });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, kind, debouncedSearch, deletedBy, from, to, onCountChange]);

  useEffect(() => { void load(); }, [load]);

  const rows = data?.items || [];
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const filtersActive = kind !== 'all' || Boolean(search) || Boolean(deletedBy) || Boolean(from) || Boolean(to);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const restore = async (ids: string[]) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await post('/api/v2/trash/restore', { ids });
      const restored = result.restored?.length || 0;
      const failed: Array<{ error: string }> = result.failed || [];
      setNotice(failed.length > 0
        ? { tone: 'error', text: `Відновлено: ${restored}. Не вдалося: ${failed.length} — ${failed[0].error}` }
        : { tone: 'success', text: restored === 1 ? `Матеріал «${result.restored[0].title}» відновлено` : `Відновлено матеріалів: ${restored}` });
      await Promise.all([load(), onRefresh?.()]);
    } catch (err: any) {
      setNotice({ tone: 'error', text: err?.message || 'Не вдалося відновити' });
    } finally {
      setBusy(false);
    }
  };

  const purge = async (target: string[] | 'all') => {
    setBusy(true);
    setNotice(null);
    try {
      const result = target === 'all'
        ? await post('/api/v2/trash/empty')
        : await post('/api/v2/trash/purge', { ids: target });
      setNotice({ tone: 'success', text: target === 'all' ? `Корзину очищено. Видалено назавжди: ${result.purged}` : `Видалено назавжди: ${result.purged}` });
      setSelected(new Set());
      await load();
    } catch (err: any) {
      setNotice({ tone: 'error', text: err?.message || 'Не вдалося видалити' });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const kindTabs = useMemo(() => ([
    { key: 'all' as const, label: 'Усі', count: data?.totalAll ?? 0 },
    { key: 'instruction' as const, label: 'Інструкції', count: data?.counts.instruction ?? 0 },
    { key: 'course' as const, label: 'Курси', count: data?.counts.course ?? 0 },
    { key: 'case' as const, label: 'Кейси', count: data?.counts.case ?? 0 }
  ]), [data]);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h3 className="text-xl font-bold text-slate-900">Корзина</h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">{data?.totalAll ?? 0}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Видалені інструкції, курси й кейси не зникають одразу, а потрапляють сюди. Матеріал можна відновити разом із
            питаннями тесту та місцем у курсах або видалити назавжди.
          </p>
        </div>
        <button
          onClick={() => setConfirming({ ids: 'all', label: `Очистити корзину? Усі матеріали (${data?.totalAll ?? 0}) буде видалено назавжди.` })}
          disabled={busy || !data || data.totalAll === 0}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" /> Очистити корзину
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {kindTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setKind(t.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              kind === t.key ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TableSearch value={search} onChange={setSearch} placeholder="Пошук за назвою, ID чи підрозділом" />
        <select value={deletedBy} onChange={e => setDeletedBy(e.target.value)} className={FILTER_CLASS} aria-label="Хто видалив">
          <option value="">Будь-хто видалив</option>
          {(data?.deleters || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          з <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={FILTER_CLASS} />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          по <input type="date" value={to} onChange={e => setTo(e.target.value)} className={FILTER_CLASS} />
        </label>
        {filtersActive && (
          <ResetFiltersButton onClick={() => { setKind('all'); setSearch(''); setDeletedBy(''); setFrom(''); setTo(''); }} />
        )}
        {loading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
      </div>

      {notice && <TableNotice tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} />}

      {confirming && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm text-rose-900 grow">{confirming.label} Цю дію не можна скасувати.</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => void purge(confirming.ids)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Видалити назавжди
            </button>
            <button onClick={() => setConfirming(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600">
              Скасувати
            </button>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-purple-50 border border-purple-200">
          <span className="text-xs font-bold text-purple-900 px-1">Вибрано: {selected.size}</span>
          <button
            onClick={() => void restore([...selected])}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Відновити вибрані
          </button>
          <button
            onClick={() => setConfirming({ ids: [...selected], label: `Видалити назавжди вибрані матеріали (${selected.size})?` })}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Видалити вибрані назавжди
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2">
            Зняти вибір
          </button>
        </div>
      )}

      <TableFrame
        head={
          <>
            <th scope="col" className="px-3 py-2.5 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))}
                aria-label="Вибрати всі на сторінці"
              />
            </th>
            <th scope="col" className={TH_CLASS}>Матеріал</th>
            <th scope="col" className={TH_CLASS}>Тип</th>
            <th scope="col" className={TH_CLASS}>Видалено</th>
            <th scope="col" className={TH_CLASS}>Хто видалив</th>
            <th scope="col" className={`${TH_CLASS} text-right`}>Дії</th>
          </>
        }
        empty={!loading && rows.length === 0
          ? (filtersActive ? 'За цими фільтрами нічого не знайдено.' : 'Корзина порожня.')
          : undefined}
        footer={
          <TablePagination
            total={data?.total || 0}
            page={page}
            pageCount={Math.max(1, Math.ceil((data?.total || 0) / pageSize))}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        }
      >
        {rows.map(row => {
          const meta = KIND_META[row.kind];
          const details = describeRow(row);
          return (
            <tr key={row.id} className={selected.has(row.id) ? 'bg-purple-50/50' : 'hover:bg-slate-50'}>
              <td className="px-3 py-2.5">
                <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Вибрати «${row.title}»`} />
              </td>
              <td className="px-3 py-2.5 min-w-[220px]">
                <div className="flex items-start gap-2.5">
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.tone}`}>{meta.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 leading-snug">{row.title}</p>
                    <p className="text-[11px] text-slate-500">{[`ID: ${row.materialId}`, details].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{meta.label}</td>
              <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{formatDateTime(row.deletedAt)}</td>
              <td className="px-3 py-2.5 text-xs text-slate-600">{row.deletedByName || '—'}</td>
              <td className="px-3 py-2.5">
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => void restore([row.id])}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-1"
                    title="Повернути матеріал на місце"
                  >
                    <RotateCcw className="w-3 h-3" /> Відновити
                  </button>
                  <button
                    onClick={() => setConfirming({ ids: [row.id], label: `Видалити «${row.title}» назавжди?` })}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 flex items-center gap-1"
                    title="Видалити остаточно"
                  >
                    <Trash2 className="w-3 h-3" /> Назавжди
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </TableFrame>
    </div>
  );
};
