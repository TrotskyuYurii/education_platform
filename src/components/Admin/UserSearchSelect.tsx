import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { matchesUserQuery, userOptionLabel, SearchableUser } from '../../utils/userSearch';

/**
 * Вибір одного користувача з пошуком: у полі можна почати набирати частину
 * ПІБ або email / логіна, і список нижче одразу звужується.
 *
 * Звичайний <select> зі сотнями співробітників доводилося гортати вручну.
 * Клавіатура: ↑/↓ — рух списком, Enter — обрати, Esc — закрити.
 */
export interface UserSearchOption extends SearchableUser {
  _id: string;
}

/** Скільки рядків малюємо за раз: решту знаходять уточненням запиту. */
const MAX_VISIBLE = 50;

export const UserSearchSelect: React.FC<{
  users: UserSearchOption[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  /** id для <label htmlFor>. */
  inputId?: string;
}> = ({ users, value, onChange, placeholder = 'Почніть вводити ПІБ або email…', inputId }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => users.find(u => u._id === value), [users, value]);

  const matches = useMemo(() => {
    const list = users
      .filter(u => matchesUserQuery(u, query))
      .sort((a, b) => userOptionLabel(a).localeCompare(userOptionLabel(b), 'uk'));
    return list;
  }, [users, query]);
  const visible = matches.slice(0, MAX_VISIBLE);

  // Новий запит — підсвічуємо перший результат
  useEffect(() => { setHighlight(0); }, [query]);

  // Клік поза полем закриває список
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Підсвічений рядок завжди у видимій частині списку
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const choose = (u: UserSearchOption) => {
    onChange(u._id);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      // Enter не повинен надсилати форму, поки список відкритий
      if (open && visible[highlight]) {
        e.preventDefault();
        choose(visible[highlight]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setQuery('');
      }
    }
  };

  // Поки список закритий, у полі видно обраного користувача
  const inputValue = open ? query : (selected ? userOptionLabel(selected) : '');

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={inputValue}
          placeholder={selected && open ? userOptionLabel(selected) : placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full py-2 pl-9 pr-16 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
          {selected && (
            <button
              type="button"
              onClick={() => { onChange(''); setQuery(''); }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded"
              aria-label="Очистити вибір"
              title="Очистити вибір"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {visible.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">
              {users.length === 0 ? 'Список користувачів ще завантажується…' : 'Користувачів не знайдено'}
            </div>
          ) : (
            <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {visible.map((u, idx) => {
                const isSelected = u._id === value;
                return (
                  <li
                    key={u._id}
                    role="option"
                    aria-selected={isSelected}
                    // mousedown, а не click: інакше поле встигає втратити фокус
                    onMouseDown={e => { e.preventDefault(); choose(u); }}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                      idx === highlight ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="grow min-w-0">
                      <div className="font-medium text-slate-800 truncate">{u.fullName || u.username || u.email}</div>
                      {(u.email || u.username) && u.fullName && (
                        <div className="text-xs text-slate-500 truncate">{u.email || u.username}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          )}
          {matches.length > MAX_VISIBLE && (
            <div className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100 bg-slate-50">
              Показано {MAX_VISIBLE} з {matches.length}. Уточніть запит, щоб знайти потрібного.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
