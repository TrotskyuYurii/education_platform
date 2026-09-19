import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollText,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Trash2,
  Check,
  Eye,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  CalendarClock,
  Server,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type LogLevel = 'error' | 'warning' | 'info';
type LogStatus = 'new' | 'acknowledged' | 'resolved';

interface SystemLogItem {
  _id: string;
  level: LogLevel;
  source: string;
  event: string;
  message: string;
  details?: Record<string, any>;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: LogStatus;
  handledBy?: { fullName?: string; username?: string; email?: string } | null;
  handledAt?: string | null;
  resolutionNote?: string;
}

const LEVEL_META: Record<LogLevel, { label: string; icon: React.ElementType; chip: string; dot: string }> = {
  error: {
    label: 'Помилка',
    icon: AlertCircle,
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500'
  },
  warning: {
    label: 'Попередження',
    icon: AlertTriangle,
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500'
  },
  info: {
    label: 'Інформація',
    icon: Info,
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500'
  }
};

const STATUS_META: Record<LogStatus, { label: string; chip: string }> = {
  new: { label: 'Нова', chip: 'bg-rose-100 text-rose-800 border-rose-200' },
  acknowledged: { label: 'В роботі', chip: 'bg-amber-100 text-amber-800 border-amber-200' },
  resolved: { label: 'Вирішено', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
};

// Людські назви підсистем. Незнайоме джерело показуємо як є — так новий
// постачальник логів не потребує правок цього файлу.
const SOURCE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: 'Пошта (SMTP)', icon: Mail },
  scheduler: { label: 'Планувальник', icon: CalendarClock },
  system: { label: 'Система', icon: Server }
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const SystemLogPanel: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('system.logs.manage');

  const [items, setItems] = useState<SystemLogItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | LogStatus>('open');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({
        level: levelFilter,
        status: statusFilter,
        source: sourceFilter,
        page: String(page),
        limit: '50'
      });
      if (appliedSearch) params.set('search', appliedSearch);

      const res = await fetch(`/api/v2/system/logs?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити журнал');

      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setSources(data.sources || []);
      // Прибираємо з виділення те, що зникло після фільтрації чи видалення,
      // інакше масова дія пішла б по записах, яких користувач уже не бачить.
      setSelected(prev => {
        const visible = new Set((data.items || []).map((i: SystemLogItem) => i._id));
        return new Set([...prev].filter(id => visible.has(id)));
      });
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження журналу');
    } finally {
      setLoading(false);
    }
  }, [levelFilter, statusFilter, sourceFilter, appliedSearch, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Скидаємо сторінку на першу, коли змінюються умови вибірки, інакше можна
  // залишитись на сторінці 4 у вибірці з однієї сторінки й побачити порожньо.
  useEffect(() => { setPage(1); }, [levelFilter, statusFilter, sourceFilter, appliedSearch]);

  const runAction = async (fn: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Дію не виконано');
      await fetchLogs();
    } catch (err: any) {
      setError(err.message || 'Дію не виконано');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (ids: string[], status: LogStatus) => {
    if (ids.length === 0) return;
    return runAction(() => fetch('/api/v2/system/logs/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status })
    }));
  };

  const deleteEntries = (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Видалити ${ids.length} запис(ів) журналу? Дію не можна скасувати.`)) return;
    return runAction(() => fetch('/api/v2/system/logs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    }));
  };

  const purgeResolved = () => {
    if (!confirm('Видалити всі записи зі статусом «Вирішено»?')) return;
    return runAction(() => fetch('/api/v2/system/logs/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ olderThanDays: 0 })
    }));
  };

  const createTestEntry = () =>
    runAction(() => fetch('/api/v2/system/logs/test', { method: 'POST' }));

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allVisibleSelected = items.length > 0 && items.every(i => selected.has(i._id));
  const selectedIds = useMemo(() => [...selected], [selected]);

  const openErrors = useMemo(
    () => items.filter(i => i.level === 'error' && i.status !== 'resolved').length,
    [items]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-rose-600" /> Журнал адміністратора
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Технічні збої підсистем: невдалі відправки пошти, помилки планувальника та інтеграцій.
            Однакові проблеми групуються в один запис із лічильником повторів.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchLogs}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Оновити
          </button>
          {canManage && (
            <button
              onClick={purgeResolved}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Очистити вирішені
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1">
          {([
            { key: 'open', label: 'Незакриті' },
            { key: 'new', label: 'Нові' },
            { key: 'acknowledged', label: 'В роботі' },
            { key: 'resolved', label: 'Вирішені' },
            { key: 'all', label: 'Усі' }
          ] as const).map(opt => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === opt.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value as any)}
          className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Усі рівні</option>
          <option value="error">Помилки</option>
          <option value="warning">Попередження</option>
          <option value="info">Інформація</option>
        </select>

        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Усі джерела</option>
          {sources.map(s => (
            <option key={s} value={s}>{SOURCE_LABELS[s]?.label || s}</option>
          ))}
        </select>

        <form
          onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); }}
          className="flex items-center gap-1.5 grow min-w-[200px]"
        >
          <div className="relative grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук за текстом або кодом події…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
          >
            Знайти
          </button>
        </form>
      </div>

      {/* Bulk actions */}
      {canManage && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5">
          <span className="text-xs font-bold text-blue-900">Обрано: {selectedIds.length}</span>
          <div className="grow" />
          <button
            onClick={() => changeStatus(selectedIds, 'acknowledged')}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" /> Взяти в роботу
          </button>
          <button
            onClick={() => changeStatus(selectedIds, 'resolved')}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> Позначити вирішеними
          </button>
          <button
            onClick={() => deleteEntries(selectedIds)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-200 rounded-lg hover:bg-rose-200 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Видалити
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Записів у вибірці: <strong className="text-slate-800">{total}</strong></span>
        {openErrors > 0 && (
          <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            незакритих помилок на сторінці: {openErrors}
          </span>
        )}
        {canManage && (
          <button
            onClick={createTestEntry}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" /> Створити тестовий запис
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Завантаження журналу…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Записів немає</p>
          <p className="text-sm text-slate-500 mt-1">
            За обраними фільтрами проблем не зафіксовано.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {canManage && (
            <label className="flex items-center gap-2 px-2 text-xs font-medium text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(items.map(i => i._id)))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Обрати всі на сторінці
            </label>
          )}

          {items.map(item => {
            const level = LEVEL_META[item.level] || LEVEL_META.info;
            const LevelIcon = level.icon;
            const status = STATUS_META[item.status] || STATUS_META.new;
            const sourceMeta = SOURCE_LABELS[item.source];
            const SourceIcon = sourceMeta?.icon || Server;
            const isOpen = expanded.has(item._id);

            return (
              <div
                key={item._id}
                className={`bg-white rounded-2xl border transition ${
                  item.status === 'resolved' ? 'border-slate-200 opacity-75' : 'border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3 p-3.5">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={selected.has(item._id)}
                      onChange={() => toggleSelected(item._id)}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                  )}

                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${level.chip}`}>
                    <LevelIcon className="w-4 h-4" />
                  </div>

                  <div className="grow min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${status.chip}`}>
                        {status.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        <SourceIcon className="w-3 h-3" />
                        {sourceMeta?.label || item.source}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{item.event}</span>
                      {item.occurrences > 1 && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                          ×{item.occurrences}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-900 break-words">{item.message}</p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                      <span>Останній раз: {formatDateTime(item.lastSeenAt)}</span>
                      {item.occurrences > 1 && <span>Уперше: {formatDateTime(item.firstSeenAt)}</span>}
                      {item.handledBy && (
                        <span>
                          Опрацював: {item.handledBy.fullName || item.handledBy.username || item.handledBy.email}
                          {item.handledAt ? `, ${formatDateTime(item.handledAt)}` : ''}
                        </span>
                      )}
                    </div>

                    {item.details && Object.keys(item.details).length > 0 && (
                      <>
                        <button
                          onClick={() => toggleExpanded(item._id)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          Технічні деталі
                        </button>
                        {isOpen && (
                          <pre className="mt-2 p-3 bg-slate-900 text-slate-100 text-[11px] rounded-xl overflow-x-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(item.details, null, 2)}
                          </pre>
                        )}
                      </>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex flex-col gap-1 shrink-0">
                      {item.status !== 'resolved' ? (
                        <>
                          {item.status === 'new' && (
                            <button
                              onClick={() => changeStatus([item._id], 'acknowledged')}
                              disabled={busy}
                              title="Взяти в роботу"
                              className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => changeStatus([item._id], 'resolved')}
                            disabled={busy}
                            title="Позначити вирішеною"
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => changeStatus([item._id], 'new')}
                          disabled={busy}
                          title="Повернути в роботу"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteEntries([item._id])}
                        disabled={busy}
                        title="Видалити запис"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || busy}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-xs text-slate-500">Сторінка {page} з {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page >= pages || busy}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            Далі
          </button>
        </div>
      )}
    </div>
  );
};
