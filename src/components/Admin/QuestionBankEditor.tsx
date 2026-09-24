import React, { useMemo, useState } from 'react';
import {
  HelpCircle,
  Plus,
  Trash2,
  ChevronDown,
  Sparkles,
  Loader2,
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { InstructionSection, QuizQuestion } from '../../types';
import { MaterialEditDialog, FormField, FIELD_INPUT_CLASS } from './MaterialEditDialog';
import { parseQuestionBlocks } from '../../utils/markdownParser';
import { DEFAULT_QUIZ_QUESTION_COUNT } from '../../../shared/quizSampling';

/**
 * Редактор банку тестових питань однієї інструкції.
 *
 * Раніше питання можна було змінити лише через редагування всього Markdown
 * інструкції — з ризиком зачепити текст регламенту. Тут кожне питання
 * редагується окремою карткою, а банк можна поповнити питаннями від ШІ:
 * вони з'являються в списку позначеними як нові і потрапляють у базу лише
 * після збереження.
 */

type Difficulty = QuizQuestion['difficulty'];

interface DraftQuestion extends QuizQuestion {
  /** Ключ картки в списку — стабільний навіть для ще не збережених питань. */
  draftKey: string;
  isNew?: boolean;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Легке',
  medium: 'Середнє',
  hard: 'Складне'
};

const DIFFICULTY_TONE: Record<Difficulty, string> = {
  easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  hard: 'bg-rose-50 text-rose-700 border-rose-200'
};

const MAX_OPTIONS = 6;
const GENERATE_COUNTS = [5, 10, 20];

let draftCounter = 0;
const nextDraftKey = () => `draft-${Date.now()}-${draftCounter++}`;

const toDraft = (q: QuizQuestion, isNew = false): DraftQuestion => ({
  ...q,
  options: [...(q.options || [])],
  draftKey: nextDraftKey(),
  isNew
});

const blankQuestion = (section: InstructionSection): DraftQuestion => ({
  id: '',
  sectionId: section.id,
  department: section.department,
  role: section.targetRole,
  difficulty: 'medium',
  question: '',
  contextScenario: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  sourceDocPage: section.pageReference || '',
  draftKey: nextDraftKey(),
  isNew: true
});

/** Та сама перевірка, що й на сервері, — щоб показати проблему до збереження. */
function validationProblem(q: DraftQuestion): string | null {
  if (!q.question.trim()) return 'не заповнено текст питання';
  const filled = q.options.map(o => o.trim()).filter(Boolean);
  if (filled.length < 2) return 'потрібно щонайменше два варіанти відповіді';
  if (!q.options[q.correctIndex]?.trim()) return 'позначте правильний варіант відповіді';
  if (new Set(filled.map(o => o.toLowerCase())).size !== filled.length) return 'варіанти відповіді повторюються';
  return null;
}

interface QuestionBankEditorProps {
  section: InstructionSection | null;
  questions: QuizQuestion[];
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

export const QuestionBankEditor: React.FC<QuestionBankEditorProps> = ({ section, questions, onClose, onSaved }) => {
  if (!section) return null;
  // Окремий внутрішній компонент із key: при відкритті іншої інструкції чернетка
  // стартує заново, а не тягне питання попередньої.
  return (
    <QuestionBankEditorInner
      key={section.id}
      section={section}
      questions={questions}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
};

const QuestionBankEditorInner: React.FC<QuestionBankEditorProps & { section: InstructionSection }> = ({
  section,
  questions,
  onClose,
  onSaved
}) => {
  const [drafts, setDrafts] = useState<DraftQuestion[]>(() => questions.map(q => toDraft(q)));
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (key: string, patch: Partial<DraftQuestion>) => {
    setDrafts(prev => prev.map(d => (d.draftKey === key ? { ...d, ...patch } : d)));
    setDirty(true);
  };

  const remove = (key: string) => {
    setDrafts(prev => prev.filter(d => d.draftKey !== key));
    setDirty(true);
  };

  const addQuestion = () => {
    const q = blankQuestion(section);
    setDrafts(prev => [q, ...prev]);
    setExpandedKey(q.draftKey);
    setSearch('');
    setDifficultyFilter('all');
    setDirty(true);
  };

  const counts = useMemo(() => {
    const c: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    drafts.forEach(d => { c[d.difficulty] = (c[d.difficulty] || 0) + 1; });
    return c;
  }, [drafts]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drafts
      .map((d, idx) => ({ d, number: idx + 1 }))
      .filter(({ d }) => difficultyFilter === 'all' || d.difficulty === difficultyFilter)
      .filter(({ d }) => !query
        || d.question.toLowerCase().includes(query)
        || d.options.some(o => o.toLowerCase().includes(query)));
  }, [drafts, search, difficultyFilter]);

  const invalidCount = useMemo(() => drafts.filter(d => validationProblem(d)).length, [drafts]);

  const handleClose = () => {
    if (dirty && !window.confirm('Є незбережені зміни в питаннях. Закрити без збереження?')) return;
    onClose();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/instructions/${encodeURIComponent(section.id)}/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: generateCount,
          existingQuestions: drafts.map(d => d.question).filter(Boolean)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не вдалося згенерувати питання');

      const parsed = parseQuestionBlocks(data.markdown || '', {
        sectionId: section.id,
        department: section.department,
        role: section.targetRole,
        pageReference: section.pageReference || '',
        idPrefix: `q-${Date.now()}-ai`
      });
      if (parsed.length === 0) throw new Error('ШІ не повернув жодного питання у потрібному форматі. Спробуйте ще раз.');

      // Ідентифікатори призначить сервер під час збереження
      setDrafts(prev => [...parsed.map(q => toDraft({ ...q, id: '' }, true)), ...prev]);
      setDifficultyFilter('all');
      setSearch('');
      setDirty(true);
      setNotice(`Додано ${parsed.length} нових питань. Перегляньте їх і натисніть «Зберегти питання».`);
    } catch (e: any) {
      setError(e?.message || 'Помилка мережі під час генерації питань');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const firstInvalid = drafts.findIndex(d => validationProblem(d));
    if (firstInvalid >= 0) {
      setError(`Питання №${firstInvalid + 1}: ${validationProblem(drafts[firstInvalid])}.`);
      setExpandedKey(drafts[firstInvalid].draftKey);
      setSearch('');
      setDifficultyFilter('all');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/instructions/${encodeURIComponent(section.id)}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: drafts.map(({ draftKey, isNew, ...q }) => q)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не вдалося зберегти питання');
      setDirty(false);
      if (onSaved) await onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Помилка мережі під час збереження питань');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MaterialEditDialog
      open
      onClose={handleClose}
      size="xl"
      icon={<HelpCircle className="w-4 h-4" />}
      iconTone="bg-indigo-50 text-indigo-600 border-indigo-100"
      title="Питання тесту"
      subtitle={section.title}
      submitLabel="Зберегти питання"
      onSubmit={handleSave}
      saving={saving}
      error={error}
      footerLeft={
        <span className="text-xs text-slate-500 hidden sm:inline">
          {invalidCount > 0
            ? <span className="text-rose-600 font-semibold">Потребують уваги: {invalidCount}</span>
            : dirty ? 'Є незбережені зміни' : null}
        </span>
      }
    >
      {/* Стан банку */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-600 leading-relaxed">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="font-bold text-slate-800 text-sm">У банку {drafts.length} питань</span>
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(level => (
            <span key={level} className={`px-2 py-0.5 rounded-md border font-semibold ${DIFFICULTY_TONE[level]}`}>
              {DIFFICULTY_LABEL[level]}: {counts[level]}
            </span>
          ))}
        </div>
        На кожну спробу співробітник отримує випадкову добірку (типово {DEFAULT_QUIZ_QUESTION_COUNT} питань), тому
        що більший банк, то менше повторів.
        {drafts.length < DEFAULT_QUIZ_QUESTION_COUNT * 2 && (
          <span className="text-amber-700 font-medium"> Банк невеликий — варто додати питання, щоб спроби відрізнялися.</span>
        )}
      </div>

      {/* Дії */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
        >
          <Plus className="w-4 h-4" />
          Додати питання
        </button>

        <div className="inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition disabled:opacity-60"
            title="ШІ складе нові питання за текстом інструкції, не повторюючи наявні"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Генерація…' : 'Догенерувати ШІ'}
          </button>
          <select
            value={generateCount}
            onChange={e => setGenerateCount(Number(e.target.value))}
            disabled={generating}
            aria-label="Скільки питань згенерувати"
            className="text-xs font-semibold text-indigo-700 bg-transparent border-l border-indigo-200 px-2 py-2 outline-none"
          >
            {GENERATE_COUNTS.map(n => <option key={n} value={n}>{n} шт.</option>)}
          </select>
        </div>

        <div className="grow" />

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук у питаннях"
            className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-44"
          />
        </div>
        <select
          value={difficultyFilter}
          onChange={e => setDifficultyFilter(e.target.value as Difficulty | 'all')}
          aria-label="Фільтр за складністю"
          className="text-xs font-semibold px-2.5 py-2 bg-white border border-slate-300 rounded-xl outline-none"
        >
          <option value="all">Уся складність</option>
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(level => (
            <option key={level} value={level}>{DIFFICULTY_LABEL[level]}</option>
          ))}
        </select>
      </div>

      {notice && (
        <div className="flex items-start gap-2 text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-px" />
          <span className="grow">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Сховати" className="text-indigo-500 hover:text-indigo-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Перелік питань */}
      {drafts.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">
          У цієї інструкції ще немає питань. Додайте їх вручну або догенеруйте за допомогою ШІ.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">Нічого не знайдено.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(({ d, number }) => (
            <QuestionCard
              key={d.draftKey}
              draft={d}
              number={number}
              expanded={expandedKey === d.draftKey}
              onToggle={() => setExpandedKey(prev => (prev === d.draftKey ? null : d.draftKey))}
              onChange={patch => update(d.draftKey, patch)}
              onRemove={() => remove(d.draftKey)}
            />
          ))}
        </div>
      )}
    </MaterialEditDialog>
  );
};

const QuestionCard: React.FC<{
  draft: DraftQuestion;
  number: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onRemove: () => void;
}> = ({ draft, number, expanded, onToggle, onChange, onRemove }) => {
  const problem = validationProblem(draft);

  const setOption = (idx: number, value: string) => {
    const options = [...draft.options];
    options[idx] = value;
    onChange({ options });
  };

  const removeOption = (idx: number) => {
    const options = draft.options.filter((_, i) => i !== idx);
    let correctIndex = draft.correctIndex;
    if (idx === correctIndex) correctIndex = 0;
    else if (idx < correctIndex) correctIndex -= 1;
    onChange({ options, correctIndex });
  };

  return (
    <div className={`rounded-xl border bg-white transition ${
      problem ? 'border-rose-200' : expanded ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-200'
    }`}>
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="grow min-w-0 flex items-start gap-2.5 text-left"
        >
          <span className="text-[11px] font-bold text-slate-400 w-6 shrink-0 pt-0.5">№{number}</span>
          <span className="grow min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${DIFFICULTY_TONE[draft.difficulty]}`}>
                {DIFFICULTY_LABEL[draft.difficulty]}
              </span>
              {draft.isNew && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                  Нове
                </span>
              )}
              {problem && <span className="text-[10px] font-semibold text-rose-600">Потрібно виправити: {problem}</span>}
            </span>
            <span className={`block text-sm font-semibold leading-snug ${draft.question ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {draft.question || 'Нове питання без тексту'}
            </span>
            {!expanded && draft.options[draft.correctIndex] && (
              <span className="flex items-start gap-1 mt-1 text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span className="truncate">{draft.options[draft.correctIndex]}</span>
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
          title="Видалити питання"
          aria-label={`Видалити питання №${number}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-4 pt-1 space-y-3 border-t border-slate-100">
          <FormField label="Текст питання" required className="pt-3">
            <textarea
              value={draft.question}
              onChange={e => onChange({ question: e.target.value })}
              rows={2}
              className={FIELD_INPUT_CLASS}
              autoFocus={!draft.question}
            />
          </FormField>

          <FormField label="Робоча ситуація" hint="Необов'язково. Показується над питанням як контекст.">
            <textarea
              value={draft.contextScenario || ''}
              onChange={e => onChange({ contextScenario: e.target.value })}
              rows={2}
              className={FIELD_INPUT_CLASS}
            />
          </FormField>

          <FormField label="Варіанти відповіді" required hint="Позначте кружечком правильну відповідь. На кожній спробі варіанти перемішуються.">
            <div className="space-y-2">
              {draft.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${draft.draftKey}`}
                    checked={draft.correctIndex === idx}
                    onChange={() => onChange({ correctIndex: idx })}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 shrink-0"
                    aria-label={`Варіант ${idx + 1} — правильна відповідь`}
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={e => setOption(idx, e.target.value)}
                    placeholder={`Варіант ${idx + 1}`}
                    className={`${FIELD_INPUT_CLASS} ${draft.correctIndex === idx ? 'border-emerald-300 bg-emerald-50/40' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    disabled={draft.options.length <= 2}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={`Видалити варіант ${idx + 1}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {draft.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => onChange({ options: [...draft.options, ''] })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Додати варіант
                </button>
              )}
            </div>
          </FormField>

          <FormField label="Пояснення" hint="Показується після відповіді та в розборі результатів.">
            <textarea
              value={draft.explanation}
              onChange={e => onChange({ explanation: e.target.value })}
              rows={2}
              className={FIELD_INPUT_CLASS}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Складність">
              <select
                value={draft.difficulty}
                onChange={e => onChange({ difficulty: e.target.value as Difficulty })}
                className={FIELD_INPUT_CLASS}
              >
                {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(level => (
                  <option key={level} value={level}>{DIFFICULTY_LABEL[level]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Першоджерело" hint="Пункт регламенту або сторінка.">
              <input
                type="text"
                value={draft.sourceDocPage}
                onChange={e => onChange({ sourceDocPage: e.target.value })}
                className={FIELD_INPUT_CLASS}
              />
            </FormField>
          </div>
        </div>
      )}
    </div>
  );
};
