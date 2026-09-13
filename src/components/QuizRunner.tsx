import React, { useState, useMemo, useEffect } from 'react';
import { QuizQuestion, RoleFilter, InstructionSection } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  BookOpen, 
  Check, 
  FileText, 
  Sparkles 
} from 'lucide-react';
import { SUCCESS_QUOTES, RESILIENCE_QUOTES, UkrainianQuote } from '../data/ukrainianQuotes';

interface QuizRunnerProps {
  allQuestions: QuizQuestion[];
  initialSectionId?: string;
  initialCourseId?: string;
  allSections: InstructionSection[];
  courses?: any[];
  onRecordScore: (score: number, total: number, modeName: string, department?: string, courseId?: string, sectionId?: string) => void;
  onNavigateToSignoff: () => void;
  onBackToManual: () => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  allQuestions,
  initialSectionId,
  initialCourseId,
  allSections,
  courses = [],
  onRecordScore,
  onNavigateToSignoff,
  onBackToManual,
}) => {
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [examMode, setExamMode] = useState<boolean>(false); // false: instant feedback, true: exam at the end
  const [quizStarted, setQuizStarted] = useState<boolean>(false);
  const [quizAttempt, setQuizAttempt] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [targetSectionId, setTargetSectionId] = useState<string | undefined>(initialSectionId);
  const [targetCourseId, setTargetCourseId] = useState<string | undefined>(initialCourseId);
  
  // Animation overlay state
  const [reaction, setReaction] = useState<{ type: 'success' | 'error', emoji: string, text: string, author?: string } | null>(null);
  const [finalQuote, setFinalQuote] = useState<UkrainianQuote | null>(null);

  // Clear any existing reaction timer when unmounting or starting a new quiz
  useEffect(() => {
    return () => setReaction(null);
  }, [quizAttempt]);

  // Extract unique departments for dropdown
  const departments = useMemo(() => {
    const deps = new Set(allQuestions.map(q => q.department));
    return Array.from(deps).filter(Boolean);
  }, [allQuestions]);

  // Extract unique courses for dropdown (now using props)
  const availableCourses = useMemo(() => {
    return courses;
  }, [courses]);

  // Filter and shuffle questions based on mode/role/section/course/department
  const questionsToRun = useMemo(() => {
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
    
    // Shuffle the array (Fisher-Yates)
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    return list;
  }, [allQuestions, targetSectionId, targetCourseId, selectedRole, selectedDepartment, quizAttempt]);

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
      if (Math.random() < 0.5) {
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

  const handleStartQuiz = () => {
    setUserAnswers({});
    setCurrentIndex(0);
    setQuizSubmitted(false);
    setQuizStarted(true);
    setQuizAttempt((prev) => prev + 1);
    setReaction(null);
    setFinalQuote(null);
  };

  const handleFinishQuiz = () => {
    setQuizSubmitted(true);
    // calculate score
    let correctCount = 0;
    questionsToRun.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const isPassedResult = questionsToRun.length > 0 && ((correctCount / questionsToRun.length) >= 0.8);
    const quoteList = isPassedResult ? SUCCESS_QUOTES : RESILIENCE_QUOTES;
    setFinalQuote(quoteList[Math.floor(Math.random() * quoteList.length)]);

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
      targetSectionId
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
  const isPassed = percentage >= 80;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* 1. Pre-Quiz Setup Screen */}
      {!quizStarted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5 shadow-xs border border-blue-100">
            <Award className="w-8 h-8" />
          </div>

          <h2 id="quiz-main-title" className="text-2xl sm:text-3xl font-bold text-slate-900">
            Перевірка знань
          </h2>
          <p id="quiz-main-description" className="text-slate-600 mt-2 max-w-xl mx-auto text-sm sm:text-base">
            Тести складені на основі внутрішніх реагламентів і інструкцій компанії ТОВ Віатек. Закріпіть навички і порядки дій.
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
                  {departments.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
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
                {targetSectionId && (
                  <optgroup label="Окремий розділ">
                    <option value={`section_${targetSectionId}`}>Обраний розділ</option>
                  </optgroup>
                )}
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
            <button
              onClick={handleStartQuiz}
              id="btn-start-quiz-now"
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            >
              <span>Розпочати тестування ({questionsToRun.length} питань)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onBackToManual}
              className="w-full sm:w-auto px-5 py-3 text-slate-600 hover:text-slate-900 font-semibold text-xs transition"
            >
              Повернутися до читання інструкції
            </button>
          </div>
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
              <span className="text-xs text-slate-500 font-bold">
                Відповідей: {answeredCount}/{totalCount}
              </span>
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

            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {currentQ.question}
            </h3>

            {/* Options List */}
            <div className="mt-6 space-y-3">
              {currentQ.options.map((option, optIdx) => {
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
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border ${
              isPassed 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
              {isPassed ? <Award className="w-10 h-10" /> : <HelpCircle className="w-10 h-10" />}
            </div>

            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
              isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {isPassed ? 'Тест успішно складено' : 'Потрібне повторне вивчення'}
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Ваш результат: {percentage}% ({correctCount} з {totalCount})
            </h2>
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

              <button
                onClick={onBackToManual}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              >
                <FileText className="w-4 h-4" />
                <span>Повернутися до порталу</span>
              </button>
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
