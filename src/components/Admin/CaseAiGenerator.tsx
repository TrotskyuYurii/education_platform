import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { FIELD_INPUT_CLASS } from './MaterialEditDialog';

export interface GeneratedCaseDraft {
  title: string;
  scenario: string;
  options: { id: string; text: string; isCorrect: boolean; feedback: string }[];
}

/**
 * Блок «Згенерувати кейс за допомогою ШІ» у формі створення кейсу.
 *
 * ШІ складає ситуацію й варіанти дій за текстом обраної інструкції, а
 * результат лише підставляється у форму: адмін перевіряє, править і сам
 * натискає «Створити». Стан генерації тримаємо тут, щоб набір побажання не
 * перемальовував усю адмінку.
 */
export const CaseAiGenerator: React.FC<{
  sectionId: string;
  /** Чи вже щось заповнено у формі — тоді перед заміною питаємо підтвердження. */
  hasContent: boolean;
  onGenerated: (draft: GeneratedCaseDraft) => void;
}> = ({ sectionId, hasContent, onGenerated }) => {
  const [hint, setHint] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!sectionId || generating) return;
    if (hasContent && !window.confirm('Замінити вже заповнені назву, сценарій і варіанти на кейс від ШІ?')) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cases/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, hint })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.case) throw new Error(data.error || 'Не вдалося згенерувати кейс');
      onGenerated(data.case);
    } catch (err: any) {
      setError(err?.message || 'Не вдалося згенерувати кейс');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/50 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
        <Sparkles className="w-4 h-4 text-blue-600" />
        Згенерувати кейс за допомогою ШІ
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        ШІ складе робочу ситуацію та варіанти дій за текстом обраної інструкції. Результат з'явиться у полях нижче — перевірте його перед збереженням.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={hint}
          onChange={e => setHint(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generate(); } }}
          placeholder="Побажання (необов'язково): напр. конфліктний клієнт, повернення товару"
          disabled={generating}
          className={`${FIELD_INPUT_CLASS} grow`}
        />
        <button
          type="button"
          onClick={generate}
          disabled={!sectionId || generating}
          title={sectionId ? undefined : 'Спочатку оберіть інструкцію'}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Генерація…' : 'Згенерувати'}
        </button>
      </div>
      {!sectionId && <p className="text-[11px] text-slate-400">Оберіть інструкцію вище, щоб увімкнути генерацію.</p>}
      {error && (
        <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
      )}
    </div>
  );
};
