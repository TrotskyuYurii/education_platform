import React, { useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, Award, FileBadge, Library } from 'lucide-react';
import { CoverageReport } from './CoverageReport';
import { AcknowledgementsReport } from './AcknowledgementsReport';
import { TestResultsReport } from './TestResultsReport';
import { CertificatesReport } from './CertificatesReport';
import { ContentReport } from './ContentReport';

type ReportTab = 'coverage' | 'acknowledgements' | 'test-results' | 'certificates' | 'content';

interface AnalyticsReportsProps {
  courses: { id: string; title: string }[];
}

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: 'coverage', label: 'Покриття навчанням', icon: BookOpen },
  { key: 'acknowledgements', label: 'Ознайомлення', icon: CheckCircle2 },
  { key: 'test-results', label: 'Тестування', icon: Award },
  { key: 'certificates', label: 'Сертифікати', icon: FileBadge },
  { key: 'content', label: 'Контент', icon: Library }
];

export const AnalyticsReports: React.FC<AnalyticsReportsProps> = ({ courses }) => {
  const [activeReport, setActiveReport] = useState<ReportTab>('coverage');

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" /> Аналітика та звіти
        </h3>
        <p className="text-sm text-slate-500 mt-1">Дані враховують ваш рівень доступу — керівник бачить лише свою команду.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveReport(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                activeReport === tab.key ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeReport === 'coverage' && <CoverageReport />}
      {activeReport === 'acknowledgements' && <AcknowledgementsReport />}
      {activeReport === 'test-results' && <TestResultsReport courses={courses} />}
      {activeReport === 'certificates' && <CertificatesReport courses={courses} />}
      {activeReport === 'content' && <ContentReport />}
    </div>
  );
};
