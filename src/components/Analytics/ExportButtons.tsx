import React from 'react';
import { FileDown } from 'lucide-react';
import { ReportFilters } from './types';

interface ExportButtonsProps {
  report: 'coverage' | 'acknowledgements' | 'test-results' | 'certificates';
  filters: ReportFilters;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ report, filters }) => {
  const buildUrl = (format: 'xlsx' | 'csv') => {
    const params = new URLSearchParams({ report, format });
    if (filters.departmentId) params.set('departmentId', filters.departmentId);
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    return `/api/v2/analytics/export?${params.toString()}`;
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.open(buildUrl('xlsx'), '_blank')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
      >
        <FileDown className="w-3.5 h-3.5" /> XLSX
      </button>
      <button
        onClick={() => window.open(buildUrl('csv'), '_blank')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition"
      >
        <FileDown className="w-3.5 h-3.5" /> CSV
      </button>
    </div>
  );
};
