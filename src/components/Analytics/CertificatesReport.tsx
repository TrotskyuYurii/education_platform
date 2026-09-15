import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Award, Loader2, AlertTriangle } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { ExportButtons } from './ExportButtons';
import { CertificatesData, ReportFilters } from './types';

interface CertificatesReportProps {
  courses: { id: string; title: string }[];
}

export const CertificatesReport: React.FC<CertificatesReportProps> = ({ courses }) => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [data, setData] = useState<CertificatesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.courseId) params.set('courseId', filters.courseId);
    fetch(`/api/v2/analytics/certificates?${params.toString()}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [filters]);

  const pieData = data ? [
    { name: 'Активні', value: data.active, color: '#10b981' },
    { name: 'Анульовані', value: data.revoked, color: '#94a3b8' }
  ] : [];

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} onChange={setFilters} courses={courses} showCourse />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Завантаження...</div>
      ) : !data ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
          <Award className="w-8 h-8 text-slate-300 mb-2" /> Немає даних
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{data.active}</div>
              <div className="text-xs text-slate-500 mt-1">Активні</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{data.expiringIn30}</div>
              <div className="text-xs text-slate-500 mt-1">Спливають ≤30 дн</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{data.expiringIn90}</div>
              <div className="text-xs text-slate-500 mt-1">Спливають ≤90 дн</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-slate-400">{data.revoked}</div>
              <div className="text-xs text-slate-500 mt-1">Анульовані</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4">Активні / анульовані</h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Спливають найближчим часом
                </h3>
                <ExportButtons report="certificates" filters={filters} />
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {data.expiringSoon.length === 0 ? (
                  <p className="text-sm text-slate-400 p-6 text-center">Немає сертифікатів, що спливають найближчим часом</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 sticky top-0 bg-white">
                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase">Співробітник</th>
                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase">Курс</th>
                        <th className="py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Днів</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.expiringSoon.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 text-sm font-medium text-slate-900">{c.fullName || c.email}</td>
                          <td className="py-2.5 px-4 text-sm text-slate-600">{c.courseTitle}</td>
                          <td className={`py-2.5 px-4 text-sm text-right font-semibold ${c.daysLeft <= 30 ? 'text-rose-600' : c.daysLeft <= 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {c.daysLeft}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
