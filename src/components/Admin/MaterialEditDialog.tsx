import React, { useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useModalA11y } from '../../hooks/useModalA11y';

/**
 * Єдиний режим редагування матеріалів у розділі адміністрування.
 *
 * Раніше кожен розділ редагував по-своєму: інструкції та курси розгортали форму
 * прямо в рядку списку, кейси — панель над списком, простори знань і параметри
 * онбордінгу — два різні за виглядом діалоги. Тут зібрано одну оболонку, якою
 * користуються всі розділи, тож редагування скрізь відкривається й виглядає
 * однаково.
 *
 * Обрано саме діалог, а не розгортання рядка: форми сильно різні за розміром
 * (інструкція — два поля, курс — десяток із вибором інструкцій), і довга форма
 * всередині списку розриває перелік, через що губиться місце, яке редагуєш.
 */

export const FIELD_INPUT_CLASS =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400';

export const FIELD_LABEL_CLASS = 'block text-xs font-bold text-slate-600 mb-1.5';

interface FormFieldProps {
  label: React.ReactNode;
  /** Підказка під полем: пояснення, обмеження, формат. */
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Поле форми з однаковим підписом і підказкою в усіх розділах. */
export const FormField: React.FC<FormFieldProps> = ({ label, hint, required, children, className }) => (
  <div className={className}>
    <label className={FIELD_LABEL_CLASS}>
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{hint}</p>}
  </div>
);

/** Перемикач-галочка — теж однаковий скрізь, бо трапляється в кожній формі. */
export const FormCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
}> = ({ checked, onChange, label, hint, id }) => (
  <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer select-none">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
    />
    <span className="min-w-0">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint && <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">{hint}</span>}
    </span>
  </label>
);

/** Заголовок логічної групи полів усередині довгої форми. */
export const FormSection: React.FC<{ title: React.ReactNode; children: React.ReactNode }> = ({ title, children }) => (
  <div className="pt-1">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">{title}</div>
    <div className="space-y-3">{children}</div>
  </div>
);

export type DialogSize = 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<DialogSize, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

interface MaterialEditDialogProps {
  open: boolean;
  onClose: () => void;
  /** Іконка типу матеріалу — та сама, що в рядку списку. */
  icon?: React.ReactNode;
  iconTone?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: DialogSize;
  children: React.ReactNode;
  /** Текст кнопки підтвердження; за замовчуванням «Зберегти». */
  submitLabel?: React.ReactNode;
  onSubmit?: () => void | Promise<void>;
  submitDisabled?: boolean;
  saving?: boolean;
  /** Помилка збереження — показується над кнопками, а не через alert(). */
  error?: string | null;
  /** Додаткові дії ліворуч у підвалі (наприклад, видалення). */
  footerLeft?: React.ReactNode;
}

export const MaterialEditDialog: React.FC<MaterialEditDialogProps> = ({
  open,
  onClose,
  icon,
  iconTone = 'bg-slate-100 text-slate-500 border-slate-200',
  title,
  subtitle,
  size = 'md',
  children,
  submitLabel = 'Зберегти',
  onSubmit,
  submitDisabled,
  saving,
  error,
  footerLeft
}) => {
  if (!open) return null;
  return (
    <MaterialEditDialogInner
      onClose={onClose}
      icon={icon}
      iconTone={iconTone}
      title={title}
      subtitle={subtitle}
      size={size}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      submitDisabled={submitDisabled}
      saving={saving}
      error={error}
      footerLeft={footerLeft}
    >
      {children}
    </MaterialEditDialogInner>
  );
};

// Внутрішній компонент монтується лише коли діалог відкритий: інакше
// useModalA11y перехоплював би Escape і фокус для закритого діалога.
const MaterialEditDialogInner: React.FC<Omit<MaterialEditDialogProps, 'open'>> = ({
  onClose,
  icon,
  iconTone,
  title,
  subtitle,
  size = 'md',
  children,
  submitLabel,
  onSubmit,
  submitDisabled,
  saving,
  error,
  footerLeft
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || submitDisabled) return;
    onSubmit?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      // Клік по підкладці закриває; клік усередині панелі — ні.
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${SIZE_CLASS[size]} my-auto flex flex-col max-h-[calc(100vh-2rem)]`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          {icon && (
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconTone}`}>
              {icon}
            </div>
          )}
          <div className="grow min-w-0">
            <h3 className="font-extrabold text-slate-900 text-base leading-tight break-words">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 break-words">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition shrink-0"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="px-5 py-4 space-y-3.5 overflow-y-auto grow">{children}</div>

          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-2xl shrink-0">
            {error && (
              <div className="mb-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex items-center gap-2">
              {footerLeft}
              <div className="grow" />
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
              >
                Скасувати
              </button>
              {onSubmit && (
                <button
                  type="submit"
                  disabled={submitDisabled || saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitLabel}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
