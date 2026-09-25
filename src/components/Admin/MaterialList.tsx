import React from 'react';
import { Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MaterialActionsMenu, MaterialAction } from './MaterialActionsMenu';

export type { MaterialAction } from './MaterialActionsMenu';

/**
 * Єдиний формат переліку матеріалів у розділі адміністрування.
 *
 * Раніше кожна вкладка малювала свій варіант: інструкції — горизонтальні рядки,
 * курси — вертикальні, кейси — білі картки, простори знань і каталог
 * онбордінгів — сітку карток, а життєвий цикл — таблицю. Через це однакові за
 * суттю переліки виглядали по-різному. Тут зібрано один рядок списку, який
 * використовують усі вкладки, тож новий перелік не потребує власної верстки.
 *
 * Анатомія рядка (однакова скрізь):
 *   [іконка] [назва + бейджі / другий рядок метаданих] … [лічильники] [Перегляд] [Дії ▾]
 *
 * На виду лишається тільки «Перегляд»; решта керування — у меню «Дії».
 * Рядок свідомо не приймає довільних кнопок: інакше кожна нова можливість
 * знову додавала б кнопку в кожен рядок і переліки розповзалися б.
 */

export type BadgeTone = 'slate' | 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'cyan';

const BADGE_TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200'
};

export interface MaterialBadge {
  label: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  /** Моноширинний шрифт для технічних значень: версій, кодів, ID. */
  mono?: boolean;
  title?: string;
}

export const MaterialBadgeChip: React.FC<{ badge: MaterialBadge }> = ({ badge }) => (
  <span
    title={badge.title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
      BADGE_TONES[badge.tone || 'slate']
    } ${badge.mono ? 'font-mono normal-case tracking-normal' : ''}`}
  >
    {badge.icon}
    {badge.label}
  </span>
);

interface MaterialListProps {
  children: React.ReactNode;
  /** Показується замість списку, коли елементів немає. */
  empty?: React.ReactNode;
  isEmpty?: boolean;
}

export const MaterialList: React.FC<MaterialListProps> = ({ children, empty, isEmpty }) => {
  if (isEmpty) {
    return (
      <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
        {empty || 'Список порожній.'}
      </div>
    );
  }
  return <div className="space-y-2">{children}</div>;
};

interface MaterialRowProps {
  icon?: React.ReactNode;
  /** Класи плитки іконки — дозволяють тонувати рядок під тип матеріалу. */
  iconTone?: string;
  title: React.ReactNode;
  /** Приглушує рядок: вимкнені, архівні чи неопубліковані матеріали. */
  dimmed?: boolean;
  badges?: MaterialBadge[];
  /** Другий рядок: підрозділ, ID, час читання тощо. */
  meta?: React.ReactNode;
  /** Лічильники праворуч від тексту (кроки, регламенти, курси). */
  stats?: MaterialBadge[];
  /** Головна дія, що завжди на виду, — зазвичай «Перегляд». */
  preview?: {
    onClick: () => void;
    title?: string;
    /** За замовчуванням «Перегляд» з іконкою ока. */
    label?: string;
    icon?: LucideIcon;
  };
  /** Усе інше керування матеріалом — у меню «Дії». */
  menuActions?: MaterialAction[];
}

export const MaterialRow: React.FC<MaterialRowProps> = ({
  icon,
  iconTone = 'bg-slate-100 text-slate-500 border-slate-200',
  title,
  dimmed,
  badges,
  meta,
  stats,
  preview,
  menuActions
}) => {
  const PreviewIcon = preview?.icon || Eye;
  const plainTitle = typeof title === 'string' ? title : undefined;
  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 transition p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
      {icon && (
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconTone}`}>
          {icon}
        </div>
      )}

      <div className="grow min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className={`text-sm font-bold break-words ${dimmed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
            {title}
          </h4>
          {badges?.filter(Boolean).map((b, i) => <MaterialBadgeChip key={i} badge={b} />)}
        </div>
        {meta && <div className="text-xs text-slate-500 mt-1 break-words">{meta}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {stats.map((s, i) => <MaterialBadgeChip key={i} badge={s} />)}
        </div>
      )}

      {(preview || (menuActions && menuActions.length > 0)) && (
        <div className="flex items-center gap-1.5 shrink-0">
          {preview && (
            <button
              type="button"
              onClick={preview.onClick}
              title={preview.title}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <PreviewIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>{preview.label || 'Перегляд'}</span>
            </button>
          )}
          {menuActions && menuActions.length > 0 && <MaterialActionsMenu actions={menuActions} itemLabel={plainTitle} />}
        </div>
      )}
    </div>
  );
};
