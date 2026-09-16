import React, { useState } from 'react';
import { X, Loader2, AlertTriangle, Star, Send } from 'lucide-react';
import { OnboardingPendingSurvey } from './types';

interface OnboardingSurveyModalProps {
  survey: OnboardingPendingSurvey;
  onClose: () => void;
  onSubmitted: () => void;
}

/** Шкала 1–5 зірками — коротка і зрозуміла без пояснень. */
const StarScale: React.FC<{
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, hint, value, onChange }) => (
  <div>
    <div className="text-sm font-semibold text-slate-800">{label}</div>
    <div className="text-[11px] text-slate-400 mb-2">{hint}</div>
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="p-1 transition hover:scale-110"
          aria-label={`Оцінка ${i} з 5`}
        >
          <Star className={`w-6 h-6 ${i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
        </button>
      ))}
    </div>
  </div>
);

export const OnboardingSurveyModal: React.FC<OnboardingSurveyModalProps> = ({ survey, onClose, onSubmitted }) => {
  const [satisfaction, setSatisfaction] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [supportLevel, setSupportLevel] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (satisfaction === 0) {
      setError('Будь ласка, поставте загальну оцінку');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/onboarding/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: survey.assignmentId,
          dayOffset: survey.dayOffset,
          satisfaction,
          clarity: clarity || undefined,
          supportLevel: supportLevel || undefined,
          nps: nps ?? undefined,
          comment: comment.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося надіслати відповіді');
      onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Помилка надсилання');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Опитування про адаптацію</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {survey.dayOffset}-й день · «{survey.templateName}»
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1" aria-label="Закрити">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <p className="text-xs text-slate-500 leading-relaxed">
            Відповіді бачить HR у зведеному вигляді разом з відповідями інших новачків.
            Це займе хвилину і напряму впливає на те, як компанія зустрічатиме наступних людей.
          </p>

          <StarScale
            label="Як загалом проходить адаптація?"
            hint="1 — дуже важко, 5 — все чудово"
            value={satisfaction}
            onChange={setSatisfaction}
          />
          <StarScale
            label="Чи зрозумілі ваші задачі та очікування?"
            hint="Чи розумієте, за що відповідаєте і як вимірюється успіх"
            value={clarity}
            onChange={setClarity}
          />
          <StarScale
            label="Чи достатньо підтримки від команди?"
            hint="Наставник, керівник, колеги — чи є до кого звернутись"
            value={supportLevel}
            onChange={setSupportLevel}
          />

          <div>
            <div className="text-sm font-semibold text-slate-800">
              Чи порекомендуєте компанію як місце роботи?
            </div>
            <div className="text-[11px] text-slate-400 mb-2">0 — точно ні, 10 — точно так</div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 11 }, (_, i) => i).map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNps(i)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition ${
                    nps === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Що варто покращити?
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Чого не вистачало, що заплуталось, що навпаки спрацювало добре"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Пізніше
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Надіслати
          </button>
        </div>
      </div>
    </div>
  );
};
