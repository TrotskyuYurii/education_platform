import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BookOpen, Loader2 } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { ExportButtons } from './ExportButtons';
import { CoverageRow, ReportFilters } from './types';

export const CoverageReport: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [totals, setTotals] = useState<CoverageRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    fetch(`/api/v2/analytics/coverage?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setRows(data.rows || []); setTotals(data.totals); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [filters]);

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} onChange={setFilters} showDateRange />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Завантаження...</div>
      ) : rows.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
          <BookOpen className="w-8 h-8 text-slate-300 mb-2" /> Немає призначень навчання за обраними фільтрами
        </div>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Всього', value: totals.total, color: 'text-slate-900' },
                { label: 'Призначено', value: totals.assigned, color: 'text-blue-600' },
                { label: 'У процесі', value: totals.inProgress, color: 'text-amber-600' },
                { label: 'Завершено', value: totals.completed, color: 'text-emerald-600' },
                { label: 'Прострочено', value: totals.overdue, color: 'text-rose-600' }
              ].map(kpi => (
                <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-900">Покриття навчанням по підрозділах</h3>
              <ExportButtons report="coverage" filters={filters} />
            </div>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="department" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="completed" name="Завершено" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="inProgress" name="У процесі" stackId="a" fill="#f59e0b" maxBarSize={50} />
                  <Bar dataKey="assigned" name="Призначено" stackId="a" fill="#3b82f6" maxBarSize={50} />
                  <Bar dataKey="overdue" name="Прострочено" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Підрозділ</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Всього</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Завершено</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">Прострочено</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-right">% виконання</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.department} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{r.department}</td>
                    <td className="py-3 px-4 text-sm text-right text-slate-600">{r.total}</td>
                    <td className="py-3 px-4 text-sm text-right text-emerald-600 font-medium">{r.completed}</td>
                    <td className="py-3 px-4 text-sm text-right text-rose-600 font-medium">{r.overdue}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-slate-900">{r.complianceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
