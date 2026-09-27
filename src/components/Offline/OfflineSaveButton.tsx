import React from 'react';
import { CloudDownload, CloudCheck, Loader2 } from 'lucide-react';
import { useOfflineLibrary } from '../../context/OfflineLibraryContext';

interface OfflineSaveButtonProps {
  kind: 'course' | 'section';
  id: string;
  /** compact — лише значок (рядок каталогу), full — значок і підпис. */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Перемикач «Зберегти офлайн». Збережений матеріал можна прибрати з пристрою
 * повторним натисканням — але лише з мережею, щоб випадково не лишитися без
 * нього саме тоді, коли інтернету немає.
 */
export const OfflineSaveButton: React.FC<OfflineSaveButtonProps> = ({ kind, id, variant = 'compact', className = '' }) => {
  const offline = useOfflineLibrary();
  if (!offline) return null;

  const saved = offline.isSaved(id);
  const busy = offline.isBusy(id);
  const disabled = busy || !offline.isOnline;
  const what = kind === 'course' ? 'курс' : 'інструкцію';

  const title = busy
    ? 'Збереження на пристрій…'
    : saved
      ? offline.isOnline ? `Збережено офлайн. Натисніть, щоб прибрати ${what} з пристрою` : 'Збережено на пристрої — доступно офлайн'
      : offline.isOnline ? `Зберегти ${what} на пристрій для вивчення без інтернету` : 'Щоб зберегти, потрібне підключення до інтернету';

  const label = busy ? 'Збереження…' : saved ? 'Доступно офлайн' : 'Зберегти офлайн';
  const Icon = busy ? Loader2 : saved ? CloudCheck : CloudDownload;

  const tone = saved
    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-700 border-slate-200';

  return (
    <button
      type="button"
      onClick={() => { void (saved ? offline.remove(id) : offline.save(kind, id)); }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={saved}
      className={`inline-flex items-center justify-center gap-2 border rounded-xl text-sm font-bold transition disabled:cursor-not-allowed ${
        disabled && !saved ? 'opacity-50' : ''
      } ${variant === 'compact' ? 'px-3 py-2' : 'px-3.5 py-2'} ${tone} ${className}`}
    >
      <Icon className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
      {variant === 'full' && <span>{label}</span>}
    </button>
  );
};
