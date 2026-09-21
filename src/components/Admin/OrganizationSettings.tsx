import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, MapPin, Briefcase, Building2, Lock, AlertCircle } from 'lucide-react';
import { DEFAULT_DEPARTMENT } from '../../../shared/departments';

interface Department {
  _id: string;
  name: string;
  code?: string;
  isActive: boolean;
  order: number;
  /** «Всі підрозділи»: створюється системою, редагування й видалення заблоковані. */
  isSystem?: boolean;
}

interface Position {
  _id: string;
  title: string;
  departmentId?: string | { _id: string, name: string };
  grade?: string;
  isActive: boolean;
}

interface Location {
  _id: string;
  name: string;
  city?: string;
  country?: string;
  timezone?: string;
  isActive: boolean;
}

export const OrganizationSettings = () => {
  const [activeSubTab, setActiveSubTab] = useState<'departments' | 'positions' | 'locations'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // State for forms
  const [editingId, setEditingId] = useState<string | null>(null);
  // Сервер відхиляє зміни системного підрозділу — показуємо причину, а не мовчимо.
  const [error, setError] = useState<string | null>(null);

  const [depForm, setDepForm] = useState({ name: '', code: '', order: 0, isActive: true });
  const [posForm, setPosForm] = useState({ title: '', departmentId: '', grade: '', isActive: true });
  const [locForm, setLocForm] = useState({ name: '', city: '', country: '', timezone: '', isActive: true });

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    try {
      if (activeSubTab === 'departments') {
        const res = await fetch('/api/v2/org/departments');
        setDepartments(await res.json());
      } else if (activeSubTab === 'positions') {
        const res = await fetch('/api/v2/org/positions');
        setPositions(await res.json());
      } else if (activeSubTab === 'locations') {
        const res = await fetch('/api/v2/org/locations');
        setLocations(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const url = editingId ? `/api/v2/org/departments/${editingId}` : '/api/v2/org/departments';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depForm)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Не вдалося зберегти підрозділ');
        return;
      }
      setEditingId(null);
      setDepForm({ name: '', code: '', order: 0, isActive: true });
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Помилка мережі при збереженні підрозділу');
    }
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/v2/org/positions/${editingId}` : '/api/v2/org/positions';
      const method = editingId ? 'PATCH' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posForm)
      });
      setEditingId(null);
      setPosForm({ title: '', departmentId: '', grade: '', isActive: true });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/v2/org/locations/${editingId}` : '/api/v2/org/locations';
      const method = editingId ? 'PATCH' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locForm)
      });
      setEditingId(null);
      setLocForm({ name: '', city: '', country: '', timezone: '', isActive: true });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!window.confirm('Видалити цей запис?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/v2/org/${type}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Не вдалося видалити запис');
        return;
      }
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Помилка мережі при видаленні запису');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-900">Організаційна структура</h3>
        <p className="text-sm text-slate-500 mt-1">
          Керування підрозділами, посадами та локаціями.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { setActiveSubTab('departments'); setEditingId(null); setError(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'departments' ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
        >
          <Building2 className="w-4 h-4 inline-block mr-2" /> Підрозділи
        </button>
        <button
          onClick={() => { setActiveSubTab('positions'); setEditingId(null); setError(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'positions' ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
        >
          <Briefcase className="w-4 h-4 inline-block mr-2" /> Посади
        </button>
        <button
          onClick={() => { setActiveSubTab('locations'); setEditingId(null); setError(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'locations' ? 'bg-purple-100 text-purple-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
        >
          <MapPin className="w-4 h-4 inline-block mr-2" /> Локації
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeSubTab === 'departments' && (
          <div className="space-y-6">
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
              Перелік підрозділів ведеться лише тут. Завантаження інструкцій нових підрозділів не створює: ШІ обирає
              підрозділ із цього списку, а якщо впевненого збігу немає — відносить матеріал до «{DEFAULT_DEPARTMENT}».
            </p>

            <form onSubmit={handleSaveDepartment} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Назва підрозділу</label>
                <input required type="text" value={depForm.name} onChange={e => setDepForm({...depForm, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Код</label>
                <input type="text" value={depForm.code} onChange={e => setDepForm({...depForm, code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium whitespace-nowrap">
                {editingId ? 'Зберегти' : 'Додати'}
              </button>
              {editingId && <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Скасувати</button>}
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700">Назва</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700">Код</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map(d => (
                    <tr key={d._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {d.name}
                          {d.isSystem && (
                            <span
                              title="Системний запис: до нього потрапляють матеріали без прив'язки до конкретного підрозділу"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide"
                            >
                              <Lock className="w-3 h-3" />
                              Системний
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">{d.code || '-'}</td>
                      <td className="py-3 px-4 text-sm text-right space-x-2">
                        {d.isSystem ? (
                          <span className="text-xs text-slate-400">Недоступно для змін</span>
                        ) : (
                          <>
                            <button onClick={() => { setError(null); setEditingId(d._id); setDepForm({ name: d.name, code: d.code || '', order: d.order, isActive: d.isActive }); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete('departments', d._id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'positions' && (
          <div className="space-y-6">
            <form onSubmit={handleSavePosition} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Назва посади</label>
                <input required type="text" value={posForm.title} onChange={e => setPosForm({...posForm, title: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
              </div>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium whitespace-nowrap">
                {editingId ? 'Зберегти' : 'Додати'}
              </button>
              {editingId && <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Скасувати</button>}
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700">Назва посади</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.map(p => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">{p.title}</td>
                      <td className="py-3 px-4 text-sm text-right space-x-2">
                        <button onClick={() => { setEditingId(p._id); setPosForm({ title: p.title, departmentId: typeof p.departmentId === 'string' ? p.departmentId : (p.departmentId?._id || ''), grade: p.grade || '', isActive: p.isActive }); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete('positions', p._id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'locations' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveLocation} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Назва локації</label>
                <input required type="text" value={locForm.name} onChange={e => setLocForm({...locForm, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Місто</label>
                <input type="text" value={locForm.city} onChange={e => setLocForm({...locForm, city: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
              </div>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium whitespace-nowrap">
                {editingId ? 'Зберегти' : 'Додати'}
              </button>
              {editingId && <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Скасувати</button>}
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700">Назва локації</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700">Місто</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-700 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locations.map(l => (
                    <tr key={l._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">{l.name}</td>
                      <td className="py-3 px-4 text-sm text-slate-500">{l.city || '-'}</td>
                      <td className="py-3 px-4 text-sm text-right space-x-2">
                        <button onClick={() => { setEditingId(l._id); setLocForm({ name: l.name, city: l.city || '', country: l.country || '', timezone: l.timezone || '', isActive: l.isActive }); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete('locations', l._id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
