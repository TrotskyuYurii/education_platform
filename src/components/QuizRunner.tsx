import React, { useState, useMemo, useEffect } from 'react';
import { QuizQuestion, RoleFilter, InstructionSection } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { 
  Award, Trophy, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  BookOpen, 
  Check, 
  FileText, 
  Sparkles,
  Briefcase,
  Clock,
  Shuffle
} from 'lucide-react';
import { SUCCESS_QUOTES, RESILIENCE_QUOTES, UkrainianQuote } from '../data/ukrainianQuotes';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  DEFAULT_QUIZ_QUESTION_COUNT,
  pickQuizQuestions,
  shuffleQuestionOptions,
  mergeRecentQuestionIds
} from '../../shared/quizSampling';
import { formatDuration } from '../../shared/attemptDuration';

/**
 * Які питання співробітник бачив нещодавно — щоб наступна спроба почалася з
 * інших. Це лише зручність у межах браузера: без неї (приватне вікно, очищені
 * дані) вибірка все одно випадкова.
 */
const recentQuestionsKey = (userId?: string) => `quiz-recent-questions:${userId || 'anonymous'}`;

function readRecentQuestionIds(userId?: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentQuestionsKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberShownQuestions(userId: string | undefined, shownIds: string[]) {
  try {
    const merged = mergeRecentQuestionIds(readRecentQuestionIds(userId), shownIds);
    localStorage.setItem(recentQuestionsKey(userId), JSON.stringify(merged));
  } catch {
    /* сховище недоступне — просто не пам'ятаємо історію */
  }
}

interface QuizRunnerProps {
  allQuestions: QuizQuestion[];
  initialSectionId?: string;
  initialCourseId?: string;
  allSections: InstructionSection[];
  courses?: any[];
  quizHistory?: any[];
  onRecordScore: (
    score: number,
    total: number,
    modeName: string,
    department?: string,
    courseId?: string,
    sectionId?: string,
    timing?: { startedAt: string; durationSec: number }
  ) => void;
  onNavigateToSignoff: () => void;
  onBackToManual: () => void;
  onStartCases?: (courseId: string) => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  allQuestions,
  initialSectionId,
  initialCourseId,
  allSections,
  courses = [],
  quizHistory = [],
  onRecordScore,
  onNavigateToSignoff,
  onBackToManual,
  onStartCases,
}) => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
    const specificDept = user?.departments?.find(d => d !== 'Всі підрозділи');
    return specificDept || 'all';
  });
  const [examMode, setExamMode] = useState<boolean>(false); // false: instant feedback, true: exam at the end
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizAttempt, setQuizAttempt] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [targetSectionId, setTargetSectionId] = useState<string | undefined>(initialSectionId);
  const [targetCourseId, setTargetCourseId] = useState<string | undefined>(initialCourseId);

  // Sync state if props change
  useEffect(() => {
    setTargetSectionId(initialSectionId);
    setTargetCourseId(initialCourseId);
    if (initialSectionId || initialCourseId) {
      setQuizStarted(false);
      setQuizSubmitted(false);
      setUserAnswers({});
      setCurrentIndex(0);
      setQuizAttempt(prev => prev + 1);
    }
  }, [initialSectionId, initialCourseId]);
  
  // Animation overlay state
  const [reaction, setReaction] = useState<{ type: 'success' | 'error', emoji: string, text: string, author?: string } | null>(null);
  const [finalQuote, setFinalQuote] = useState<UkrainianQuote | null>(null);
  // Висловлювання вмикаються й вимикаються в «Адміністрування → Налаштування»
  const { settings: appSettings } = useAppSettings();
  const showQuotes = appSettings.quizQuotesEnabled;

  const currentTargetSection = useMemo(() => {
    if (!targetSectionId) return null;
    return allSections.find(s => s.id === targetSectionId);
  }, [allSections, targetSectionId]);

  const currentTargetCourse = useMemo(() => {
    if (!targetCourseId) return null;
    return courses.find(c => c.id === targetCourseId);
  }, [courses, targetCourseId]);

  // Clear any existing reaction timer when unmounting or starting a new quiz
  useEffect(() => {
    return () => setReaction(null);
  }, [quizAttempt]);

  // Extract unique departments for dropdown
  const departments = useMemo(() => {
    const deps = new Set<string>();
    allQuestions.forEach(q => {
      const d = q.department;
      const name = typeof d === 'string' ? d : (d as any)?.name;
      if (name && typeof name === 'string' && name.trim()) deps.add(name.trim());
    });
    return Array.from(deps).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [allQuestions]);

  // Extract unique courses for dropdown (now using props)
  const availableCourses = useMemo(() => {
    return courses;
  }, [courses]);

  // Банк питань для обраного матеріалу (без перемішування — вибірка робиться на старті спроби)
  const questionPool = useMemo(() => {
    let list = [...allQuestions];

    if (targetSectionId) {
      list = list.filter((q) => q.sectionId === targetSectionId);
    } else if (targetCourseId) {
      const course = courses.find(c => c.id === targetCourseId);
      if (course) {
        list = list.filter(q => course.instructionIds.includes(q.sectionId));
      }
    } else {
      if (selectedRole !== 'all') {
        list = list.filter((q) => q.role === 'all' || q.role === selectedRole);
      }
      if (selectedDepartment !== 'all') {
        list = list.filter((q) => q.department === selectedDepartment);
      }
    }

    return list;
  }, [allQuestions, targetSectionId, targetCourseId, courses, selectedRole, selectedDepartment]);

  // Скільки питань показати за одну спробу: налаштування курсу або типова кількість
  const questionsPerAttempt = Math.min(
    questionPool.length,
    currentTargetCourse?.quizQuestionCount || DEFAULT_QUIZ_QUESTION_COUNT
  );

  /**
   * Питання поточної спроби фіксуються на старті: інакше оновлення контенту
   * посеред тесту перемішало б їх і відповіді «з'їхали» б на інші питання.
   */
  const [questionsToRun, setQuestionsToRun] = useState<QuizQuestion[]>([]);

  /** Коли розпочато поточну спробу та скільки вона тривала — для запису в історію. */
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null);
  const [attemptDurationSec, setAttemptDurationSec] = useState<number | null>(null);

  const currentQ = questionsToRun[currentIndex];

  const handleSelectOption = (optionIndex: number) => {
    if (quizSubmitted) return;
    if (!examMode && userAnswers[currentIndex] !== undefined) return; // already answered in instant mode

    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));

    // Trigger random animation on instant feedback mode
    if (!examMode) {
      const isCorrect = optionIndex === currentQ.correctIndex;
      // ~50% chance to show an authentic Ukrainian motivational quote reaction
      if (showQuotes && Math.random() < 0.5) {
        const list = isCorrect ? SUCCESS_QUOTES : RESILIENCE_QUOTES;
        const randomItem = list[Math.floor(Math.random() * list.length)];
        
        setReaction({ type: isCorrect ? 'success' : 'error', ...randomItem });
        
        // Auto-hide after 2.8 seconds
        setTimeout(() => {
          setReaction(null);
        }, 2800);
      }
    }
  };

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (quizStarted && !quizSubmitted && timeLeft !== null && timeLeft > 0) {
      const timerId = setTimeout(() => {
        setTimeLeft(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timerId);
    } else if (quizStarted && !quizSubmitted && timeLeft === 0) {
      handleFinishQuiz();
    }
  }, [quizStarted, quizSubmitted, timeLeft]);

  const handleStartQuiz = () => {
    const picked = pickQuizQuestions(questionPool, questionsPerAttempt, {
      recentIds: readRecentQuestionIds(user?.id)
    }).map(q => shuffleQuestionOptions(q));
    rememberShownQuestions(user?.id, picked.map(q => q.id));
    setQuestionsToRun(picked);
    setAttemptStartedAt(Date.now());
    setAttemptDurationSec(null);
    setUserAnswers({});
    setCurrentIndex(0);
    setQuizSubmitted(false);
    setQuizStarted(true);
    setQuizAttempt((prev) => prev + 1);
    setReaction(null);
    setFinalQuote(null);
    if (currentTargetCourse?.quizTimeLimitMin) {
      setTimeLeft(currentTargetCourse.quizTimeLimitMin * 60);
    } else {
      setTimeLeft(null);
    }
  };

  const handleFinishQuiz = () => {
    setQuizSubmitted(true);
    const finishedAt = Date.now();
    const startedAt = attemptStartedAt ?? finishedAt;
    let durationSec = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
    // При автоматичному завершенні таймер міг «переспати» у фоновій вкладці —
    // тривалість не може перевищувати сам ліміт часу.
    if (currentTargetCourse?.quizTimeLimitMin) {
      durationSec = Math.min(durationSec, currentTargetCourse.quizTimeLimitMin * 60);
    }
    setAttemptDurationSec(durationSec);
    // calculate score
    let correctCount = 0;
    questionsToRun.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const passScorePercent = currentTargetCourse?.quizPassScorePercent || 80;
    const isPassedResult = questionsToRun.length > 0 && ((correctCount / questionsToRun.length) * 100 >= passScorePercent);
    const quoteList = isPassedResult ? SUCCESS_QUOTES : RESILIENCE_QUOTES;
    setFinalQuote(showQuotes ? quoteList[Math.floor(Math.random() * quoteList.length)] : null);

    const modeLabel = targetSectionId 
      ? 'Тест за розділом' 
      : selectedRole === 'all' 
        ? 'Повний тест' 
        : `Тест (${selectedRole})`;

    onRecordScore(
      correctCount, 
      questionsToRun.length, 
      modeLabel, 
      selectedDepartment !== 'all' ? selectedDepartment : undefined,
      targetCourseId,
      targetSectionId,
      { startedAt: new Date(startedAt).toISOString(), durationSec }
    );
  };

  const currentSelectedOption = userAnswers[currentIndex];
  const isCurrentAnswered = currentSelectedOption !== undefined;
  const isCurrentCorrect = isCurrentAnswered && currentSelectedOption === currentQ?.correctIndex;

  // Calculate stats
  const totalCount = questionsToRun.length;
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = Object.entries(userAnswers).filter(([idx, ans]) => {
    return questionsToRun[Number(idx)]?.correctIndex === ans;
  }).length;
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const passScorePercent = currentTargetCourse?.quizPassScorePercent || 80;
  const isPassed = percentage >= passScorePercent;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* 1. Pre-Quiz Setup Screen */}
      {!quizStarted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5 shadow-xs border border-blue-100">
            <Award className="w-8 h-8" />
          </div>

          <h2 id="quiz-main-title" className="text-2xl sm:text-3xl font-bold text-slate-900">
            {currentTargetSection 
              ? `Тестування: ${currentTargetSection.title}` 
              : currentTargetCourse 
                ? `Тестування курсу: ${currentTargetCourse.title}` 
                : 'Перевірка знань'}
          </h2>
          <p id="quiz-main-description" className="text-slate-600 mt-2 max-w-xl mx-auto text-sm sm:text-base">
            {currentTargetSection 
              ? `Перевірте знання порядку дій, ключових полів та СТОП-списків згідно з регламентом "${currentTargetSection.title}".`
              : 'Тести складені на основі внутрішніх регламентів і інструкцій компанії ТОВ Віатек. Закріпіть навички і порядки дій.'}
          </p>

          {/* Mode & Filter Selection */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
            {departments.length > 0 && !targetSectionId && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Підрозділ:
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Всі підрозділи</option>
                  {departments.map((dep, idx) => {
                    const label = typeof dep === 'string' ? dep : ((dep as any)?.name || String(dep));
                    return <option key={`quiz-dept-${label}-${idx}`} value={label}>{label}</option>;
                  })}
                </select>
              </div>
            )}

            <div className={`p-4 rounded-xl border border-slate-200 bg-slate-50/50 ${departments.length === 0 || targetSectionId ? 'lg:col-span-2' : ''}`}>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                Що тестуємо?
              </label>
              <select
                value={
                  targetSectionId ? `section_${targetSectionId}` :
                  targetCourseId ? `course_${targetCourseId}` :
                  `role_${selectedRole}`
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetSectionId(undefined);
                  setTargetCourseId(undefined);
                  setSelectedRole('all');
                  
                  if (val.startsWith('section_')) setTargetSectionId(val.replace('section_', ''));
                  else if (val.startsWith('course_')) setTargetCourseId(val.replace('course_', ''));
                  else if (val.startsWith('role_')) setSelectedRole(val.replace('role_', '') as RoleFilter);
                  else if (val === 'all') setSelectedRole('all');
                }}
                className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Усі матеріали</option>
                <optgroup label="За ролями">
                  <option value="role_cashier">Роль: Касир</option>
                  <option value="role_manager">Роль: Менеджер</option>
                  <option value="role_accountant">Роль: Бухгалтер</option>
                </optgroup>
                <optgroup label="За курсами">
                  {availableCourses.map(c => (
                    <option key={c.id} value={`course_${c.id}`}>Курс: {c.title}</option>
                  ))}
                </optgroup>
                <optgroup label="Окремі інструкції">
                  {allSections.map(s => (
                    <option key={s.id} value={`section_${s.id}`}>
                      Інструкція: {s.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className={`p-4 rounded-xl border border-slate-200 bg-slate-50/50 ${departments.length === 0 || targetSectionId ? 'lg:col-span-1' : ''}`}>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                Формат тестування:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExamMode(false)}
                  className={`flex-1 py-2 px-2.5 text-xs font-semibold rounded-lg border transition ${
                    !examMode 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  З поясненнями
                </button>
                <button
                  type="button"
                  onClick={() => setExamMode(true)}
                  className={`flex-1 py-2 px-2.5 text-xs font-semibold rounded-lg border transition ${
                    examMode 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Екзамен (в кінці)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {(() => {
              const pastAttempts = currentTargetCourse ? quizHistory.filter((h: any) => h.mode !== 'cases' && h.courseId === currentTargetCourse.id).length : 0;
              const maxAttempts = currentTargetCourse?.quizMaxAttempts;
              const hasNoAttempts = maxAttempts ? pastAttempts >= maxAttempts : false;

              return (
                <div className="flex flex-col items-center w-full sm:w-auto">
                  <button
                    onClick={handleStartQuiz}
                    disabled={questionPool.length === 0 || hasNoAttempts}
                    id="btn-start-quiz-now"
                    className="w-full px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Розпочати тестування ({questionsPerAttempt} питань)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {questionPool.length > questionsPerAttempt && (
                    <span className="text-xs font-medium mt-2 text-slate-500 flex items-center gap-1.5">
                      <Shuffle className="w-3.5 h-3.5" />
                      Щоразу нова добірка з банку в {questionPool.length} питань
                    </span>
                  )}
                  {maxAttempts && (
                    <span className={`text-xs font-semibold mt-2 ${hasNoAttempts ? 'text-rose-600' : 'text-slate-500'}`}>
                      Використано спроб: {pastAttempts} з {maxAttempts}
                    </span>
                  )}
                  {currentTargetCourse?.quizTimeLimitMin && (
                    <span className="text-xs font-semibold mt-1 text-slate-500">
                      ⏱ Ліміт часу: {currentTargetCourse.quizTimeLimitMin} хв
                    </span>
                  )}
                </div>
              );
            })()}
            <button
              onClick={onBackToManual}
              className="w-full sm:w-auto px-5 py-3 text-slate-600 hover:text-slate-900 font-semibold text-xs transition"
            >
              Повернутися до читання інструкції
            </button>
          </div>
          {questionPool.length === 0 && (
            <p className="mt-4 text-sm text-rose-500 font-medium">Для даного розділу або курсу поки що не створено жодного питання.</p>
          )}
        </div>
      )}

      {/* 2. Active Quiz In-Progress Screen */}
      {quizStarted && !quizSubmitted && currentQ && (
        <div className="space-y-6 relative">
          
          <AnimatePresence>
            {reaction && (
              <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.3, rotate: -6 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -40 }}
                  transition={{ type: "spring", bounce: 0.45 }}
                  className={`flex flex-col items-center justify-center px-6 sm:px-10 py-6 sm:py-8 rounded-3xl shadow-2xl backdrop-blur-md border-4 max-w-md sm:max-w-xl text-center ${
                    reaction.type === 'success' 
                      ? 'bg-emerald-600/95 border-emerald-300 text-white' 
                      : 'bg-rose-600/95 border-rose-300 text-white'
                  }`}
                >
                  <span className="text-5xl sm:text-6xl mb-3 drop-shadow-md">{reaction.emoji}</span>
                  <span className="text-lg sm:text-2xl font-black tracking-normal leading-snug text-center drop-shadow-md mb-2">
                    «{reaction.text.replace(/^[«"]|[»"]$/g, '')}»
                  </span>
                  {reaction.author && (
                    <span className="text-xs sm:text-sm font-semibold opacity-95 drop-shadow-sm mt-1.5 italic bg-black/20 px-3.5 py-1 rounded-full">
                      — {reaction.author}
                    </span>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Header Progress Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  Питання {currentIndex + 1} з {totalCount}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {currentQ.sourceDocPage}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {timeLeft !== null && (
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border ${
                    timeLeft < 60 ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </div>
                )}
                <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                  Відповідей: {answeredCount}/{totalCount}
                </span>
              </div>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            
            {/* Practical Scenario Context Badge (if present) */}
            {currentQ.contextScenario && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs sm:text-sm font-medium flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Робоча ситуація: </span>
                  {currentQ.contextScenario}
                </div>
              </div>
            )}

            <h3 id="quiz-question-text" className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {currentQ.question}
            </h3>

            {/* Options List */}
            <div className="mt-6 space-y-3" role="radiogroup" aria-labelledby="quiz-question-text">
              {(currentQ.options || []).map((option, optIdx) => {
                const isSelected = currentSelectedOption === optIdx;
                const isCorrectOpt = currentQ.correctIndex === optIdx;

                let btnStyles = 'border-slate-200 hover:border-slate-300 bg-white text-slate-800';

                // In instant feedback mode:
                if (!examMode && isCurrentAnswered) {
                  if (isCorrectOpt) {
                    btnStyles = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20';
                  } else if (isSelected) {
                    btnStyles = 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20';
                  } else {
                    btnStyles = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                  }
                } else if (isSelected) {
                  btnStyles = 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20 font-semibold';
                }

                return (
                  <button
                    key={optIdx}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={option}
                    onClick={() => handleSelectOption(optIdx)}
                    disabled={!examMode && isCurrentAnswered}
                    className={`w-full text-left p-4 rounded-xl border transition flex items-start gap-3.5 ${btnStyles}`}
                  >
                    <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 transition ${
                      !examMode && isCurrentAnswered
                        ? isCorrectOpt
                          ? 'bg-emerald-600 text-white'
                          : isSelected
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        : isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {String.fromCharCode(65 + optIdx)}
                    </div>
                    <span className="text-xs sm:text-sm leading-relaxed grow">
                      {option}
                    </span>

                    {!examMode && isCurrentAnswered && isCorrectOpt && (
                      <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {!examMode && isCurrentAnswered && isSelected && !isCorrectOpt && (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant Mode Feedback Box */}
            {!examMode && isCurrentAnswered && (
              <div className={`mt-6 p-4 rounded-xl border ${
                isCurrentCorrect 
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
                  {isCurrentCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Правильно!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Помилка. Зверніть увагу на регламент:</span>
                    </>
                  )}
                </div>
                <p className="text-xs sm:text-sm leading-relaxed">
                  {currentQ.explanation}
                </p>
                <p className="mt-2 text-xs font-medium opacity-80">
                  📖 Джерело: {currentQ.sourceDocPage}
                </p>
              </div>
            )}

            {/* Navigation Buttons Inside Card */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>

              {currentIndex < totalCount - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  disabled={!isCurrentAnswered}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition flex items-center gap-1.5 shadow-xs"
                >
                  <span>Наступне питання</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishQuiz}
                  disabled={!isCurrentAnswered}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Завершити тест та отримати результат</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 3. Final Quiz Results & Analysis Screen */}
      {quizSubmitted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs">
          
          <div className="text-center pb-8 border-b border-slate-100">
            
            {(() => {
              const course = targetCourseId ? courses.find(c => c.id === targetCourseId) : null;
              const hasCert = isPassed && course && course.hasCertificate;
              return hasCert ? (
                <div className="mx-auto mb-6 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-100 to-amber-200 border-4 border-white shadow-xl flex items-center justify-center mb-4 relative animate-in zoom-in duration-500">
                    <Trophy className="w-12 h-12 text-amber-600 drop-shadow-sm" />
                    <div className="absolute -right-2 -top-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 max-w-md">
                    🎉 Вітаємо! Сертифікат за курс «{course.title}» успішно додано до вашого профілю.
                  </div>
                </div>
              ) : (
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border ${
                  isPassed 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : 'bg-amber-50 text-amber-600 border-amber-200'
                }`}>
                  {isPassed ? <Award className="w-10 h-10" /> : <HelpCircle className="w-10 h-10" />}
                </div>
              );
            })()}


            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
              isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {isPassed ? 'Тест успішно складено' : 'Потрібне повторне вивчення'}
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Ваш результат: {percentage}% ({correctCount} з {totalCount})
            </h2>
            {attemptDurationSec !== null && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                Час проходження: {formatDuration(attemptDurationSec)}
              </p>
            )}
            <p className="text-slate-600 mt-2 text-sm sm:text-base max-w-md mx-auto">
              {isPassed 
                ? 'Вітаємо! Ви продемонстрували відмінні знання регламенту повернення товарів за стандартом компанії.' 
                : 'Для успішної сертифікації прохідний бал становить 80%. Рекомендуємо переглянути помилки та повторити розділи.'}
            </p>

            {finalQuote && (
              <div className="mt-5 max-w-lg mx-auto p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 text-center">
                <span className="text-2xl sm:text-3xl block mb-1">{finalQuote.emoji}</span>
                <p className="text-sm sm:text-base font-bold text-slate-800 italic leading-snug">
                  «{finalQuote.text.replace(/^[«"]|[»"]$/g, '')}»
                </p>
                <p className="text-xs text-blue-700 mt-1.5 font-semibold">
                  — {finalQuote.author}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={handleStartQuiz}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Спробувати ще раз</span>
              </button>

              {targetCourseId && courses.find(c => c.id === targetCourseId)?.useCases && onStartCases ? (
                <button
                  onClick={() => onStartCases(targetCourseId)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Перейти до розбору кейсів</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onBackToManual}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Повернутися до порталу</span>
                </button>
              )}
            </div>
          </div>

          {/* Detailed Question by Question Review */}
          <div className="mt-8">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Детальний розбір відповідей:</span>
              <span className="text-xs font-medium text-slate-500">
                Правильних: {correctCount} / Помилок: {totalCount - correctCount}
              </span>
            </h3>

            <div className="space-y-4">
              {questionsToRun.map((q, idx) => {
                const userAns = userAnswers[idx];
                const isCorrect = userAns === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    className={`p-4 sm:p-5 rounded-xl border transition ${
                      isCorrect 
                        ? 'border-slate-200 bg-slate-50/40' 
                        : 'border-rose-200 bg-rose-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {isCorrect ? '✓' : '✕'}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          Питання №{idx + 1}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {q.sourceDocPage}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 mb-2">
                      {q.question}
                    </p>

                    <div className="text-xs space-y-1 mb-2">
                      <p className={`font-medium ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                        Ваша відповідь: {q.options[userAns] || '— не відповіли —'}
                      </p>
                      {!isCorrect && (
                        <p className="text-emerald-800 font-medium">
                          Правильна відповідь: {q.options[q.correctIndex]}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-800">Пояснення: </span>
                      {q.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
