import React, { useEffect, useState } from 'react';
import { ReportFilters } from './types';

interface OrgDept { _id: string; name: string; }

interface FilterBarProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  courses?: { id: string; title: string }[];
  showCourse?: boolean;
  showDateRange?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, courses = [], showCourse, showDateRange }) => {
  const [departments, setDepartments] = useState<OrgDept[]>([]);

  useEffect(() => {
    fetch('/api/v2/org/departments')
      .then(r => r.json())
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-wrap gap-3 items-end bg-white rounded-2xl border border-slate-200 p-4">
      <div className="min-w-[180px]">
        <label className="block text-xs font-semibold text-slate-500 mb-1">Підрозділ</label>
        <select
          value={filters.departmentId || ''}
          onChange={e => onChange({ ...filters, departmentId: e.target.value || undefined })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Усі підрозділи</option>
          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>

      {showCourse && (
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Курс</label>
          <select
            value={filters.courseId || ''}
            onChange={e => onChange({ ...filters, courseId: e.target.value || undefined })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Усі курси</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}

      {showDateRange && (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Період з</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={e => onChange({ ...filters, dateFrom: e.target.value || undefined })}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">по</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={e => onChange({ ...filters, dateTo: e.target.value || undefined })}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </>
      )}

      {(filters.departmentId || filters.courseId || filters.dateFrom || filters.dateTo) && (
        <button
          onClick={() => onChange({})}
          className="text-xs text-purple-600 hover:underline font-medium pb-2.5"
        >
          Скинути фільтри
        </button>
      )}
    </div>
  );
};
