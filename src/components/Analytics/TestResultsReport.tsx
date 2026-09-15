import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Award, Loader2 } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { ExportButtons } from './ExportButtons';
import { TestResultsData, ReportFilters } from './types';

interface TestResultsReportProps {
  courses: { id: string; title: string }[];
}

const RANGE_COLORS: Record<string, string> = { '0-59%': '#f43f5e', '60-79%': '#f59e0b', '80-100%': '#10b981' };

export const TestResultsReport: React.FC<TestResultsReportProps> = ({ courses }) => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [data, setData] = useState<TestResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    fetch(`/api/v2/analytics/test-results?${params.toString()}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [filters]);

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} onChange={setFilters} courses={courses} showCourse showDateRange />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Завантаження...</div>
      ) : !data || data.totalAttempts === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
          <Award className="w-8 h-8 text-slate-300 mb-2" /> Немає спроб тестування за обраними фільтрами
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{data.avgScore}%</div>
              <div className="text-xs text-slate-500 mt-1">Середній бал</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{data.passRate}%</div>
              <div className="text-xs text-slate-500 mt-1">Складено успішно</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{data.totalAttempts}</div>
              <div className="text-xs text-slate-500 mt-1">Всього спроб</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-900">Розподіл результатів</h3>
              <ExportButtons report="test-results" filters={filters} />
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.distribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: any) => [v, 'Спроб']} />
                  <Bar dataKey="count" name="Кількість спроб" radius={[4, 4, 0, 0]} maxBarSize={80}>
                    {data.distribution.map((d, i) => (
                      <Cell key={i} fill={RANGE_COLORS[d.range] || '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-xs text-slate-400 italic">
            Виявлення найпроблемніших окремих питань (&gt;50% помилок) поки недоступне — це вимагає зберігати відповідь на кожне питання окремо, а не лише підсумковий бал.
          </p>
        </>
      )}
    </div>
  );
};
