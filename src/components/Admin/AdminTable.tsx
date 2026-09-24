import React, { useEffect, useState } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

/**
 * Спільні частини табличних переліків адміністрування.
 *
 * «Користувачі», «Ролі та права» й «Організація» показують записи однаково:
 * рядок пошуку з фільтрами й лічильником, таблиця з липким заголовком,
 * сортування кліком по колонці та сторінки внизу. Щоб вкладки не розходилися
 * у дрібницях, ці шматки живуть тут.
 */

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> { key: K; dir: SortDir }

export const PAGE_SIZES = [25, 50, 100];

export const FILTER_CLASS = 'px-2.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500';

export const TH_CLASS = 'px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px] text-slate-500';

/** Порівняння рядків, за якого порожні значення завжди внизу, незалежно від напрямку. */
export const compareText = (a: string, b: string, dir: SortDir) => {
  if (!a && b) return 1;
  if (a && !b) return -1;
  return a.localeCompare(b, 'uk') * (dir === 'asc' ? 1 : -1);
};

/** Заголовок колонки, за якою можна сортувати. */
export function SortHeader<K extends string>({ label, sortKey, sort, onSort, className = '' }: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2.5 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] ${
          active ? 'text-purple-700' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? '' : 'opacity-50'}`} />
      </button>
    </th>
  );
}

/**
 * Сортування й сторінки таблиці. Повторний клік по колонці змінює напрямок;
 * будь-яка зміна фільтрів (resetDeps) повертає на першу сторінку.
 */
export function useTableState<K extends string>(initial: SortState<K>, resetDeps: unknown[], descFirst: K[] = []) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [...resetDeps, sort, pageSize]);

  const onSort = (key: K) => setSort(prev => prev.key === key
    ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: descFirst.includes(key) ? 'desc' : 'asc' });

  return { sort, onSort, page, setPage, pageSize, setPageSize };
}

/** Вирізає поточну сторінку й не дає вийти за межі, коли рядків поменшало. */
export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  return { pageCount, safePage, pageRows: rows.slice(safePage * pageSize, (safePage + 1) * pageSize) };
}

/** Поле пошуку в рядку фільтрів. */
export const TableSearch: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder
}) => (
  <div className="relative grow min-w-[220px] max-w-md">
    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
    />
  </div>
);

/** Кнопка «Скинути» для фільтрів. */
export const ResetFiltersButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-2"
  >
    Скинути
  </button>
);

/** Рамка таблиці з прокруткою та липким заголовком; пагінація — у підвалі. */
export const TableFrame: React.FC<{
  head: React.ReactNode;
  children: React.ReactNode;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ head, children, empty, footer }) => (
  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
    <div className="overflow-x-auto max-h-[min(720px,calc(100vh-18rem))] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <div className="py-12 text-center text-sm text-slate-500">{empty}</div>}
    </div>
    {footer}
  </div>
);

/** Підвал таблиці: розмір сторінки, діапазон рядків і перехід між сторінками. */
export const TablePagination: React.FC<{
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}> = ({ total, page, pageCount, pageSize, onPage, onPageSize }) => {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
      <label className="flex items-center gap-2">
        Рядків на сторінці:
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-semibold outline-none"
        >
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <span>
          {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} з {total}
        </span>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
          aria-label="Попередня сторінка"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold">{page + 1} / {pageCount}</span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
          aria-label="Наступна сторінка"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/** Повідомлення над таблицею: успіх збереження або помилка дії в рядку. */
export const TableNotice: React.FC<{ tone: 'success' | 'error'; text: string; onClose: () => void }> = ({
  tone,
  text,
  onClose
}) => {
  const ok = tone === 'success';
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium border ${
      ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
    }`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="grow">{text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Сховати"
        className={ok ? 'text-emerald-600 hover:text-emerald-900' : 'text-rose-600 hover:text-rose-900'}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/** Бейдж статусу запису. */
export const StatusBadge: React.FC<{ active: boolean; activeLabel?: string; inactiveLabel?: string }> = ({
  active,
  activeLabel = 'Активний',
  inactiveLabel = 'Вимкнено'
}) => active ? (
  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
    {activeLabel}
  </span>
) : (
  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
    {inactiveLabel}
  </span>
);
