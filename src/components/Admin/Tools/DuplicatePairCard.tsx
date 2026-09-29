import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, CheckCircle2, ChevronDown, FileText, RefreshCw, Paperclip } from 'lucide-react';
import { DUPLICATE_LEVEL_LABELS } from '../../../../shared/duplicateDetection';
import { DuplicatePairDto, DuplicateSectionInfoDto, duplicatesApi } from '../../../utils/duplicatesApi';

/** Що адміністратор вирішив зробити з парою. */
export type DuplicateResolution =
  | { kind: 'dismissed' }
  | { kind: 'deleted'; id: string }
  | { kind: 'deactivated'; id: string };

const LEVEL_TONE: Record<DuplicatePairDto['level'], string> = {
  exact: 'bg-rose-100 text-rose-800 border-rose-200',
  high: 'bg-amber-100 text-amber-800 border-amber-200',
  possible: 'bg-sky-100 text-sky-800 border-sky-200'
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA');
};

interface SideProps {
  label: string;
  info?: DuplicateSectionInfoDto;
  expanded: boolean;
  onPreview?: (id: string) => void;
}

const PairSide: React.FC<SideProps> = ({ label, info, expanded, onPreview }) => {
  if (!info) {
    return (
      <div className="flex-1 min-w-0 p-3 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        Інструкцію вже видалено
      </div>
    );
  }
  const date = formatDate(info.updatedAt || info.createdAt);
  return (
    <div className="flex-1 min-w-0 p-3 rounded-xl border border-slate-200 bg-white">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className={`text-sm font-semibold leading-snug ${info.isActive ? 'text-slate-900' : 'text-slate-400'}`}>{info.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {[info.department, date && `змінено ${date}`, `${info.wordCount} слів`].filter(Boolean).join(' · ')}
          </p>
          {info.sourceFileName && (
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate" title={info.sourceFileName}>
              <Paperclip className="w-3 h-3 shrink-0" /> {info.sourceFileName}
            </p>
          )}
          {!info.isActive && (
            <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Вимкнено</span>
          )}
        </div>
      </div>
      {expanded && info.excerpt && (
        <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 leading-relaxed">{info.excerpt}</p>
      )}
      {onPreview && (
        <button
          onClick={() => onPreview(info.id)}
          className="mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Переглянути
        </button>
      )}
    </div>
  );
};

interface Props {
  pair: DuplicatePairDto;
  sections: Record<string, DuplicateSectionInfoDto>;
  /** Підписи сторін: при імпорті — «Нова» / «Наявна». */
  labels?: [string, string];
  onResolved: (pair: DuplicatePairDto, resolution: DuplicateResolution) => void;
  onPreview?: (id: string) => void;
}

/**
 * Пара можливих дублів і варіанти рішення: залишити обидві, вимкнути одну
 * (лишається в базі, але не видна співробітникам) або видалити одну з них.
 */
export const DuplicatePairCard: React.FC<Props> = ({ pair, sections, labels = ['Інструкція 1', 'Інструкція 2'], onResolved, onPreview }) => {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const a = sections[pair.a];
  const b = sections[pair.b];

  const run = async (action: () => Promise<void>, resolution: DuplicateResolution) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onResolved(pair, resolution);
    } catch (err: any) {
      setError(err?.message || 'Не вдалося виконати дію');
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  const sideActions = (info: DuplicateSectionInfoDto | undefined, label: string) => {
    if (!info) return null;
    const short = label.toLowerCase();
    return (
      <div className="flex flex-wrap gap-1.5">
        {info.isActive && (
          <button
            disabled={busy}
            onClick={() => run(async () => {
              await duplicatesApi.deactivateInstruction(info);
              // Рішення щодо пари ухвалено — інакше вона з'являлася б при кожному пошуку.
              await duplicatesApi.dismiss(pair.a, pair.b);
            }, { kind: 'deactivated', id: info.id })}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
            title="Інструкція лишиться в базі, але співробітники її не бачитимуть"
          >
            <EyeOff className="w-3 h-3" /> Вимкнути {short}
          </button>
        )}
        {confirmDelete === info.id ? (
          <span className="flex items-center gap-1">
            <button
              disabled={busy}
              onClick={() => run(() => duplicatesApi.deleteInstruction(info.id), { kind: 'deleted', id: info.id })}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Так, видалити
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100"
            >
              Ні
            </button>
          </span>
        ) : (
          <button
            disabled={busy}
            onClick={() => setConfirmDelete(info.id)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Видалити {short}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_TONE[pair.level]}`}>
          {DUPLICATE_LEVEL_LABELS[pair.level]} · {Math.round(pair.score * 100)}%
        </span>
        {pair.reasons.map(r => (
          <span key={r} className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{r}</span>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <PairSide label={labels[0]} info={a} expanded={expanded} onPreview={onPreview} />
        <PairSide label={labels[1]} info={b} expanded={expanded} onPreview={onPreview} />
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Сховати фрагменти' : 'Порівняти фрагменти змісту'}
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2 pt-2 border-t border-slate-200">
        <button
          disabled={busy}
          onClick={() => run(() => duplicatesApi.dismiss(pair.a, pair.b), { kind: 'dismissed' })}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 self-start"
          title="Пара більше не показуватиметься в результатах пошуку"
        >
          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Не дубль — залишити обидві
        </button>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {sideActions(a, labels[0])}
          {sideActions(b, labels[1])}
        </div>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};

/**
 * Прибирає з переліку пари, яких стосується рішення: пару «не дубль» — саму,
 * а видалену інструкцію — з усіх пар, де вона фігурувала.
 */
export function applyResolution(pairs: DuplicatePairDto[], pair: DuplicatePairDto, resolution: DuplicateResolution): DuplicatePairDto[] {
  if (resolution.kind === 'deleted') return pairs.filter(p => p.a !== resolution.id && p.b !== resolution.id);
  return pairs.filter(p => !(p.a === pair.a && p.b === pair.b));
}
