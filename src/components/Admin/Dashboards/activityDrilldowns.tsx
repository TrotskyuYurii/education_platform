import React from 'react';
import {
  LogIn, Users, Clock, Target, CalendarDays, BookOpen, Award, PenLine, ShieldAlert, TimerOff,
  MousePointerClick, Building2, User as UserIcon, CalendarClock
} from 'lucide-react';
import { formatUsageTime } from '../../../../shared/activityDashboard';
import type { DrilldownColumn, DrilldownConfig } from '../../DrilldownDialog';

export interface ActivityPerson {
  id: string;
  name: string;
  email: string;
  department: string;
  seconds: number;
  logins: number;
  activeDays: number;
  materialViews: number;
  quizAttempts: number;
  autoLogouts: number;
  acknowledgements: number;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  /** Чинний обліковий запис — саме серед них рахується охоплення. */
  registered: boolean;
  /** Був у застосунку за період. */
  active: boolean;
}

export interface UserCount {
  id: string;
  n: number;
}

export interface ActivityDashboardData {
  period: { from: string; to: string; days: number; previous: { from: string; to: string } };
  totals: {
    logins: number;
    activeUsers: number;
    totalSeconds: number;
    avgSecondsPerActiveUser: number;
    avgDailyActiveUsers: number;
    failedLogins: number;
    autoLogouts: number;
    materialViews: number;
    quizAttempts: number;
    acknowledgements: number;
    registeredUsers: number;
    inactiveUsers: number;
    coveragePercent: number;
  };
  previous: { logins: number; activeUsers: number; totalSeconds: number };
  daily: Array<{ day: string; logins: number; activeUsers: number; minutes: number }>;
  /** День → хто був активний і скільки разів входив та працював саме того дня. */
  dailyUsers: Record<string, Array<{ id: string; logins: number; seconds: number }>>;
  byHour: Array<{ hour: number; logins: number; users: UserCount[] }>;
  byWeekday: Array<{ weekday: number; logins: number; users: UserCount[] }>;
  topPages: Array<{ page: string; label: string; views: number; users: number; byUser: UserCount[] }>;
  topMaterials: Array<{ title: string; views: number; users: number; byUser: UserCount[] }>;
  failedLogins: Array<{ key: string; userId: string | null; label: string; count: number; lastAt: string }>;
  topUsers: ActivityPerson[];
  people: ActivityPerson[];
  departments: Array<{ name: string; users: number; activeUsers: number; seconds: number }>;
  usageTrackedSince: string | null;
}

/** Що саме розгорнули: показник, стовпчик графіка, рядок рейтингу чи таблиці. */
export type ActivityDrill =
  | { kind: 'logins' }
  | { kind: 'active' }
  | { kind: 'time' }
  | { kind: 'coverage'; initialFilter?: 'all' | 'active' | 'inactive' }
  | { kind: 'daily' }
  | { kind: 'day'; day: string }
  | { kind: 'materialViews' }
  | { kind: 'quizzes' }
  | { kind: 'acknowledgements' }
  | { kind: 'failed' }
  | { kind: 'autoLogouts' }
  | { kind: 'hour'; hour: number }
  | { kind: 'weekday'; weekday: number }
  | { kind: 'page'; page: string }
  | { kind: 'material'; title: string }
  | { kind: 'department'; name: string }
  | { kind: 'person'; id: string };

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAY_NAMES = ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'];

export const fullDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
const weekdayOf = (day: string) => WEEKDAY_NAMES[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7];
const formatNumber = (n: number) => n.toLocaleString('uk-UA');
const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const pluralUsers = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'користувач';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'користувачі';
  return 'користувачів';
};
const usersCount = (n: number) => `${formatNumber(n)} ${pluralUsers(n)}`;

// ---- Спільні колонки для переліків людей ----

type PersonRow = ActivityPerson & { n?: number; daySeconds?: number; dayLogins?: number };

const colUser: DrilldownColumn<PersonRow> = {
  key: 'user',
  header: 'Користувач',
  render: u => (
    <>
      <div className="font-semibold text-slate-900">{u.name}</div>
      {u.email && u.email !== u.name && <div className="text-xs text-slate-500">{u.email}</div>}
    </>
  )
};
const colDept: DrilldownColumn<PersonRow> = { key: 'dept', header: 'Підрозділ', render: u => <span className="text-slate-600">{u.department}</span> };
const colNum = (key: string, header: string, value: (u: PersonRow) => number, strong = false): DrilldownColumn<PersonRow> => ({
  key,
  header,
  align: 'right',
  render: u => <span className={strong ? 'font-semibold text-slate-900' : ''}>{formatNumber(value(u))}</span>
});
const colTime = (key: string, header: string, value: (u: PersonRow) => number, strong = false): DrilldownColumn<PersonRow> => ({
  key,
  header,
  align: 'right',
  render: u => <span className={strong ? 'font-semibold text-slate-900' : ''}>{formatUsageTime(value(u))}</span>
});
const colDate = (key: string, header: string, value: (u: PersonRow) => string | null): DrilldownColumn<PersonRow> => ({
  key,
  header,
  align: 'right',
  render: u => <span className="text-slate-500">{formatDateTime(value(u))}</span>
});
const colStatus: DrilldownColumn<PersonRow> = {
  key: 'status',
  header: 'Статус',
  render: u => u.active
    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Заходив</span>
    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Не заходив</span>
};

const personSearch = (u: PersonRow) => `${u.name} ${u.email} ${u.department}`;
const byName = (a: PersonRow, b: PersonRow) => a.name.localeCompare(b.name, 'uk');

const personList = (
  base: Omit<DrilldownConfig<PersonRow>, 'rowKey' | 'searchText' | 'searchPlaceholder' | 'onRowClick'>,
  openPerson: (id: string) => void
): DrilldownConfig<PersonRow> => ({
  ...base,
  rowKey: u => u.id,
  searchText: personSearch,
  searchPlaceholder: 'Пошук за іменем, email або підрозділом',
  onRowClick: u => openPerson(u.id),
  emptyText: base.emptyText || 'За цей період таких користувачів немає'
});

const presenceFilters = [
  { key: 'all', label: 'Усі', predicate: (u: PersonRow) => true },
  { key: 'active', label: 'Заходили', predicate: (u: PersonRow) => u.active },
  { key: 'inactive', label: 'Не заходили', predicate: (u: PersonRow) => !u.active }
];

/**
 * Опис вікна деталізації для будь-якого блоку дашборда «Активність».
 *
 * Кожен перелік збирається з тих самих даних, з яких пораховано число на
 * екрані, тож сума в деталізації завжди збігається з показником.
 */
export function buildActivityDrilldown(
  drill: ActivityDrill,
  data: ActivityDashboardData,
  open: (next: ActivityDrill) => void
): DrilldownConfig<any> {
  const period = `${fullDay(data.period.from)} — ${fullDay(data.period.to)}`;
  const peopleById = new Map(data.people.map(p => [p.id, p]));
  const openPerson = (id: string) => open({ kind: 'person', id });
  const withCounts = (list: UserCount[]): PersonRow[] =>
    list.map(c => (peopleById.get(c.id) ? { ...peopleById.get(c.id)!, n: c.n } : null)).filter(Boolean) as PersonRow[];
  const where = (pred: (p: ActivityPerson) => boolean, sort: (a: PersonRow, b: PersonRow) => number) =>
    data.people.filter(pred).sort((a, b) => sort(a, b) || byName(a, b));

  switch (drill.kind) {
    case 'logins': {
      const rows = where(p => p.logins > 0, (a, b) => b.logins - a.logins);
      return personList({
        icon: LogIn, tone: 'bg-blue-50 text-blue-600',
        title: 'Хто входив у портал',
        subtitle: `${period} · ${usersCount(rows.length)} · ${formatNumber(data.totals.logins)} входів`,
        description: 'Кожен успішний вхід у систему. Одна людина могла входити кілька разів.',
        rows,
        columns: [colUser, colDept, colNum('logins', 'Входів', u => u.logins, true), colNum('days', 'Днів', u => u.activeDays), colDate('last', 'Останній вхід', u => u.lastLoginAt)]
      }, openPerson);
    }

    case 'active': {
      const rows = where(p => p.active, (a, b) => b.activeDays - a.activeDays || b.seconds - a.seconds);
      return personList({
        icon: Users, tone: 'bg-emerald-50 text-emerald-600',
        title: 'Активні користувачі',
        subtitle: `${period} · ${usersCount(rows.length)}`,
        description: 'Усі, хто за період хоч раз увійшов, відкрив розділ чи матеріал, пройшов тест або працював у додатку.',
        rows,
        columns: [colUser, colDept, colNum('days', 'Днів', u => u.activeDays, true), colNum('logins', 'Входів', u => u.logins), colTime('time', 'Час', u => u.seconds), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'time': {
      const rows = where(p => p.seconds > 0, (a, b) => b.seconds - a.seconds);
      return personList({
        icon: Clock, tone: 'bg-amber-50 text-amber-600',
        title: 'Час у додатку',
        subtitle: `${period} · ${formatUsageTime(data.totals.totalSeconds)} разом · ${usersCount(rows.length)}`,
        description: `Середній час на користувача (${formatUsageTime(data.totals.avgSecondsPerActiveUser)}) — це загальний час, поділений на кількість людей у цьому переліку.`,
        rows,
        columns: [
          colUser, colDept,
          colTime('time', 'Час', u => u.seconds, true),
          colNum('days', 'Днів', u => u.activeDays),
          colTime('perDay', 'Сер. за день', u => (u.activeDays > 0 ? u.seconds / u.activeDays : 0)),
          colDate('last', 'Остання дія', u => u.lastSeenAt)
        ],
        emptyText: 'Час у додатку за цей період ще не накопичився'
      }, openPerson);
    }

    case 'coverage': {
      const rows = where(p => p.registered, (a, b) => Number(b.active) - Number(a.active) || b.activeDays - a.activeDays);
      return personList({
        icon: Target, tone: 'bg-purple-50 text-purple-600',
        title: 'Охоплення співробітників',
        subtitle: `${period} · заходили ${formatNumber(data.totals.registeredUsers - data.totals.inactiveUsers)} з ${formatNumber(data.totals.registeredUsers)} (${data.totals.coveragePercent}%)`,
        description: 'Рахуються лише чинні облікові записи. «Не заходили» — ті, хто за весь період жодного разу не був у порталі.',
        rows,
        filters: presenceFilters,
        initialFilter: drill.initialFilter || 'all',
        columns: [colUser, colDept, colStatus, colNum('days', 'Днів', u => u.activeDays), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'daily': {
      const rows = [...data.daily].reverse();
      return {
        icon: CalendarDays, tone: 'bg-blue-50 text-blue-600',
        title: 'Активність по днях',
        subtitle: `${period} · у середньому ${String(data.totals.avgDailyActiveUsers).replace('.', ',')} активних за день`,
        description: 'Середнє — сума активних користувачів за всі дні, поділена на кількість днів періоду (включно з вихідними).',
        rows,
        rowKey: d => d.day,
        onRowClick: d => open({ kind: 'day', day: d.day }),
        columns: [
          { key: 'day', header: 'Дата', render: d => <><span className="font-medium text-slate-900">{fullDay(d.day)}</span> <span className="text-xs text-slate-400">{weekdayOf(d.day)}</span></> },
          { key: 'active', header: 'Активні', align: 'right', render: d => <span className="font-semibold text-slate-900">{d.activeUsers}</span> },
          { key: 'logins', header: 'Входи', align: 'right', render: d => d.logins },
          { key: 'time', header: 'Час', align: 'right', render: d => formatUsageTime(d.minutes * 60) }
        ]
      } as DrilldownConfig<ActivityDashboardData['daily'][number]>;
    }

    case 'day': {
      const rows = (data.dailyUsers[drill.day] || [])
        .map(e => (peopleById.get(e.id) ? { ...peopleById.get(e.id)!, dayLogins: e.logins, daySeconds: e.seconds } : null))
        .filter(Boolean) as PersonRow[];
      rows.sort((a, b) => (b.daySeconds || 0) - (a.daySeconds || 0) || (b.dayLogins || 0) - (a.dayLogins || 0) || byName(a, b));
      const summary = data.daily.find(d => d.day === drill.day);
      return personList({
        icon: CalendarClock, tone: 'bg-blue-50 text-blue-600',
        title: `${fullDay(drill.day)}, ${weekdayOf(drill.day)}`,
        subtitle: `${usersCount(rows.length)} · ${formatNumber(summary?.logins || 0)} входів · ${formatUsageTime((summary?.minutes || 0) * 60)} у додатку`,
        description: 'Хто був у порталі цього дня, скільки разів входив і скільки часу провів.',
        rows,
        columns: [colUser, colDept, colNum('logins', 'Входів', u => u.dayLogins || 0), colTime('time', 'Час', u => u.daySeconds || 0, true)],
        emptyText: 'Цього дня в порталі нікого не було'
      }, openPerson);
    }

    case 'materialViews': {
      const rows = where(p => p.materialViews > 0, (a, b) => b.materialViews - a.materialViews);
      return personList({
        icon: BookOpen, tone: 'bg-indigo-50 text-indigo-600',
        title: 'Хто переглядав матеріали',
        subtitle: `${period} · ${formatNumber(data.totals.materialViews)} переглядів · ${usersCount(rows.length)}`,
        description: 'Кожне відкриття навчального матеріалу. Які саме матеріали відкривали найчастіше — у блоці «Популярні матеріали».',
        rows,
        columns: [colUser, colDept, colNum('views', 'Переглядів', u => u.materialViews, true), colNum('days', 'Днів', u => u.activeDays), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'quizzes': {
      const rows = where(p => p.quizAttempts > 0, (a, b) => b.quizAttempts - a.quizAttempts);
      return personList({
        icon: Award, tone: 'bg-purple-50 text-purple-600',
        title: 'Хто проходив тести та кейси',
        subtitle: `${period} · ${formatNumber(data.totals.quizAttempts)} спроб · ${usersCount(rows.length)}`,
        description: 'Кожен завершений тест або набір кейсів. Результати — у дашборді «Аналітика та прогрес навчання».',
        rows,
        columns: [colUser, colDept, colNum('quiz', 'Спроб', u => u.quizAttempts, true), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'acknowledgements': {
      const rows = where(p => p.acknowledgements > 0, (a, b) => b.acknowledgements - a.acknowledgements);
      return personList({
        icon: PenLine, tone: 'bg-emerald-50 text-emerald-600',
        title: 'Хто підписав ознайомлення',
        subtitle: `${period} · ${formatNumber(data.totals.acknowledgements)} підписів · ${usersCount(rows.length)}`,
        rows,
        columns: [colUser, colDept, colNum('ack', 'Підписів', u => u.acknowledgements, true), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'autoLogouts': {
      const rows = where(p => p.autoLogouts > 0, (a, b) => b.autoLogouts - a.autoLogouts);
      return personList({
        icon: TimerOff, tone: 'bg-amber-50 text-amber-600',
        title: 'Автоматичні виходи через бездіяльність',
        subtitle: `${period} · ${formatNumber(data.totals.autoLogouts)} виходів · ${usersCount(rows.length)}`,
        description: 'Портал сам завершив сесію, бо людина довго нічого не робила.',
        rows,
        columns: [colUser, colDept, colNum('auto', 'Автовиходів', u => u.autoLogouts, true), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'failed': {
      type FailedRow = ActivityDashboardData['failedLogins'][number];
      const nameOf = (f: FailedRow) => (f.userId && peopleById.get(f.userId)?.name) || f.label;
      return {
        icon: ShieldAlert, tone: 'bg-rose-50 text-rose-600',
        title: 'Невдалі спроби входу',
        subtitle: `${period} · ${formatNumber(data.totals.failedLogins)} спроб`,
        description: 'Неправильний пароль чи код або логін, якого немає в системі. Багато спроб на один логін може означати, що людині потрібна допомога з входом — або що хтось підбирає пароль.',
        rows: data.failedLogins,
        rowKey: (f: FailedRow) => f.key,
        searchText: (f: FailedRow) => `${nameOf(f)} ${f.label}`,
        searchPlaceholder: 'Пошук за іменем або логіном',
        filters: [
          { key: 'all', label: 'Усі', predicate: () => true },
          { key: 'known', label: 'Співробітники', predicate: (f: FailedRow) => Boolean(f.userId) },
          { key: 'unknown', label: 'Невідомі логіни', predicate: (f: FailedRow) => !f.userId }
        ],
        onRowClick: (f: FailedRow) => openPerson(f.userId!),
        isRowClickable: (f: FailedRow) => Boolean(f.userId && peopleById.has(f.userId)),
        columns: [
          {
            key: 'who', header: 'Хто / який логін',
            render: (f: FailedRow) => (
              <>
                <div className="font-semibold text-slate-900">{nameOf(f)}</div>
                <div className="text-xs text-slate-500">{f.userId ? peopleById.get(f.userId)?.email || f.label : 'Немає в системі'}</div>
              </>
            )
          },
          { key: 'count', header: 'Спроб', align: 'right', render: (f: FailedRow) => <span className="font-semibold text-slate-900">{f.count}</span> },
          { key: 'last', header: 'Остання спроба', align: 'right', render: (f: FailedRow) => <span className="text-slate-500">{formatDateTime(f.lastAt)}</span> }
        ],
        emptyText: 'Невдалих спроб входу за цей період не було'
      } as DrilldownConfig<FailedRow>;
    }

    case 'hour': {
      const slot = data.byHour.find(h => h.hour === drill.hour);
      const rows = withCounts(slot?.users || []);
      return personList({
        icon: Clock, tone: 'bg-blue-50 text-blue-600',
        title: `Входи з ${drill.hour}:00 до ${drill.hour}:59`,
        subtitle: `${period} · ${formatNumber(slot?.logins || 0)} входів · ${usersCount(rows.length)}`,
        description: 'Хто входив у цю годину протягом періоду (за київським часом).',
        rows,
        columns: [colUser, colDept, colNum('n', 'Входів', u => u.n || 0, true), colDate('last', 'Останній вхід', u => u.lastLoginAt)]
      }, openPerson);
    }

    case 'weekday': {
      const slot = data.byWeekday.find(w => w.weekday === drill.weekday);
      const rows = withCounts(slot?.users || []);
      const name = WEEKDAY_NAMES[drill.weekday - 1];
      return personList({
        icon: CalendarDays, tone: 'bg-blue-50 text-blue-600',
        title: `Входи: ${name}`,
        subtitle: `${period} · ${formatNumber(slot?.logins || 0)} входів · ${usersCount(rows.length)}`,
        description: `Хто входив у портал у дні «${name}» протягом періоду.`,
        rows,
        columns: [colUser, colDept, colNum('n', 'Входів', u => u.n || 0, true), colDate('last', 'Останній вхід', u => u.lastLoginAt)]
      }, openPerson);
    }

    case 'page': {
      const page = data.topPages.find(p => p.page === drill.page);
      const rows = withCounts(page?.byUser || []);
      return personList({
        icon: MousePointerClick, tone: 'bg-blue-50 text-blue-600',
        title: page?.label || drill.page,
        subtitle: `${period} · ${formatNumber(page?.views || 0)} відкриттів · ${usersCount(rows.length)}`,
        description: 'Хто відкривав цей розділ і скільки разів.',
        rows,
        columns: [colUser, colDept, colNum('n', 'Відкривав', u => u.n || 0, true), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'material': {
      const material = data.topMaterials.find(m => m.title === drill.title);
      const rows = withCounts(material?.byUser || []);
      return personList({
        icon: BookOpen, tone: 'bg-indigo-50 text-indigo-600',
        title: drill.title,
        subtitle: `${period} · ${formatNumber(material?.views || 0)} переглядів · ${usersCount(rows.length)}`,
        description: 'Хто відкривав цей матеріал і скільки разів.',
        rows,
        columns: [colUser, colDept, colNum('n', 'Відкривав', u => u.n || 0, true), colDate('last', 'Остання дія', u => u.lastSeenAt)]
      }, openPerson);
    }

    case 'department': {
      const stat = data.departments.find(d => d.name === drill.name);
      const rows = where(p => p.registered && p.department === drill.name, (a, b) => Number(b.active) - Number(a.active) || b.seconds - a.seconds);
      return personList({
        icon: Building2, tone: 'bg-purple-50 text-purple-600',
        title: drill.name,
        subtitle: `${period} · заходили ${stat?.activeUsers || 0} з ${stat?.users || 0} · ${formatUsageTime(stat?.seconds || 0)} у додатку`,
        description: 'Співробітники підрозділу з чинним обліковим записом.',
        rows,
        filters: presenceFilters,
        columns: [colUser, colStatus, colNum('days', 'Днів', u => u.activeDays), colNum('logins', 'Входів', u => u.logins), colTime('time', 'Час', u => u.seconds, true)]
      }, openPerson);
    }

    case 'person': {
      const person = peopleById.get(drill.id);
      type DayRow = { day: string; logins: number; seconds: number };
      const rows: DayRow[] = Object.entries(data.dailyUsers)
        .map(([day, list]) => {
          const e = list.find(x => x.id === drill.id);
          return e ? { day, logins: e.logins, seconds: e.seconds } : null;
        })
        .filter(Boolean) as DayRow[];
      rows.sort((a, b) => b.day.localeCompare(a.day));
      const parts = person
        ? [person.department, `${person.activeDays} дн.`, `${formatNumber(person.logins)} входів`, formatUsageTime(person.seconds),
           `${formatNumber(person.materialViews)} матеріалів`, `${formatNumber(person.quizAttempts)} тестів`]
        : [];
      return {
        icon: UserIcon, tone: 'bg-slate-100 text-slate-600',
        title: person?.name || 'Користувач',
        subtitle: [person?.email, ...parts].filter(Boolean).join(' · '),
        description: `Дні, коли людина була в порталі за період ${period}. Усі її дії подієво — у розділі «Журнал дій».`,
        rows,
        rowKey: (d: DayRow) => d.day,
        columns: [
          { key: 'day', header: 'Дата', render: (d: DayRow) => <><span className="font-medium text-slate-900">{fullDay(d.day)}</span> <span className="text-xs text-slate-400">{weekdayOf(d.day)}</span></> },
          { key: 'logins', header: 'Входів', align: 'right', render: (d: DayRow) => d.logins },
          { key: 'time', header: 'Час', align: 'right', render: (d: DayRow) => <span className="font-semibold text-slate-900">{formatUsageTime(d.seconds)}</span> }
        ],
        emptyText: 'За цей період людина в порталі не була'
      } as DrilldownConfig<DayRow>;
    }
  }
}
