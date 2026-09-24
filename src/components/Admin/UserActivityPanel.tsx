import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Footprints,
  LogIn,
  LogOut,
  ShieldAlert,
  KeyRound,
  TimerOff,
  MousePointerClick,
  BookOpen,
  Award,
  PenLine,
  RefreshCw,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Users,
  CalendarDays,
  X
} from 'lucide-react';

type ActivityType =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'OTP_SENT'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  | 'NAVIGATE'
  | 'MATERIAL_VIEW'
  | 'QUIZ_ATTEMPT'
  | 'ACKNOWLEDGEMENT_SIGNED';

interface ActivityItem {
  _id: string;
  userId?: string;
  userLabel?: string;
  type: ActivityType;
  page?: string;
  title?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

interface ActivityUser {
  id: string;
  label: string;
  lastSeenAt: string;
}

interface ActivityStats {
  eventsToday: number;
  loginsToday: number;
  activeUsersToday: number;
}

const TYPE_META: Record<ActivityType, { label: string; icon: React.ElementType; chip: string }> = {
  LOGIN: { label: 'Вхід', icon: LogIn, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LOGIN_FAILED: { label: 'Невдалий вхід', icon: ShieldAlert, chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  OTP_SENT: { label: 'Код входу', icon: KeyRound, chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  LOGOUT: { label: 'Вихід', icon: LogOut, chip: 'bg-slate-100 text-slate-700 border-slate-200' },
  SESSION_EXPIRED: { label: 'Вихід через бездіяльність', icon: TimerOff, chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  NAVIGATE: { label: 'Перехід', icon: MousePointerClick, chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  MATERIAL_VIEW: { label: 'Перегляд матеріалу', icon: BookOpen, chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  QUIZ_ATTEMPT: { label: 'Тестування', icon: Award, chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  ACKNOWLEDGEMENT_SIGNED: { label: 'Підпис ознайомлення', icon: PenLine, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

// Назви розділів такі самі, як у меню, щоб адміністратор упізнавав їх одразу.
const PAGE_LABELS: Record<string, string> = {
  myday: 'Мій день',
  catalog: 'Навчальні матеріали',
  manual: 'Навчальні матеріали (перегляд)',
  quiz: 'Тестування (Квіз)',
  cases: 'Кейси',
  onboarding: 'Онбординг',
  people: 'Люди',
  signoff: 'Підтвердження',
  dashboard: 'Профіль',
  about: 'Про додаток'
};

const ADMIN_PAGE_LABELS: Record<string, string> = {
  list: 'Інструкції',
  courses: 'Курси',
  cases: 'Кейси',
  knowledge: 'База знань',
  assignments: 'Призначення',
  onboarding: 'Онбординг',
  help: 'Допомога / Шаблон',
  users: 'Користувачі',
  roles: 'Ролі та права',
  organization: 'Організація',
  notifications: 'Сповіщення',
  analytics: 'Аналітика',
  systemlog: 'Журнал',
  activity: 'Журнал дій'
};

// Незнайомий ключ показуємо як є — новий розділ не зламає журнал.
const pageLabel = (page?: string): string => {
  if (!page) return '—';
  if (page.startsWith('management:')) {
    const sub = page.slice('management:'.length);
    return `Адміністрування → ${ADMIN_PAGE_LABELS[sub] || sub}`;
  }
  return PAGE_LABELS[page] || page;
};

const describe = (item: ActivityItem): string => {
  if (item.type === 'NAVIGATE') return `Перейшов у розділ «${pageLabel(item.page)}»`;
  if (item.type === 'MATERIAL_VIEW') return `Відкрив матеріал «${item.title || '—'}»`;
  return item.title || TYPE_META[item.type]?.label || item.type;
};

/** Коротко: браузер і система — повний рядок є в деталях. */
const shortUserAgent = (ua?: string): string => {
  if (!ua) return '';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Браузер';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser}, ${os}` : browser;
};

/** 'YYYY-MM-DD' у локальному часі — саме такий формат чекає <input type="date"> і сервер. */
const toDayString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDayString(d);
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatDayHeading = (value: string) =>
  new Date(value).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const PERIODS = [
  { key: 'today', label: 'Сьогодні', from: () => daysAgo(0) },
  { key: '7d', label: '7 днів', from: () => daysAgo(6) },
  { key: '30d', label: '30 днів', from: () => daysAgo(29) },
  { key: 'all', label: 'Увесь час', from: () => '' }
] as const;

const selectClass =
  'px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

export const UserActivityPanel: React.FC = () => {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<ActivityUser[]>([]);
  const [stats, setStats] = useState<ActivityStats>({ eventsToday: 0, loginsToday: 0, activeUsersToday: 0 });
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userFilter, setUserFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Швидке перемикання фільтрів запускає кілька запитів — показуємо лише останній.
  const requestSeq = useRef(0);

  const fetchActivity = useCallback(async () => {
    const seq = ++requestSeq.current;
    setError(null);
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ type: typeFilter, page: String(page), limit: '50' });
      if (userFilter !== 'all') params.set('userId', userFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (appliedSearch) params.set('search', appliedSearch);

      const res = await fetch(`/api/v2/activity?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (seq !== requestSeq.current) return;
      if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити журнал дій');

      setItems(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setUsers(data.users || []);
      if (data.stats) setStats(data.stats);
    } catch (err: any) {
      if (seq === requestSeq.current) setError(err.message || 'Помилка завантаження журналу дій');
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [typeFilter, userFilter, from, to, appliedSearch, page]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Зміна будь-якого фільтра повертає на першу сторінку, інакше можна опинитись
  // на неіснуючій сторінці меншої вибірки.
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setPage(1);
    setter(value);
  };
  const changeUser = resetPage(setUserFilter);
  const changeType = resetPage(setTypeFilter);
  const changeFrom = resetPage(setFrom);
  const changeTo = resetPage(setTo);
  const changeSearch = resetPage(setAppliedSearch);

  const activePeriod = PERIODS.find(p => p.from() === from && !to)?.key;

  const groupedByDay = useMemo(() => {
    const groups: Array<{ day: string; heading: string; items: ActivityItem[] }> = [];
    for (const item of items) {
      const day = toDayString(new Date(item.createdAt));
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(item);
      else groups.push({ day, heading: formatDayHeading(item.createdAt), items: [item] });
    }
    return groups;
  }, [items]);

  const selectedUserLabel = users.find(u => u.id === userFilter)?.label;

  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Footprints className="w-5 h-5 text-purple-600" /> Журнал дій користувачів
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Хто і коли заходив у систему, які розділи відкривав, які матеріали переглядав і які тести проходив.
            Доступно лише адміністраторам. Записи зберігаються обмежений час і видаляються автоматично.
          </p>
        </div>
        <button
          onClick={fetchActivity}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Оновити
        </button>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Подій сьогодні', value: stats.eventsToday, icon: Footprints },
          { label: 'Входів сьогодні', value: stats.loginsToday, icon: LogIn },
          { label: 'Активних користувачів сьогодні', value: stats.activeUsersToday, icon: Users }
        ].map(card => (
          <div key={card.label} className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-600">
              <card.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 leading-tight">{card.value}</div>
              <div className="text-[11px] text-slate-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => { changeFrom(p.from()); changeTo(''); }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  activePeriod === p.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" /> з
            <input type="date" value={from} max={to || undefined} onChange={e => changeFrom(e.target.value)} className={selectClass} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            по
            <input type="date" value={to} min={from || undefined} onChange={e => changeTo(e.target.value)} className={selectClass} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={userFilter} onChange={e => changeUser(e.target.value)} className={`${selectClass} max-w-[260px]`}>
            <option value="all">Усі користувачі</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>

          <select value={typeFilter} onChange={e => changeType(e.target.value)} className={selectClass}>
            <option value="all">Усі події</option>
            <option value="auth">Входи та виходи</option>
            {(Object.keys(TYPE_META) as ActivityType[]).map(t => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>

          <form
            onSubmit={e => { e.preventDefault(); changeSearch(search.trim()); }}
            className="flex items-center gap-1.5 grow min-w-[200px]"
          >
            <div className="relative grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук за іменем, email, матеріалом або IP…"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">
              Знайти
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl px-4 py-3">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Записів у вибірці: <strong className="text-slate-800">{total}</strong></span>
        {selectedUserLabel && (
          <button
            onClick={() => changeUser('all')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold hover:bg-purple-200"
            title="Показати всіх користувачів"
          >
            {selectedUserLabel} <X className="w-3 h-3" />
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
          <Footprints className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Подій не знайдено</p>
          <p className="text-sm text-slate-500 mt-1">Спробуйте розширити період або змінити фільтри.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map(group => (
            <div key={group.day}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">{group.heading}</div>
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                {group.items.map(item => {
                  const meta = TYPE_META[item.type] || TYPE_META.NAVIGATE;
                  const Icon = meta.icon;
                  const isOpen = expanded.has(item._id);
                  return (
                    <div key={item._id} className="px-3.5 py-2.5">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-mono text-slate-400 pt-1.5 w-16 shrink-0">{formatTime(item.createdAt)}</span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta.chip}`} title={meta.label}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {item.userId ? (
                              <button
                                onClick={() => changeUser(item.userId!)}
                                className="text-sm font-semibold text-slate-900 hover:text-purple-700 hover:underline"
                                title="Показати лише дії цього користувача"
                              >
                                {item.userLabel || 'Без імені'}
                              </button>
                            ) : (
                              <span className="text-sm font-semibold text-slate-900">{item.userLabel || 'Невідомий'}</span>
                            )}
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.chip}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 break-words">{describe(item)}</p>
                          <button
                            onClick={() => toggleExpanded(item._id)}
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700"
                          >
                            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {[shortUserAgent(item.userAgent), item.ip].filter(Boolean).join(' · ') || 'Деталі'}
                          </button>
                          {isOpen && (
                            <div className="mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-0.5 break-words">
                              <div><span className="text-slate-400">Час:</span> {new Date(item.createdAt).toLocaleString('uk-UA')}</div>
                              {item.page && <div><span className="text-slate-400">Розділ:</span> {pageLabel(item.page)}</div>}
                              {item.ip && <div><span className="text-slate-400">IP-адреса:</span> {item.ip}</div>}
                              {item.userAgent && <div><span className="text-slate-400">Браузер:</span> {item.userAgent}</div>}
                              {item.details && Object.keys(item.details).length > 0 && (
                                <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-slate-500">
                                  {JSON.stringify(item.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || refreshing}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-xs text-slate-500">Сторінка {page} з {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page >= pages || refreshing}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            Далі
          </button>
        </div>
      )}
    </div>
  );
};
