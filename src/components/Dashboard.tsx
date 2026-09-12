import React, { useMemo, useState } from 'react';
import { UserProgress, InstructionSection } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Award, Target, BookOpen, Clock, AlertTriangle, FileCheck } from 'lucide-react';
import { CertificateView } from './CertificateView';

interface DashboardProps {
  progress: UserProgress;
  sections: InstructionSection[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

export const Dashboard: React.FC<DashboardProps> = ({ progress, sections }) => {
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);

  // Aggregate data for average score by department
  const scoreByDept = useMemo(() => {
    const deps: Record<string, { totalScore: number; count: number }> = {};
    progress.quizHistory.forEach(history => {
      // If history has department, use it. Otherwise, look it up by section/course if we can (fallback).
      let dep = history.department || 'Загальний';
      if (dep === 'Загальний' && history.courseId) {
        const matchingSection = sections.find(s => s.courseId === history.courseId);
        if (matchingSection?.department) {
          dep = matchingSection.department;
        }
      }
      if (!deps[dep]) deps[dep] = { totalScore: 0, count: 0 };
      deps[dep].totalScore += history.percentage;
      deps[dep].count += 1;
    });
    return Object.entries(deps).map(([name, data]) => ({
      name,
      avgScore: Math.round(data.totalScore / data.count),
      testsTaken: data.count
    })).sort((a, b) => b.testsTaken - a.testsTaken); // Sort by most taken tests
  }, [progress.quizHistory, sections]);

  const readProgress = useMemo(() => {
    const totalSections = sections.length;
    const readSections = Math.min(progress.readSectionIds.length, totalSections);
    return {
      read: readSections,
      unread: totalSections - readSections,
      percentage: totalSections > 0 ? Math.round((readSections / totalSections) * 100) : 0
    };
  }, [progress.readSectionIds, sections]);

  const certificates = progress.certificates || [];
  
  // Calculate expiration states
  const now = new Date();
  const warningDays = 30; // Warn if expiring in 30 days
  
  const pieData = [
    { name: 'Опрацьовано', value: readProgress.read },
    { name: 'Залишилось', value: readProgress.unread }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {selectedCertificate && (
        <CertificateView 
          certificate={selectedCertificate} 
          employeeInfo={progress.employeeInfo}
          onClose={() => setSelectedCertificate(null)}
        />
      )}
      
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Аналітика та Прогрес</h2>
        <p className="text-slate-500 mt-1">Відслідковуйте власну успішність та активність</p>
      </div>

      {/* Certificates Section */}
      {certificates.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-purple-600" /> 
            Ваші сертифікати
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certificates.map((cert: any, idx: number) => {
              const expDate = new Date(cert.expiresAt);
              const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
              const isWarning = daysLeft <= warningDays && daysLeft > 0;
              const isExpired = daysLeft <= 0;

              return (
                <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md transition group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800 pr-4">{cert.courseTitle}</h4>
                    {isExpired ? (
                      <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg shrink-0" title="Прострочено">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    ) : isWarning ? (
                      <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shrink-0" title={`Спливає через ${daysLeft} дн.`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm text-slate-500 space-y-1 mb-4">
                    <p>Отримано: {new Date(cert.issuedAt).toLocaleDateString('uk-UA')}</p>
                    <p className={isExpired ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-600 font-bold' : ''}>
                      Дійсний до: {expDate.toLocaleDateString('uk-UA')}
                    </p>
                  </div>

                  {isExpired || isWarning ? (
                    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 mb-4">
                      {isExpired ? 'Сертифікат недійсний. Будь ласка, пройдіть курс повторно.' : 'Термін дії сертифіката скоро спливає. Рекомендуємо повторити курс.'}
                    </div>
                  ) : null}

                  <button 
                    onClick={() => setSelectedCertificate(cert)}
                    className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Переглянути
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Найкращий бал</p>
            <p className="text-2xl font-bold text-slate-900">{progress.bestScore}%</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Завершено тестів</p>
            <p className="text-2xl font-bold text-slate-900">{progress.quizHistory.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Прочитано інструкцій</p>
            <p className="text-2xl font-bold text-slate-900">{readProgress.read} / {sections.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Всього відповідей</p>
            <p className="text-2xl font-bold text-slate-900">{progress.totalQuestionsAnswered}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Charts: Avg score by department */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900 mb-6">Середній бал за підрозділами (%)</h3>
          {scoreByDept.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreByDept} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="avgScore" name="Середній бал" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
              Немає даних для відображення
            </div>
          )}
        </div>

        {/* Charts: Progress Donut */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-6">Прогрес читання інструкцій</h3>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f1f5f9" />
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-slate-900">{readProgress.percentage}%</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Опрацьовано</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
