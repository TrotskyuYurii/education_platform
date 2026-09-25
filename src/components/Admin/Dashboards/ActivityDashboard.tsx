import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import {
  Activity,
  ArrowLeft,
  LogIn,
  Users,
  Clock,
  UserCheck,
  Target,
  CalendarDays,
  ShieldAlert,
  TimerOff,
  BookOpen,
  Award,
  PenLine,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronRight,
  MousePointerClick
} from 'lucide-react';
import { deltaPercent, formatUsageTime } from '../../../../shared/activityDashboard';
import { DrilldownDialog } from '../../DrilldownDialog';
import { ActivityDashboardData, ActivityDrill, buildActivityDrilldown, fullDay, WEEKDAYS } from './activityDrilldowns';

// Два ряди на одному графіку: синій і бурштиновий розрізняються і при
// порушеннях кольорового зору (перевірено валідатором палітри).
const SERIES_PRIMARY = '#2563eb';
const SERIES_SECONDARY = '#d97706';
const GRID = '#e2e8f0';
const AXIS_TICK = { fill: '#64748b', fontSize: 12 };
const TOOLTIP_STYLE = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const CLICKABLE_CHART = { cursor: 'pointer' };

const PRESETS = [
  { days: 7, label: '7 днів' },
  { days: 30, label: '30 днів' },
  { days: 90, label: '90 днів' }
];

/** 'YYYY-MM-DD' у локальному часі — формат, який чекають <input type="date"> і сервер. */
const toDayString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const presetRange = (days: number) => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toDayString(from), to: toDayString(to) };
};

const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const formatNumber = (n: number) => n.toLocaleString('uk-UA');

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/** Клік по графіку recharts → рядок даних під курсором (день, година, день тижня). */
const pickFrom = <T,>(rows: T[], onPick: (row: T) => void) => (state: any) => {
  const index = Number(state?.activeTooltipIndex);
  if (Number.isInteger(index) && rows[index]) onPick(rows[index]);
};

/** Рядок таблиці, що відкриває деталізацію, — і мишею, і з клавіатури. */
const clickableRow = (onOpen: () => void) => ({
  onClick: onOpen,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onOpen(); },
  tabIndex: 0,
  className: 'group cursor-pointer hover:bg-purple-50/60 focus:outline-hidden focus-visible:bg-purple-50'
});

const DeltaBadge: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  const delta = deltaPercent(current, previous);
  if (delta === null) return <span className="text-[11px] text-slate-400">немає даних для порівняння</span>;
  if (delta === 0) return <span className="text-[11px] font-semibold text-slate-500">без змін</span>;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      <Icon className="w-3.5 h-3.5" />
      {up ? '+' : ''}{delta}% до попереднього періоду
    </span>
  );
};

const KpiCard: React.FC<{
  icon: React.ElementType;
  tone: string;
  label: string;
  value: string;
  hint?: React.ReactNode;
  /** Клік відкриває перелік, з якого складається число. */
  onOpenDetails: () => void;
}> = ({ icon: Icon, tone, label, value, hint, onOpenDetails }) => (
  <button
    type="button"
    onClick={onOpenDetails}
    title="Показати, хто саме пораховано"
    className="group text-left bg-white rounded-2xl p-5 border border-slate-200 shadow-xs transition hover:border-purple-300 hover:shadow-md cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500"
  >
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
    </div>
    <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    {hint && <div className="mt-1.5">{hint}</div>}
    <div className="mt-2 text-[11px] font-semibold text-purple-700 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition">
      Показати, хто саме
    </div>
  </button>
);

const MiniStat: React.FC<{ icon: React.ElementType; label: string; value: string; title?: string; onOpenDetails: () => void }> = ({
  icon: Icon, label, value, title, onOpenDetails
}) => (
  <button
    type="button"
    onClick={onOpenDetails}
    title={title ? `${title}. Натисніть, щоб побачити деталі` : 'Натисніть, щоб побачити деталі'}
    className="group flex items-center gap-3 text-left bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 transition hover:bg-white hover:border-purple-300 hover:shadow-xs cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500"
  >
    <Icon className="w-4 h-4 text-slate-500 shrink-0 group-hover:text-purple-600 transition" />
    <div className="min-w-0 grow">
      <div className="text-[11px] text-slate-500 leading-tight">{label}</div>
      <div className="text-sm font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 shrink-0 transition" />
  </button>
);

const ChartCard: React.FC<{ title: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({ title, subtitle, className = '', children }) => (
  <div className={`bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs ${className}`}>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

const EmptyChart: React.FC<{ text?: string }> = ({ text = 'За цей період даних немає' }) => (
  <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">{text}</div>
);

/** Рейтинговий список зі смужкою частки від лідера; кожен пункт відкриває, хто саме його відкривав. */
const RankList: React.FC<{ items: Array<{ key: string; label: string; value: number; sub: string; onOpen: () => void }> }> = ({ items }) => {
  if (items.length === 0) return <EmptyChart />;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <ol className="space-y-1">
      {items.map((item, idx) => (
        <li key={item.key}>
          <button
            type="button"
            onClick={item.onOpen}
            className="group w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-purple-50/60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500"
            title="Показати, хто саме відкривав"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-800 truncate group-hover:text-purple-800" title={item.label}>
                <span className="text-slate-400 tabular-nums mr-1.5">{idx + 1}.</span>{item.label}
              </span>
              <span className="text-slate-900 font-semibold tabular-nums shrink-0">{formatNumber(item.value)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 grow bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: SERIES_PRIMARY }} />
              </div>
              <span className="text-[11px] text-slate-500 shrink-0 w-24 text-right group-hover:text-purple-700">{item.sub}</span>
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
};

const ClickHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
    <MousePointerClick className="w-3.5 h-3.5" /> {children}
  </p>
);

interface ActivityDashboardProps {
  onBack: () => void;
}

export const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ onBack }) => {
  const [range, setRange] = useState(() => presetRange(30));
  const [data, setData] = useState<ActivityDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Стек деталізацій: з переліку можна перейти глибше (день → людина) і повернутися назад.
  const [drills, setDrills] = useState<ActivityDrill[]>([]);
  const openDrill = useCallback((drill: ActivityDrill) => setDrills([drill]), []);
  const pushDrill = useCallback((drill: ActivityDrill) => setDrills(stack => [...stack, drill]), []);
  const popDrill = useCallback(() => setDrills(stack => stack.slice(0, -1)), []);
  // Хук доступності модалки запам'ятовує onClose при відкритті (Escape), тож
  // передаємо функцію, яка не залежить від стану рендера.
  const closeDrill = useCallback(() => setDrills([]), []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/v2/activity/dashboard?${qs}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Не вдалося завантажити дашборд');
      setData(body);
    } catch (err: any) {
      setError(err.message || 'Не вдалося завантажити дашборд');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const activePreset = PRESETS.find(p => {
    const r = presetRange(p.days);
    return r.from === range.from && r.to === range.to;
  })?.days;

  const currentDrill = drills[drills.length - 1];
  const drilldown = useMemo(
    () => (data && currentDrill ? buildActivityDrilldown(currentDrill, data, pushDrill) : null),
    [data, currentDrill, pushDrill]
  );

  const t = data?.totals;
  const hasDaily = Boolean(data?.daily.some(d => d.logins > 0 || d.activeUsers > 0));
  const hasTime = Boolean(data?.daily.some(d => d.minutes > 0));
  const hasLogins = Boolean(data && data.totals.logins > 0);
  const trackingStartedLater = Boolean(data?.usageTrackedSince && data.usageTrackedSince > data.period.from);
  const openDay = (d: { day: string }) => openDrill({ kind: 'day', day: d.day });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-700 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Усі дашборди
          </button>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-purple-600" />
            Активність
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Входи, активні користувачі та час, проведений у навчальному порталі за обраний період.
            Натисніть на будь-який показник, стовпчик чи рядок, щоб побачити, хто саме пораховано.
          </p>
        </div>

        {/* Period filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => setRange(presetRange(p.days))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activePreset === p.days ? 'bg-white text-purple-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={e => e.target.value && setRange(r => ({ ...r, from: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
              aria-label="Початок періоду"
            />
            <span className="text-slate-400 text-xs">—</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
              aria-label="Кінець періоду"
            />
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 transition"
            title="Оновити дані"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Оновити
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {!data && isLoading && (
        <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 text-purple-600 animate-spin" /></div>
      )}

      {drilldown && (
        <DrilldownDialog
          // Новий ключ на кожному кроці: пошук і вкладки не переносяться з попереднього переліку.
          key={drills.length}
          {...drilldown}
          onClose={closeDrill}
          onBack={drills.length > 1 ? popDrill : undefined}
        />
      )}

      {data && t && (
        <div className={`space-y-6 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <p className="text-xs text-slate-500">
            Період: <b className="text-slate-700">{fullDay(data.period.from)} — {fullDay(data.period.to)}</b> ({data.period.days} дн.).
            Порівняння — з {fullDay(data.period.previous.from)} — {fullDay(data.period.previous.to)}.
          </p>

          {trackingStartedLater && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <Info className="w-4 h-4 shrink-0 mt-px" />
              <span>Облік часу в додатку ведеться з {fullDay(data.usageTrackedSince!)} — за попередні дні час не показується.</span>
            </div>
          )}

          {/* Main KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              icon={LogIn}
              tone="bg-blue-50 text-blue-600"
              label="Кількість входів"
              value={formatNumber(t.logins)}
              hint={<DeltaBadge current={t.logins} previous={data.previous.logins} />}
              onOpenDetails={() => openDrill({ kind: 'logins' })}
            />
            <KpiCard
              icon={Users}
              tone="bg-emerald-50 text-emerald-600"
              label="Активні користувачі"
              value={formatNumber(t.activeUsers)}
              hint={<DeltaBadge current={t.activeUsers} previous={data.previous.activeUsers} />}
              onOpenDetails={() => openDrill({ kind: 'active' })}
            />
            <KpiCard
              icon={Clock}
              tone="bg-amber-50 text-amber-600"
              label="Час у додатку"
              value={formatUsageTime(t.totalSeconds)}
              hint={<DeltaBadge current={t.totalSeconds} previous={data.previous.totalSeconds} />}
              onOpenDetails={() => openDrill({ kind: 'time' })}
            />
            <KpiCard
              icon={UserCheck}
              tone="bg-purple-50 text-purple-600"
              label="Середній час на користувача"
              value={formatUsageTime(t.avgSecondsPerActiveUser)}
              hint={<span className="text-[11px] text-slate-400">за весь період</span>}
              onOpenDetails={() => openDrill({ kind: 'time' })}
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat
              icon={Target}
              label="Охоплення"
              value={`${t.coveragePercent}% (${t.registeredUsers - t.inactiveUsers} з ${t.registeredUsers})`}
              title="Частка співробітників з чинним обліковим записом, які хоч раз заходили за період"
              onOpenDetails={() => openDrill({ kind: 'coverage' })}
            />
            <MiniStat icon={Users} label="Не заходили" value={formatNumber(t.inactiveUsers)} onOpenDetails={() => openDrill({ kind: 'coverage', initialFilter: 'inactive' })} />
            <MiniStat icon={CalendarDays} label="Активних за день (сер.)" value={String(t.avgDailyActiveUsers).replace('.', ',')} onOpenDetails={() => openDrill({ kind: 'daily' })} />
            <MiniStat icon={BookOpen} label="Перегляди матеріалів" value={formatNumber(t.materialViews)} onOpenDetails={() => openDrill({ kind: 'materialViews' })} />
            <MiniStat icon={Award} label="Тести та кейси" value={formatNumber(t.quizAttempts)} onOpenDetails={() => openDrill({ kind: 'quizzes' })} />
            <MiniStat icon={PenLine} label="Підписані ознайомлення" value={formatNumber(t.acknowledgements)} onOpenDetails={() => openDrill({ kind: 'acknowledgements' })} />
            <MiniStat icon={ShieldAlert} label="Невдалі входи" value={formatNumber(t.failedLogins)} onOpenDetails={() => openDrill({ kind: 'failed' })} />
            <MiniStat
              icon={TimerOff}
              label="Автовиходи"
              value={formatNumber(t.autoLogouts)}
              title="Автоматичні виходи через бездіяльність"
              onOpenDetails={() => openDrill({ kind: 'autoLogouts' })}
            />
          </div>

          {/* Daily charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Входи та активні користувачі" subtitle="По днях обраного періоду">
              {hasDaily ? (
                <>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} onClick={pickFrom(data.daily, openDay)} style={CLICKABLE_CHART}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                        <XAxis dataKey="day" tickFormatter={shortDay} axisLine={false} tickLine={false} tick={AXIS_TICK} minTickGap={16} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d: any) => fullDay(String(d))} />
                        <Legend iconType="circle" />
                        <Line type="monotone" dataKey="logins" name="Входи" stroke={SERIES_PRIMARY} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="activeUsers" name="Активні користувачі" stroke={SERIES_SECONDARY} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <ClickHint>Натисніть на день, щоб побачити, хто саме був у порталі</ClickHint>
                </>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Час у додатку, хв" subtitle="Сумарно за всіма користувачами по днях">
              {hasTime ? (
                <>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} onClick={pickFrom(data.daily, openDay)} style={CLICKABLE_CHART}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                        <XAxis dataKey="day" tickFormatter={shortDay} axisLine={false} tickLine={false} tick={AXIS_TICK} minTickGap={16} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <Tooltip
                          cursor={{ fill: '#f1f5f9' }}
                          contentStyle={TOOLTIP_STYLE}
                          labelFormatter={(d: any) => fullDay(String(d))}
                          formatter={(v: any) => [formatUsageTime(Number(v) * 60), 'Час у додатку']}
                        />
                        <Bar dataKey="minutes" name="Хвилини" fill={SERIES_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ClickHint>Натисніть на стовпчик, щоб побачити, хто скільки часу провів того дня</ClickHint>
                </>
              ) : <EmptyChart text="Час у додатку за цей період ще не накопичився" />}
            </ChartCard>
          </div>

          {/* When people log in */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <ChartCard title="Входи за годинами доби" subtitle="Коли співробітники найчастіше заходять" className="xl:col-span-2">
              {hasLogins ? (
                <>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byHour} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} onClick={pickFrom(data.byHour, h => openDrill({ kind: 'hour', hour: h.hour }))} style={CLICKABLE_CHART}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                        <XAxis dataKey="hour" tickFormatter={(h: any) => `${h}:00`} axisLine={false} tickLine={false} tick={AXIS_TICK} interval={2} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={TOOLTIP_STYLE} labelFormatter={(h: any) => `${h}:00 – ${h}:59`} formatter={(v: any) => [v, 'Входи']} />
                        <Bar dataKey="logins" fill={SERIES_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ClickHint>Натисніть на годину, щоб побачити, хто входив</ClickHint>
                </>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Входи за днями тижня">
              {hasLogins ? (
                <>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byWeekday} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} onClick={pickFrom(data.byWeekday, w => openDrill({ kind: 'weekday', weekday: w.weekday }))} style={CLICKABLE_CHART}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                        <XAxis dataKey="weekday" tickFormatter={(w: any) => WEEKDAYS[Number(w) - 1]} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={TOOLTIP_STYLE} labelFormatter={(w: any) => WEEKDAYS[Number(w) - 1]} formatter={(v: any) => [v, 'Входи']} />
                        <Bar dataKey="logins" fill={SERIES_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ClickHint>Натисніть на день тижня</ClickHint>
                </>
              ) : <EmptyChart />}
            </ChartCard>
          </div>

          {/* What people use */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Популярні розділи" subtitle="Скільки разів відкривали розділ · натисніть, щоб побачити хто">
              <RankList
                items={data.topPages.map(p => ({
                  key: p.page, label: p.label, value: p.views, sub: `${p.users} корист.`,
                  onOpen: () => openDrill({ kind: 'page', page: p.page })
                }))}
              />
            </ChartCard>
            <ChartCard title="Популярні матеріали" subtitle="Найчастіше відкриті навчальні матеріали · натисніть, щоб побачити хто">
              <RankList
                items={data.topMaterials.map(m => ({
                  key: m.title, label: m.title, value: m.views, sub: `${m.users} корист.`,
                  onOpen: () => openDrill({ kind: 'material', title: m.title })
                }))}
              />
            </ChartCard>
          </div>

          {/* Top users */}
          <ChartCard title="Найактивніші користувачі" subtitle="За часом у додатку, потім за кількістю днів з активністю · натисніть на людину, щоб побачити її дні">
            {data.topUsers.length > 0 ? (
              <div className="overflow-x-auto -mx-5 sm:-mx-6">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                      <th className="font-semibold px-5 sm:px-6 py-2">Користувач</th>
                      <th className="font-semibold px-3 py-2">Підрозділ</th>
                      <th className="font-semibold px-3 py-2 text-right">Час</th>
                      <th className="font-semibold px-3 py-2 text-right">Входи</th>
                      <th className="font-semibold px-3 py-2 text-right">Днів</th>
                      <th className="font-semibold px-3 py-2 text-right">Матеріали</th>
                      <th className="font-semibold px-3 py-2 text-right">Тести</th>
                      <th className="font-semibold px-5 sm:px-6 py-2 text-right">Остання дія</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topUsers.map(u => (
                      <tr key={u.id} {...clickableRow(() => openDrill({ kind: 'person', id: u.id }))}>
                        <td className="px-5 sm:px-6 py-2.5">
                          <div className="font-semibold text-slate-900 group-hover:text-purple-800">{u.name}</div>
                          {u.email && u.email !== u.name && <div className="text-xs text-slate-500">{u.email}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{u.department}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">{formatUsageTime(u.seconds)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{u.logins}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{u.activeDays}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{u.materialViews}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{u.quizAttempts}</td>
                        <td className="px-5 sm:px-6 py-2.5 text-right text-slate-500 whitespace-nowrap">{formatDateTime(u.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyChart />}
          </ChartCard>

          {/* Departments */}
          <ChartCard title="Охоплення за підрозділами" subtitle="Скільки співробітників підрозділу заходили за період · натисніть на підрозділ, щоб побачити людей">
            {data.departments.length > 0 ? (
              <div className="overflow-x-auto -mx-5 sm:-mx-6">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                      <th className="font-semibold px-5 sm:px-6 py-2">Підрозділ</th>
                      <th className="font-semibold px-3 py-2 text-right">Активні / всього</th>
                      <th className="font-semibold px-3 py-2 w-[30%]">Охоплення</th>
                      <th className="font-semibold px-5 sm:px-6 py-2 text-right">Час у додатку</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.departments.map(d => {
                      const pct = d.users > 0 ? Math.round((d.activeUsers / d.users) * 100) : 0;
                      return (
                        <tr key={d.name} {...clickableRow(() => openDrill({ kind: 'department', name: d.name }))}>
                          <td className="px-5 sm:px-6 py-2.5 font-medium text-slate-800 group-hover:text-purple-800">{d.name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{d.activeUsers} / {d.users}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 grow bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SERIES_PRIMARY }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-5 sm:px-6 py-2.5 text-right tabular-nums whitespace-nowrap">{formatUsageTime(d.seconds)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyChart />}
          </ChartCard>

          <p className="flex items-start gap-2 text-[11px] text-slate-400">
            <TimerOff className="w-3.5 h-3.5 shrink-0 mt-px" />
            Час у додатку — це активний час: він накопичується, поки людина працює з порталом. Перерви довші за 5 хвилин без жодної дії не враховуються.
          </p>
        </div>
      )}
    </div>
  );
};
