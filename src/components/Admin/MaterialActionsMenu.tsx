import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Одна дія над матеріалом у меню «Дії».
 *
 * Меню навмисно одне на всі переліки адміністрування: рядок матеріалу
 * лишає на виду лише «Перегляд», а все інше (редагування, експорт, версії,
 * видалення…) живе тут. Нова дія додається рядком у масиві, а не ще однією
 * кнопкою в рядку, тож рядки не розповзаються, скільки б дій не з'явилося.
 */
export interface MaterialAction {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Другий рядок під назвою: що саме зробить дія. */
  hint?: string;
  /** Невелика мітка праворуч, напр. кількість питань. */
  badge?: string;
  /** Заголовок групи: дії з однаковим section стоять разом під ним. */
  section?: string;
  /** Небезпечні дії завжди внизу меню, після розділювача, і червоні. */
  danger?: boolean;
  disabled?: boolean;
  /** Чому дія недоступна — показується замість hint. */
  disabledReason?: string;
  /** Спершу перепитати прямо в меню, без системного вікна браузера. */
  confirm?: { question: string; details?: string; confirmLabel?: string };
  onSelect: () => void | Promise<unknown>;
}

interface MaterialActionsMenuProps {
  actions: MaterialAction[];
  /** Назва матеріалу — для підказки та читачів екрана. */
  itemLabel?: string;
}

const MENU_WIDTH = 272;
const GAP = 6;

/** Групує дії: спершу звичайні за секціями (в порядку появи), потім небезпечні. */
const groupActions = (actions: MaterialAction[]) => {
  const regular = actions.filter(a => !a.danger);
  const danger = actions.filter(a => a.danger);
  const sections: Array<{ title?: string; items: MaterialAction[] }> = [];
  for (const a of regular) {
    const last = sections[sections.length - 1];
    const existing = sections.find(s => s.title === a.section);
    if (existing) existing.items.push(a);
    else if (last && !last.title && !a.section) last.items.push(a);
    else sections.push({ title: a.section, items: [a] });
  }
  if (danger.length > 0) sections.push({ title: undefined, items: danger });
  return { sections, hasDanger: danger.length > 0 };
};

export const MaterialActionsMenu: React.FC<MaterialActionsMenuProps> = ({ actions, itemLabel }) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<MaterialAction | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setPending(null);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Меню рендериться в body з фіксованою позицією: інакше його обрізали б
  // контейнери з overflow (дерево тек, прокручувані таблиці). Біля нижнього
  // краю екрана воно відкривається вгору.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight || 0;
    const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - 8;
    const top = fitsBelow || rect.top - GAP - height < 8 ? rect.bottom + GAP : rect.top - GAP - height;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
  }, [open, pending]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (pending && !busyKey) setPending(null);
        else if (!busyKey) close();
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && menuRef.current) {
        const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
        if (items.length === 0) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    // Прокрутка зсуває рядок під меню — простіше закрити, ніж «везти» меню за ним.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (!busyKey) close(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, pending, busyKey, close]);

  // Фокус на першу доступну дію (або на кнопку підтвердження) — меню одразу працює з клавіатури.
  useEffect(() => {
    if (!open || !position) return;
    const first = menuRef.current?.querySelector<HTMLElement>(pending ? '[data-confirm]' : '[role="menuitem"]:not([disabled])');
    first?.focus();
  }, [open, position, pending]);

  const run = async (action: MaterialAction) => {
    setBusyKey(action.key);
    try {
      await action.onSelect();
    } finally {
      setBusyKey(null);
      close(false);
    }
  };

  const choose = (action: MaterialAction) => {
    if (action.disabled || busyKey) return;
    if (action.confirm) {
      setPending(action);
      return;
    }
    // Звичайну дію (відкрити діалог, експорт) запускаємо після закриття меню,
    // щоб діалог, який вона відкриває, забрав фокус собі.
    close(false);
    void action.onSelect();
  };

  if (actions.length === 0) return null;
  const { sections } = groupActions(actions);

  const menu = open && createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={itemLabel ? `Дії: ${itemLabel}` : 'Дії'}
      style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999, width: MENU_WIDTH, visibility: position ? 'visible' : 'hidden' }}
      className="z-[60] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      {pending ? (
        <div className="px-3.5 py-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-snug break-words">{pending.confirm!.question}</p>
              {pending.confirm!.details && <p className="text-xs text-slate-500 mt-1 leading-snug">{pending.confirm!.details}</p>}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => setPending(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
            >
              Ні, залишити
            </button>
            <button
              type="button"
              data-confirm
              disabled={Boolean(busyKey)}
              onClick={() => run(pending)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-60 ${
                pending.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {busyKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {pending.confirm!.confirmLabel || 'Так'}
            </button>
          </div>
        </div>
      ) : (
        sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'border-t border-slate-100 mt-1 pt-1' : ''}>
            {section.title && (
              <div className="px-3.5 pt-1.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{section.title}</div>
            )}
            {section.items.map(action => {
              const Icon = action.icon;
              const sub = action.disabled ? action.disabledReason : action.hint;
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => choose(action)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 ${
                    action.danger
                      ? 'text-rose-700 hover:bg-rose-50 focus-visible:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${action.danger ? 'text-rose-600' : 'text-slate-500'}`} />
                  <span className="grow min-w-0">
                    <span className="block text-xs font-semibold leading-tight">{action.label}</span>
                    {sub && <span className={`block text-[11px] leading-tight mt-0.5 ${action.danger ? 'text-rose-400' : 'text-slate-400'}`}>{sub}</span>}
                  </span>
                  {action.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums shrink-0">{action.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        title={itemLabel ? `Дії з «${itemLabel}»` : 'Дії'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500 ${
          open ? 'bg-purple-50 text-purple-800 border-purple-200 shadow-xs' : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
        }`}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        <span>Дії</span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </>
  );
};
