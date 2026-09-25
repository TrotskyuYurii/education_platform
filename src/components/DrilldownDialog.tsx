import React, { useMemo, useRef, useState } from 'react';
import { X, Search, ArrowLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

export interface DrilldownColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

export interface DrilldownFilter<T> {
  key: string;
  label: string;
  predicate: (row: T) => boolean;
}

export interface DrilldownConfig<T> {
  icon: LucideIcon;
  /** Класи плашки під іконкою, напр. 'bg-blue-50 text-blue-600'. */
  tone: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Кого чи що саме пораховано в показнику — одним реченням. */
  description?: React.ReactNode;
  rows: T[];
  rowKey: (row: T) => string;
  columns: DrilldownColumn<T>[];
  /** Текст, за яким шукати рядок; без нього поле пошуку не показується. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Вкладки над таблицею: «Прочитані / Непрочитані» тощо. */
  filters?: DrilldownFilter<T>[];
  initialFilter?: string;
  /** Рядок веде на глибшу деталізацію (наприклад, на історію конкретної людини). */
  onRowClick?: (row: T) => void;
  /** Які рядки справді ведуть далі; за замовчуванням — усі, якщо є onRowClick. */
  isRowClickable?: (row: T) => boolean;
  emptyText?: string;
}

interface DrilldownDialogProps<T> extends DrilldownConfig<T> {
  onClose: () => void;
  /** Повернутися до попередньої деталізації, з якої сюди перейшли. */
  onBack?: () => void;
}

/**
 * Вікно «з чого складається це число» для блоків дашбордів.
 *
 * Одне на всі дашборди, щоб деталізація будь-якого показника виглядала й
 * поводилась однаково: заголовок, пояснення, що саме пораховано, пошук,
 * вкладки-фільтри й таблиця. Esc, клік поза вікном і хрестик закривають його.
 */
export function DrilldownDialog<T>({
  icon: Icon,
  tone,
  title,
  subtitle,
  description,
  rows,
  rowKey,
  columns,
  searchText,
  searchPlaceholder = 'Пошук',
  filters,
  initialFilter,
  onRowClick,
  isRowClickable,
  emptyText = 'Немає записів',
  onClose,
  onBack
}: DrilldownDialogProps<T>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);
  const [query, setQuery] = useState('');
  const [filterKey, setFilterKey] = useState(initialFilter || filters?.[0]?.key || '');

  const activeFilter = filters?.find(f => f.key === filterKey);

  const visible = useMemo(() => {
    let out = activeFilter ? rows.filter(activeFilter.predicate) : rows;
    const q = query.trim().toLowerCase();
    if (q && searchText) out = out.filter(r => searchText(r).toLowerCase().includes(q));
    return out;
  }, [rows, activeFilter, query, searchText]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drilldown-dialog-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 -ml-1.5 mt-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
                aria-label="Назад"
                title="Назад"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="drilldown-dialog-title" className="text-lg font-bold text-slate-900 break-words">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(searchText || (filters && filters.length > 1)) && (
          <div className="px-5 sm:px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2 sm:items-center">
            {filters && filters.length > 1 && (
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 shrink-0 overflow-x-auto">
                {filters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilterKey(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      filterKey === f.key ? 'bg-white text-purple-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label} <span className="text-slate-400 tabular-nums">{rows.filter(f.predicate).length}</span>
                  </button>
                ))}
              </div>
            )}
            {searchText && (
              <div className="relative grow">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
          </div>
        )}

        <div className="overflow-auto grow">
          {visible.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">{query ? 'Нічого не знайдено' : emptyText}</div>
          ) : (
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  {columns.map((c, i) => (
                    <th
                      key={c.key}
                      className={`font-semibold py-2 ${i === 0 ? 'pl-5 sm:pl-6 pr-3' : i === columns.length - 1 ? 'pl-3 pr-5 sm:pr-6' : 'px-3'} ${c.align === 'right' ? 'text-right' : ''}`}
                    >
                      {c.header}
                    </th>
                  ))}
                  {onRowClick && <th className="w-8" aria-hidden="true" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(row => {
                  const clickable = Boolean(onRowClick) && (!isRowClickable || isRowClickable(row));
                  return (
                  <tr
                    key={rowKey(row)}
                    onClick={clickable ? () => onRowClick!(row) : undefined}
                    onKeyDown={clickable ? e => { if (e.key === 'Enter') onRowClick!(row); } : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    className={clickable ? 'group cursor-pointer hover:bg-purple-50/60 focus:outline-hidden focus-visible:bg-purple-50' : 'hover:bg-slate-50'}
                  >
                    {columns.map((c, i) => (
                      <td
                        key={c.key}
                        className={`py-2.5 ${i === 0 ? 'pl-5 sm:pl-6 pr-3' : i === columns.length - 1 ? 'pl-3 pr-5 sm:pr-6' : 'px-3'} ${c.align === 'right' ? 'text-right tabular-nums whitespace-nowrap' : ''}`}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                    {onRowClick && (
                      <td className="pr-4 text-slate-300 group-hover:text-purple-600">
                        {clickable && <ChevronRight className="w-4 h-4" />}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 sm:px-6 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          Показано {visible.length} з {rows.length}
          {onRowClick && ' · натисніть на рядок, щоб побачити подробиці'}
        </div>
      </div>
    </div>
  );
}
