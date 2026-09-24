import React, { useRef, useState } from 'react';
import { CaseSimulation, InstructionSection } from '../types';
import { 
  Briefcase, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  ArrowRight, 
  RotateCcw,
  BookOpen
} from 'lucide-react';

/** Підсумок проходження: скільки кейсів розв'язано правильно з першої спроби. */
export interface CaseRunResult {
  score: number;
  total: number;
  caseIds: string[];
  startedAt: string;
  durationSec: number;
}

interface CaseSimulatorProps {
  cases: CaseSimulation[];
  /** Інструкції — щоб показати, до якого регламенту належить кейс. */
  sections?: InstructionSection[];
  onFinishCases?: () => void;
  /** Викликається один раз, коли співробітник дійшов до кінця серії кейсів. */
  onRecordResult?: (result: CaseRunResult) => void;
  startAsList?: boolean;
}

export const CaseSimulator: React.FC<CaseSimulatorProps> = ({
  cases,
  sections = [],
  onFinishCases,
  onRecordResult,
  startAsList = false
}) => {
  const [activeCaseIndex, setActiveCaseIndex] = useState<number>(startAsList ? -1 : 0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  // Відповіді поточної серії: id кейсу → чи правильно з першої спроби.
  const answersRef = useRef<Map<string, boolean>>(new Map());
  const startedAtRef = useRef<Date>(new Date());

  const currentCase = activeCaseIndex >= 0 ? cases[activeCaseIndex] : null;
  const chosenOption = currentCase?.options.find((o) => o.id === selectedOptionId);
  const currentSection = currentCase?.sectionId ? sections.find(s => s.id === currentCase.sectionId) : undefined;

  const startSeries = (index: number) => {
    answersRef.current = new Map();
    startedAtRef.current = new Date();
    setSelectedOptionId(null);
    setActiveCaseIndex(index);
  };

  const handleSelectOption = (optionId: string) => {
    if (selectedOptionId || !currentCase) return;
    setSelectedOptionId(optionId);
    const option = currentCase.options.find(o => o.id === optionId);
    answersRef.current.set(currentCase.id, Boolean(option?.isCorrect));
  };

  const recordResult = () => {
    const answers = answersRef.current;
    if (!onRecordResult || answers.size === 0) return;
    const finishedAt = new Date();
    onRecordResult({
      score: Array.from(answers.values()).filter(Boolean).length,
      total: answers.size,
      caseIds: Array.from(answers.keys()),
      startedAt: startedAtRef.current.toISOString(),
      durationSec: Math.max(0, Math.round((finishedAt.getTime() - startedAtRef.current.getTime()) / 1000))
    });
    answersRef.current = new Map();
  };

  const handleNextCase = () => {
    setSelectedOptionId(null);
    if (activeCaseIndex < cases.length - 1) {
      setActiveCaseIndex((prev) => prev + 1);
      return;
    }
    recordResult();
    if (startAsList) {
      // Із каталогу повертаємось до каталогу, а не до інструкцій
      setActiveCaseIndex(-1);
    } else if (onFinishCases) {
      onFinishCases();
    }
  };

  const handleReset = () => {
    if (startAsList) setActiveCaseIndex(-1);
    else startSeries(0);
    answersRef.current = new Map();
    setSelectedOptionId(null);
  };

  if (!cases || cases.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 mx-auto mb-4 flex items-center justify-center">
          <Briefcase className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Кейси відсутні</h2>
        <p className="text-slate-500 text-sm">
          Наразі в системі немає активних кейсів для тестування.
        </p>
      </div>
    );
  }

  if (activeCaseIndex === -1) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Каталог практичних кейсів</h2>
              <p className="text-slate-500 text-sm mt-1">Оберіть кейс для тренування практичних навичок.</p>
            </div>
          </div>
          <div className="grid gap-4">
            {cases.map((c, idx) => (
              <button
                key={c.id}
                onClick={() => startSeries(idx)}
                className="text-left flex flex-col sm:flex-row gap-4 p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                      Кейс {idx + 1}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{c.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{c.scenario}</p>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                    Почати симуляцію
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentCase) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2.5 py-0.5 rounded-full">
                  Інтерактивний тренажер
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Кейс {activeCaseIndex + 1} з {cases.length}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Симулятор робочих ситуацій
              </h2>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Почати спочатку</span>
          </button>
        </div>
      </div>

      {/* Case Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        
        <div className="border-b border-slate-100 pb-4">
          {currentSection && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                <BookOpen className="w-3.5 h-3.5" />
                {currentSection.title}
                {currentSection.department && <span className="text-blue-500 font-normal">· {currentSection.department}</span>}
              </span>
            </div>
          )}
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            {currentCase.title}
          </h3>
        </div>

        {/* Narrative Description */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed">
          <p className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-1">
            Опис обставин:
          </p>
          {currentCase.scenario}
        </div>

        {/* Decision Options */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Оберіть Ваші професійні дії:
          </h4>

          <div className="space-y-3">
            {(currentCase.options || []).map((opt) => {
              const isSelected = selectedOptionId === opt.id;

              let style = 'border-slate-200 hover:border-blue-400 bg-white text-slate-800';
              if (selectedOptionId) {
                if (opt.isCorrect) {
                  style = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20';
                } else if (isSelected) {
                  style = 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20';
                } else {
                  style = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                }
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={selectedOptionId !== null}
                  className={`w-full text-left p-4 rounded-xl border transition flex items-start justify-between gap-3 ${style}`}
                >
                  <span className="text-xs sm:text-sm font-medium leading-relaxed grow">
                    {opt.text}
                  </span>

                  {selectedOptionId && opt.isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {selectedOptionId && isSelected && !opt.isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback & Legal consequence breakdown */}
        {chosenOption && (
          <div className={`p-5 rounded-xl border ${
            chosenOption.isCorrect 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
              {chosenOption.isCorrect ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Правильне рішення згідно з регламентом!</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <span>Помилкове рішення! Порушення регламенту:</span>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm leading-relaxed mb-3">
              {chosenOption.feedback}
            </p>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleNextCase}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <span>
                  {activeCaseIndex < cases.length - 1 ? 'Наступний кейс' : 'Завершити тренажер'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
