import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { ExportButtons } from './ExportButtons';
import { AcknowledgementRow, ReportFilters } from './types';

export const AcknowledgementsReport: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [rows, setRows] = useState<AcknowledgementRow[]>([]);
  const [totals, setTotals] = useState<AcknowledgementRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    fetch(`/api/v2/analytics/acknowledgements?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setRows(data.rows || []); setTotals(data.totals); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [filters]);

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} onChange={setFilters} />

      <p className="text-xs text-slate-400 italic">
        Показник ґрунтується на загальному підтвердженні внутрішніх правил (без розрізу по конкретному документу — цей рівень деталізації додасться разом із Кроком 6).
      </p>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Завантаження...</div>
      ) : rows.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-white">
          <CheckCircle2 className="w-8 h-8 text-slate-300 mb-2" /> Немає даних за обраними фільтрами
        </div>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{totals.total}</div>
                <div className="text-xs text-slate-500 mt-1">Всього співробітників</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{totals.signed}</div>
                <div className="text-xs text-slate-500 mt-1">Підписали</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-rose-600">{totals.unsigned}</div>
                <div className="text-xs text-slate-500 mt-1">Не підписали</div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-slate-900">% підписання правил по підрозділах</h3>
              <ExportButtons report="acknowledgements" filters={filters} />
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="department" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value}%`, '% підписали']}
                  />
                  <Bar dataKey="percentSigned" name="% підписали" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
