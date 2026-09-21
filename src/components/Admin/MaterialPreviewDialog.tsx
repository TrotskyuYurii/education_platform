import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowLeft,
  FileText,
  BookOpen,
  Briefcase,
  FolderTree,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  ListTodo,
  Lightbulb,
  ChevronRight,
  HelpCircle,
  Link2,
  FileSpreadsheet
} from 'lucide-react';
import { InstructionSection, QuizQuestion, KnowledgeSpace, CaseSimulation } from '../../types';
import { RichTextWithImages } from '../RichTextWithImages';
import { ImageLightboxModal } from '../ImageLightboxModal';
import { useModalA11y } from '../../hooks/useModalA11y';
import { MaterialBadge, MaterialBadgeChip } from './MaterialList';

/**
 * Перегляд матеріалу прямо з адміністрування.
 *
 * Раніше, щоб побачити готовий вигляд інструкції, курсу чи кейса, адміністратор
 * мусив вийти з адмінки в розділ навчання, знайти там матеріал і повернутися
 * назад. Тут той самий вміст показується поверх списку — без переходів і без
 * втрати місця в переліку.
 *
 * Це саме перегляд, а не проходження: тест і симуляція не запускаються, зате
 * одразу видно правильні відповіді та пояснення — те, що адміністратор і
 * перевіряє. З курсу можна провалитися в його інструкцію чи кейс і повернутися
 * назад стрілкою у шапці.
 */

export type MaterialPreviewTarget =
  | { kind: 'instruction'; id: string }
  | { kind: 'course'; id: string }
  | { kind: 'case'; id: string };

interface MaterialPreviewDialogProps {
  target: MaterialPreviewTarget | null;
  onClose: () => void;
  sections: InstructionSection[];
  questions: QuizQuestion[];
  courses: any[];
  cases: any[];
  spaces?: KnowledgeSpace[];
}

const KIND_META: Record<MaterialPreviewTarget['kind'], { icon: React.ReactNode; tone: string; label: string }> = {
  instruction: {
    icon: <FileText className="w-4 h-4" />,
    tone: 'bg-blue-50 text-blue-600 border-blue-100',
    label: 'Інструкція'
  },
  course: {
    icon: <BookOpen className="w-4 h-4" />,
    tone: 'bg-purple-50 text-purple-600 border-purple-100',
    label: 'Курс'
  },
  case: {
    icon: <Briefcase className="w-4 h-4" />,
    tone: 'bg-amber-50 text-amber-600 border-amber-100',
    label: 'Кейс'
  }
};

const STATUS_LABELS: Record<string, { label: string; tone: MaterialBadge['tone'] }> = {
  draft: { label: 'Чернетка', tone: 'amber' },
  in_review: { label: 'На рецензії', tone: 'purple' },
  archived: { label: 'Архів', tone: 'slate' },
  published: { label: 'Опубліковано', tone: 'emerald' }
};

/** Ролі кейсів у базі зберігаються англійськими ключами, як у симуляторі. */
const ROLE_LABELS: Record<string, string> = {
  cashier: 'Касир',
  manager: 'Менеджер',
  accountant: 'Бухгалтер'
};

/** Заголовок блоку всередині перегляду — однаковий для всіх типів матеріалів. */
const PreviewSection: React.FC<{ title: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children
}) => (
  <div>
    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
      {icon}
      {title}
    </h4>
    {children}
  </div>
);

export const MaterialPreviewDialog: React.FC<MaterialPreviewDialogProps> = props => {
  if (!props.target) return null;
  return <MaterialPreviewDialogInner {...props} target={props.target} />;
};

// Внутрішній компонент монтується лише з відкритим переглядом: інакше
// useModalA11y перехоплював би Escape і фокус, поки нічого не показано.
const MaterialPreviewDialogInner: React.FC<
  Omit<MaterialPreviewDialogProps, 'target'> & { target: MaterialPreviewTarget }
> = ({ target, onClose, sections, questions, courses, cases, spaces = [] }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  // Стек переходів: з курсу можна відкрити його інструкцію або кейс і повернутися.
  const [stack, setStack] = useState<MaterialPreviewTarget[]>([target]);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  // Клік по іншому рядку списку відкриває новий матеріал — починаємо стек заново.
  useEffect(() => {
    setStack([target]);
  }, [target.kind, target.id]);

  const current = stack[stack.length - 1];
  const push = (next: MaterialPreviewTarget) => {
    setStack(prev => [...prev, next]);
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const pop = () => setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const section = current.kind === 'instruction' ? sections.find(s => s.id === current.id) : undefined;
  const course = current.kind === 'course' ? courses.find(c => (c.id || c._id) === current.id) : undefined;
  const simulation: CaseSimulation | undefined =
    current.kind === 'case' ? cases.find(c => (c.id || c._id) === current.id) : undefined;

  const meta = KIND_META[current.kind];
  const title = section?.title || course?.title || simulation?.title || 'Матеріал не знайдено';
  const subtitle =
    current.kind === 'instruction'
      ? section?.subtitle || `ID: ${current.id}`
      : current.kind === 'course'
        ? `Курс · ${course?.department || 'Загальний'}`
        : 'Практичний кейс';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Перегляд матеріалу: ${title}`}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto flex flex-col max-h-[calc(100vh-2rem)]"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          {stack.length > 1 && (
            <button
              type="button"
              onClick={pop}
              className="mt-0.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-lg transition shrink-0"
              title="Повернутися до попереднього матеріалу"
              aria-label="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.tone}`}>
            {meta.icon}
          </div>
          <div className="grow min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Перегляд · {meta.label}
            </div>
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

        {/* Body */}
        <div ref={bodyRef} className="px-5 py-5 space-y-6 overflow-y-auto grow">
          {current.kind === 'instruction' && (
            section ? (
              <InstructionPreview
                section={section}
                questions={questions.filter(q => q.sectionId === section.id)}
                spaces={spaces}
                onImageClick={(url, alt) => setLightboxImage({ url, alt })}
              />
            ) : (
              <NotFound kind="Інструкцію" />
            )
          )}

          {current.kind === 'course' && (
            course ? (
              <CoursePreview
                course={course}
                sections={sections}
                questions={questions}
                cases={cases}
                onOpen={push}
              />
            ) : (
              <NotFound kind="Курс" />
            )
          )}

          {current.kind === 'case' && (
            simulation ? (
              <CasePreview simulation={simulation} sections={sections} onOpen={push} />
            ) : (
              <NotFound kind="Кейс" />
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-2xl shrink-0 flex items-center gap-2">
          <p className="text-[11px] text-slate-400 leading-snug grow">
            Це лише перегляд матеріалу — прогрес співробітників не змінюється.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition shrink-0"
          >
            Закрити
          </button>
        </div>
      </div>

      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          title={lightboxImage.alt || 'Скріншот інструкції'}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};

const NotFound: React.FC<{ kind: string }> = ({ kind }) => (
  <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
    {kind} не знайдено — можливо, його видалили. Оновіть сторінку.
  </div>
);

/** Рядок-посилання на інший матеріал: з курсу — в інструкцію чи кейс. */
const LinkRow: React.FC<{
  icon: React.ReactNode;
  iconTone: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  badges?: MaterialBadge[];
  onClick: () => void;
}> = ({ icon, iconTone, title, meta, badges, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition p-3 flex items-center gap-3"
  >
    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconTone}`}>{icon}</div>
    <div className="grow min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-bold text-slate-900 break-words">{title}</span>
        {badges?.filter(Boolean).map((b, i) => <MaterialBadgeChip key={i} badge={b} />)}
      </div>
      {meta && <div className="text-xs text-slate-500 mt-0.5 break-words">{meta}</div>}
    </div>
    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
  </button>
);

const InstructionPreview: React.FC<{
  section: InstructionSection;
  questions: QuizQuestion[];
  spaces: KnowledgeSpace[];
  onImageClick: (url: string, alt: string) => void;
}> = ({ section, questions, spaces, onImageClick }) => {
  const space = spaces.find(s => s.id === (section.spaceId || 'space-general'));
  const status = section.status ? STATUS_LABELS[section.status] : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {space && <MaterialBadgeChip badge={{ label: space.name, tone: 'blue', icon: <FolderTree className="w-3 h-3" /> }} />}
        <MaterialBadgeChip badge={{ label: section.department || 'Загальний', tone: 'slate' }} />
        <MaterialBadgeChip badge={{ label: `v${section.version || '1.0'}`, tone: 'purple', mono: true, icon: <GitBranch className="w-3 h-3" /> }} />
        {status && <MaterialBadgeChip badge={{ label: status.label, tone: status.tone }} />}
        {section.readTimeMin ? (
          <MaterialBadgeChip badge={{ label: `${section.readTimeMin} хв`, tone: 'amber', icon: <Clock className="w-3 h-3" /> }} />
        ) : null}
        {section.isActive === false && <MaterialBadgeChip badge={{ label: 'Вимкнено', tone: 'rose' }} />}
      </div>

      {section.sourceFile && (
        <a
          href={`/api/sections/${section.id}/source-file`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 hover:bg-rose-100 transition"
          title={section.sourceFile.fileName}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Оригінал документа
        </a>
      )}

      {section.summary && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
          {section.summary}
        </div>
      )}

      {section.keyPoints && section.keyPoints.length > 0 && (
        <PreviewSection title="Ключові тези" icon={<Lightbulb className="w-3.5 h-3.5 text-amber-500" />}>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {section.keyPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}

      {(section.contentMarkdown || section.contentHtml) && (
        <div className="prose prose-sm prose-slate max-w-none">
          <RichTextWithImages
            contentMarkdown={section.contentMarkdown}
            contentHtml={section.contentHtml}
            images={section.images}
            onImageClick={onImageClick}
          />
        </div>
      )}

      {section.steps && section.steps.length > 0 && (
        <PreviewSection title={`Кроки (${section.steps.length})`} icon={<ListTodo className="w-3.5 h-3.5 text-blue-500" />}>
          <ol className="space-y-2.5">
            {section.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold flex items-center justify-center shrink-0">
                  {step.number || i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 break-words">{step.title}</div>
                  {step.description && (
                    <p className="text-sm text-slate-600 mt-0.5 leading-relaxed break-words">{step.description}</p>
                  )}
                  {step.tip && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mt-2">
                      Порада: {step.tip}
                    </p>
                  )}
                  {step.warning && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                      Увага: {step.warning}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </PreviewSection>
      )}

      {section.tableData && section.tableData.headers?.length > 0 && (
        <PreviewSection title="Таблиця">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {section.tableData.headers.map((h, i) => (
                    <th key={i} className="text-left font-bold text-slate-700 px-3 py-2 border-b border-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(section.tableData.rows || []).map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-slate-600 align-top">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PreviewSection>
      )}

      {section.stopRules && section.stopRules.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-900 mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Стоп-правила (заборонено!)
          </h4>
          <ul className="space-y-1.5 text-sm text-rose-900">
            {section.stopRules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-rose-600 font-bold mt-0.5">✕</span>
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section.systemAutomaticActions && section.systemAutomaticActions.length > 0 && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Що система робить автоматично
          </h4>
          <ul className="space-y-1.5 text-sm text-emerald-900">
            {section.systemAutomaticActions.map((act, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                <span className="leading-relaxed">{act}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <QuestionsPreview questions={questions} />
    </>
  );
};

/** Тестові питання з одразу видимими правильними відповідями — саме це перевіряє адміністратор. */
const QuestionsPreview: React.FC<{ questions: QuizQuestion[] }> = ({ questions }) => (
  <PreviewSection
    title={`Тестові питання (${questions.length})`}
    icon={<HelpCircle className="w-3.5 h-3.5 text-indigo-500" />}
  >
    {questions.length === 0 ? (
      <p className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-3">
        До цієї інструкції ще не додано жодного питання.
      </p>
    ) : (
      <ol className="space-y-3">
        {questions.map((q, qi) => (
          <li key={q.id || qi} className="p-3.5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start gap-2 mb-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold flex items-center justify-center shrink-0">
                {qi + 1}
              </span>
              <div className="grow min-w-0">
                <p className="text-sm font-bold text-slate-900 break-words">{q.question}</p>
                {q.contextScenario && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{q.contextScenario}</p>
                )}
              </div>
              <MaterialBadgeChip
                badge={{
                  label: q.difficulty === 'easy' ? 'Легке' : q.difficulty === 'hard' ? 'Складне' : 'Середнє',
                  tone: q.difficulty === 'easy' ? 'emerald' : q.difficulty === 'hard' ? 'rose' : 'amber'
                }}
              />
            </div>
            <ul className="space-y-1.5">
              {(q.options || []).map((opt, oi) => {
                const isCorrect = oi === q.correctIndex;
                return (
                  <li
                    key={oi}
                    className={`flex items-start gap-2 text-sm rounded-lg px-2.5 py-1.5 border ${
                      isCorrect
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 shrink-0 mt-0.5 text-slate-400 text-center leading-4">–</span>
                    )}
                    <span className="leading-relaxed break-words">{opt}</span>
                  </li>
                );
              })}
            </ul>
            {q.explanation && (
              <p className="text-xs text-slate-600 mt-2.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 leading-relaxed">
                Пояснення: {q.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    )}
  </PreviewSection>
);

const CoursePreview: React.FC<{
  course: any;
  sections: InstructionSection[];
  questions: QuizQuestion[];
  cases: any[];
  onOpen: (target: MaterialPreviewTarget) => void;
}> = ({ course, sections, questions, cases, onOpen }) => {
  const instructionIds: string[] = course.instructionIds || [];
  const courseSections = instructionIds
    .map(id => sections.find(s => s.id === id))
    .filter((s): s is InstructionSection => Boolean(s));
  const missingCount = instructionIds.length - courseSections.length;
  // Кейси курсу добираються так само, як при проходженні: за інструкціями курсу.
  const courseCases = course.useCases
    ? cases.filter(c => c.sectionId && instructionIds.includes(c.sectionId))
    : [];
  const totalReadTime = courseSections.reduce((sum, s) => sum + (s.readTimeMin || 0), 0);
  const totalQuestions = questions.filter(q => instructionIds.includes(q.sectionId)).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <MaterialBadgeChip badge={{ label: course.department || 'Загальний', tone: 'blue' }} />
        {course.isActive === false && <MaterialBadgeChip badge={{ label: 'Вимкнено', tone: 'rose' }} />}
        {course.isProgressive && <MaterialBadgeChip badge={{ label: 'Послідовне проходження', tone: 'purple' }} />}
        {course.hasCertificate && (
          <MaterialBadgeChip
            badge={{
              label: `Сертифікат (${course.certificateValidityYears || 1} р.)`,
              tone: 'emerald',
              icon: <Award className="w-3 h-3" />
            }}
          />
        )}
        {totalReadTime > 0 && (
          <MaterialBadgeChip badge={{ label: `${totalReadTime} хв читання`, tone: 'amber', icon: <Clock className="w-3 h-3" /> }} />
        )}
      </div>

      <PreviewSection title="Умови фінального тесту">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatBox label="Прохідний бал" value={`${course.quizPassScorePercent ?? 80}%`} />
          <StatBox label="Ліміт часу" value={course.quizTimeLimitMin ? `${course.quizTimeLimitMin} хв` : 'Без ліміту'} />
          <StatBox label="Спроб" value={course.quizMaxAttempts ? String(course.quizMaxAttempts) : 'Без обмежень'} />
          <StatBox label="Питань у базі" value={String(totalQuestions)} />
        </div>
      </PreviewSection>

      <PreviewSection title={`Інструкції курсу (${courseSections.length})`} icon={<FileText className="w-3.5 h-3.5 text-blue-500" />}>
        {courseSections.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-3">
            До курсу ще не додано жодної інструкції.
          </p>
        ) : (
          <div className="space-y-2">
            {courseSections.map((s, i) => (
              <LinkRow
                key={s.id}
                icon={<span className="text-xs font-bold">{i + 1}</span>}
                iconTone="bg-blue-50 text-blue-600 border-blue-100"
                title={s.title}
                badges={s.isActive === false ? [{ label: 'Вимкнено', tone: 'slate' as const }] : []}
                meta={`${s.department || 'Загальний'} · ${s.readTimeMin || 0} хв · Питань: ${
                  questions.filter(q => q.sectionId === s.id).length
                }`}
                onClick={() => onOpen({ kind: 'instruction', id: s.id })}
              />
            ))}
          </div>
        )}
        {missingCount > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
            Інструкцій курсу не знайдено в базі: {missingCount} — імовірно, їх видалили.
          </p>
        )}
      </PreviewSection>

      {course.useCases && (
        <PreviewSection title={`Практичні кейси (${courseCases.length})`} icon={<Briefcase className="w-3.5 h-3.5 text-amber-500" />}>
          {courseCases.length === 0 ? (
            <p className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-3">
              Практика увімкнена, але жоден кейс не прив'язаний до інструкцій цього курсу.
            </p>
          ) : (
            <div className="space-y-2">
              {courseCases.map(c => (
                <LinkRow
                  key={c.id || c._id}
                  icon={<Briefcase className="w-4 h-4" />}
                  iconTone="bg-amber-50 text-amber-600 border-amber-100"
                  title={c.title}
                  badges={c.isActive === false ? [{ label: 'Вимкнено', tone: 'slate' as const }] : []}
                  meta={<span className="line-clamp-2">{c.scenario}</span>}
                  onClick={() => onOpen({ kind: 'case', id: c.id || c._id })}
                />
              ))}
            </div>
          )}
        </PreviewSection>
      )}
    </>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-sm font-bold text-slate-900 mt-0.5">{value}</div>
  </div>
);

const CasePreview: React.FC<{
  simulation: CaseSimulation;
  sections: InstructionSection[];
  onOpen: (target: MaterialPreviewTarget) => void;
}> = ({ simulation, sections, onOpen }) => {
  const linked = simulation.sectionId ? sections.find(s => s.id === simulation.sectionId) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {simulation.role && <MaterialBadgeChip badge={{ label: `Роль: ${ROLE_LABELS[simulation.role] || simulation.role}`, tone: 'blue' }} />}
        {simulation.isActive === false && <MaterialBadgeChip badge={{ label: 'Вимкнено', tone: 'rose' }} />}
        <MaterialBadgeChip badge={{ label: `Варіантів: ${(simulation.options || []).length}`, tone: 'slate' }} />
      </div>

      {linked && (
        <LinkRow
          icon={<Link2 className="w-4 h-4" />}
          iconTone="bg-blue-50 text-blue-600 border-blue-100"
          title={linked.title}
          meta="Інструкція, до якої прив'язаний кейс"
          onClick={() => onOpen({ kind: 'instruction', id: linked.id })}
        />
      )}

      <PreviewSection title="Опис обставин">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-line">
          {simulation.scenario}
        </div>
      </PreviewSection>

      {simulation.clientDialogue && (
        <PreviewSection title="Репліка клієнта">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-900 leading-relaxed italic whitespace-pre-line">
            {simulation.clientDialogue}
          </div>
        </PreviewSection>
      )}

      <PreviewSection title="Варіанти дій">
        <div className="space-y-2.5">
          {(simulation.options || []).map((opt, i) => (
            <div
              key={opt.id || i}
              className={`p-3.5 rounded-xl border ${
                opt.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {opt.isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm break-words ${opt.isCorrect ? 'font-bold text-emerald-950' : 'text-slate-800'}`}>
                    {opt.text}
                  </p>
                  {opt.feedback && (
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed break-words">
                      Зворотний зв'язок: {opt.feedback}
                    </p>
                  )}
                  {opt.legalOrSystemBasis && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">
                      Підстава: {opt.legalOrSystemBasis}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PreviewSection>
    </>
  );
};
