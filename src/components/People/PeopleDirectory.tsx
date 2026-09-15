import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Users, Network, UserRound, X } from 'lucide-react';
import { PeopleListItem, OrgChartNode, OrgDictionaryItem } from './types';
import { EmployeeCard } from './EmployeeCard';
import { OrgChart } from './OrgChart';

interface PeopleDirectoryProps {
  onViewAnalytics?: (userId: string) => void;
}

type ViewMode = 'grid' | 'tree';

export const PeopleDirectory: React.FC<PeopleDirectoryProps> = ({ onViewAnalytics }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [items, setItems] = useState<PeopleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [skip, setSkip] = useState(0);
  const limit = 24;

  const [departments, setDepartments] = useState<OrgDictionaryItem[]>([]);
  const [positions, setPositions] = useState<OrgDictionaryItem[]>([]);
  const [locations, setLocations] = useState<OrgDictionaryItem[]>([]);

  const [orgChartNodes, setOrgChartNodes] = useState<OrgChartNode[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => { setSkip(0); setQ(searchInput); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    Promise.all([
      fetch('/api/v2/org/departments').then(r => r.json()).catch(() => []),
      fetch('/api/v2/org/positions').then(r => r.json()).catch(() => []),
      fetch('/api/v2/org/locations').then(r => r.json()).catch(() => [])
    ]).then(([deps, poss, locs]) => {
      setDepartments(Array.isArray(deps) ? deps : []);
      setPositions(Array.isArray(poss) ? poss : []);
      setLocations(Array.isArray(locs) ? locs : []);
    });
  }, []);

  const fetchPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (departmentId) params.set('departmentId', departmentId);
      if (positionId) params.set('positionId', positionId);
      if (locationId) params.set('locationId', locationId);
      params.set('limit', String(limit));
      params.set('skip', String(skip));
      const res = await fetch(`/api/v2/people?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      // network error — leave previous list in place
    } finally {
      setIsLoading(false);
    }
  }, [q, departmentId, positionId, locationId, skip]);

  useEffect(() => {
    if (viewMode === 'grid') fetchPeople();
  }, [viewMode, fetchPeople]);

  useEffect(() => {
    if (viewMode === 'tree' && orgChartNodes.length === 0) {
      setIsLoadingChart(true);
      fetch('/api/v2/people/org-chart')
        .then(r => r.json())
        .then(data => setOrgChartNodes(data.items || []))
        .catch(() => {})
        .finally(() => setIsLoadingChart(false));
    }
  }, [viewMode, orgChartNodes.length]);

  const hasFilters = Boolean(q || departmentId || positionId || locationId);
  const resetFilters = () => {
    setSearchInput(''); setQ(''); setDepartmentId(''); setPositionId(''); setLocationId(''); setSkip(0);
  };

  const page = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" /> Люди
          </h1>
          <p className="text-sm text-slate-500 mt-1">Довідник співробітників і оргструктура компанії</p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-xl p-1 self-start">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Список
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              viewMode === 'tree' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Network className="w-4 h-4" /> Оргструктура
          </button>
        </div>
      </div>

      {viewMode === 'grid' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Пошук за ПІБ або email..."
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchInput && (
                <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={departmentId}
                onChange={e => { setDepartmentId(e.target.value); setSkip(0); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Усі підрозділи</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
              <select
                value={positionId}
                onChange={e => { setPositionId(e.target.value); setSkip(0); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Усі посади</option>
                {positions.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
              </select>
              <select
                value={locationId}
                onChange={e => { setLocationId(e.target.value); setSkip(0); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Усі локації</option>
                {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline font-medium">
                Скинути фільтри
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">Завантаження...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {hasFilters ? 'Нікого не знайдено за вашим запитом.' : 'У довіднику ще немає співробітників.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(person => (
                  <button
                    key={person.id}
                    onClick={() => setSelectedEmployeeId(person.id)}
                    className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-xs transition flex items-center gap-3"
                  >
                    <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 overflow-hidden">
                      {person.avatarUrl ? (
                        <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        person.fullName?.charAt(0).toUpperCase() || <UserRound className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{person.fullName || person.email}</div>
                      <div className="text-xs text-slate-500 truncate">{person.position?.title || '—'}</div>
                      <div className="text-xs text-slate-400 truncate">{person.department?.name || ''}</div>
                    </div>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6 text-sm">
                  <button
                    disabled={page <= 1}
                    onClick={() => setSkip(Math.max(0, skip - limit))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Назад
                  </button>
                  <span className="text-slate-500">Сторінка {page} з {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setSkip(skip + limit)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Далі
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {viewMode === 'tree' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          {isLoadingChart ? (
            <div className="text-center py-16 text-slate-400 text-sm">Завантаження оргструктури...</div>
          ) : (
            <OrgChart nodes={orgChartNodes} onSelectEmployee={setSelectedEmployeeId} />
          )}
        </div>
      )}

      {selectedEmployeeId && (
        <EmployeeCard
          userId={selectedEmployeeId}
          departments={departments}
          positions={positions}
          locations={locations}
          onClose={() => setSelectedEmployeeId(null)}
          onViewAnalytics={onViewAnalytics}
        />
      )}
    </div>
  );
};
