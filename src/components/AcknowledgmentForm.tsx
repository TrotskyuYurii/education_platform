import React, { useState } from 'react';
import { UserProgress } from '../types';
import { INSTRUCTION_DOCUMENT_META } from '../data/instructionData';
import {
  CheckCircle2,
  Award,
  Printer,
  FileCheck,
  UserCheck,
  Building2,
  Calendar,
  Briefcase,
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface AcknowledgmentFormProps {
  progress: UserProgress;
  onSaveProfile: (profile: UserProgress['employeeInfo']) => Promise<void>;
  onNavigateToQuiz: () => void;
}

export const AcknowledgmentForm: React.FC<AcknowledgmentFormProps> = ({
  progress,
  onSaveProfile,
  onNavigateToQuiz,
}) => {
  const [fullName, setFullName] = useState(progress.employeeInfo.fullName || '');
  const [position, setPosition] = useState(progress.employeeInfo.position || '');
  const [department, setDepartment] = useState(progress.employeeInfo.department || '');
  const [isSavedLocally, setIsSavedLocally] = useState(progress.employeeInfo.isSigned);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const bestScore = progress.bestScore;
  const isPassed = bestScore !== null && bestScore >= 80;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !isPassed || isSaving) return;

    const todayStr = new Date().toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    setSaveError(null);
    setIsSaving(true);
    try {
      await onSaveProfile({
        fullName,
        position,
        department,
        signedDate: todayStr,
        isSigned: true,
      });
      setIsSavedLocally(true);
    } catch (err: any) {
      setSaveError(err?.message || 'Не вдалося зберегти підпис. Спробуйте ще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2.5 py-0.5 rounded-full">
                Профіль користувача
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Мої дані та згода
              </h2>
            </div>
          </div>

          {isSavedLocally && (
            <button
              onClick={handlePrint}
              id="btn-print-certificate"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Друк протоколу</span>
            </button>
          )}
        </div>
      </div>

      {/* Form / Signature Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-8 print:border-none print:shadow-none print:p-0">
        
        {/* Printable Official Header */}
        <div className="border-b-2 border-slate-900 pb-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-500 mb-2">
            <span>{INSTRUCTION_DOCUMENT_META.company}</span>
            <span>{INSTRUCTION_DOCUMENT_META.system} · {INSTRUCTION_DOCUMENT_META.date}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide">
            Лист ознайомлення з регламентом
          </h1>
          <p className="text-sm font-semibold text-slate-700 mt-1">
            «{INSTRUCTION_DOCUMENT_META.title}»
          </p>
        </div>

        {/* Qualification Status Box */}
        <div className="p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Результат кваліфікаційного тестування
              </p>
              <p className="text-base font-extrabold text-slate-900">
                {bestScore !== null ? `${bestScore}% успішних відповідей` : 'Тест ще не пройдено'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isPassed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Атестацію підтверджено</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onNavigateToQuiz}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition print:hidden"
              >
                <span>Пройти тест для допуску</span>
              </button>
            )}
          </div>
        </div>

        {/* Form Inputs (editable when not signed, or viewable after) */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                Прізвище, ім’я та по батькові працівника:
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="наприклад: Шевченко Тарас Григорович"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                Посада:
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="наприклад: Старший касир"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                Підрозділ / Магазин / Каса:
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="наприклад: Відділ роздрібних продажів №2"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                Дата ознайомлення:
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  value={progress.employeeInfo.signedDate || new Date().toLocaleDateString('uk-UA')}
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Legal / Company Consent Statement */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
            <p className="font-semibold text-slate-900 mb-1">
              Підтвердження співробітника:
            </p>
            Я підтверджую, що в повному обсязі ознайомлений(а) з усіма необхідними корпоративними інструкціями та регламентами компанії ТОВ «ВІАТЕК», які закріплені за моєю посадою. Зобов’язуюся неухильно дотримуватися цих регламентів у своїй щоденній роботі та нести відповідальність за їх порушення.
          </div>

          {/* Signature Badge Block */}
          {isSavedLocally ? (
            <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-emerald-950">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold">
                    Підпис зареєстровано в системі
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Співробітник: {fullName} · {position}
                  </p>
                  {progress.employeeInfo.signatureHash && (
                    <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                      Електронний відбиток: {progress.employeeInfo.signatureHash.slice(0, 16).toUpperCase()} · Дата: {progress.employeeInfo.signedDate || 'Сьогодні'}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSavedLocally(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline print:hidden"
              >
                Змінити дані
              </button>
            </div>
          ) : !isPassed ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Підпис буде доступний після успішного складання атестаційного тесту (мінімум 80%).</span>
              </div>
              <button
                type="button"
                onClick={onNavigateToQuiz}
                className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition"
              >
                Пройти тест
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {saveError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  id="btn-sign-regulation"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSaving ? 'Збереження...' : 'Підтвердити ознайомлення (Підписати лист)'}</span>
                </button>
              </div>
            </div>
          )}

        </form>

        {/* Printable Signature Table identical to page 9 of PDF */}
        <div className="hidden print:block pt-8 mt-12 border-t border-slate-300">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4 text-center">
            О З Н А Й О М Л Е Н Н Я (Журнал обліку)
          </p>
          <table className="w-full text-left text-xs border border-slate-400">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400">
                <th className="p-2 border-r border-slate-400">Прізвище, ім’я</th>
                <th className="p-2 border-r border-slate-400">Посада</th>
                <th className="p-2 border-r border-slate-400">Дата</th>
                <th className="p-2">Підпис</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border-r border-slate-400 font-semibold">{fullName || '____________________'}</td>
                <td className="p-3 border-r border-slate-400">{position || '____________________'}</td>
                <td className="p-3 border-r border-slate-400">{progress.employeeInfo.signedDate || '____.__.2026'}</td>
                <td className="p-3 font-mono font-bold text-emerald-800">[Підписано електронно]</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};
