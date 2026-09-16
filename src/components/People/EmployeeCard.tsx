import React, { useEffect, useRef, useState } from 'react';
import { X, Mail, Phone, Building2, MapPin, UserRound, Calendar, BarChart3, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useModalA11y } from '../../hooks/useModalA11y';
import { PeopleProfile, OrgDictionaryItem } from './types';

interface EmployeeCardProps {
  userId: string;
  departments: OrgDictionaryItem[];
  positions: OrgDictionaryItem[];
  locations: OrgDictionaryItem[];
  onClose: () => void;
  onViewAnalytics?: (userId: string) => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  userId, departments, positions, locations, onClose, onViewAnalytics
}) => {
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PeopleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Self-service (contacts) form
  const [selfForm, setSelfForm] = useState({ phone: '', avatarUrl: '' });
  const [isSavingSelf, setIsSavingSelf] = useState(false);

  // HR/admin org-fields form (uses the existing admin write endpoint)
  const [orgForm, setOrgForm] = useState({
    positionId: '', departmentId: '', locationId: '', hireDate: '', isActive: true
  });
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isSelf = viewer?.id === userId;
  const isAdmin = Boolean(viewer?.role === 'admin' || viewer?.roleKeys?.includes('admin'));

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/people/${userId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не вдалося завантажити профіль');
        return;
      }
      setProfile(data);
      setSelfForm({ phone: data.phone || '', avatarUrl: data.avatarUrl || '' });
      setOrgForm({
        positionId: data.position?.id || '',
        departmentId: data.department?.id || '',
        locationId: data.location?.id || '',
        hireDate: data.hireDate ? String(data.hireDate).slice(0, 10) : '',
        isActive: data.isActive !== false
      });
    } catch (err) {
      setError('Помилка мережі під час завантаження профілю');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSaveSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSelf(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/v2/people/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selfForm)
      });
      if (res.ok) {
        setSaveMessage('Контакти оновлено');
        await fetchProfile();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveMessage(data.error || 'Не вдалося зберегти контакти');
      }
    } catch {
      setSaveMessage('Помилка мережі під час збереження');
    } finally {
      setIsSavingSelf(false);
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSavingOrg(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          positionId: orgForm.positionId || null,
          departmentId: orgForm.departmentId || null,
          locationId: orgForm.locationId || null,
          hireDate: orgForm.hireDate || null,
          isActive: orgForm.isActive
        })
      });
      if (res.ok) {
        setSaveMessage('Дані співробітника оновлено');
        await fetchProfile();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveMessage(data.error || 'Не вдалося зберегти зміни');
      }
    } catch {
      setSaveMessage('Помилка мережі під час збереження');
    } finally {
      setIsSavingOrg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-card-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Завантаження профілю...
          </div>
        ) : error || !profile ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-600 font-medium mb-3">{error || 'Профіль недоступний'}</p>
            <button onClick={onClose} className="text-sm text-slate-500 hover:underline">Закрити</button>
          </div>
        ) : (
          <>
            <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs overflow-hidden">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    profile.fullName?.charAt(0).toUpperCase() || <UserRound className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 id="employee-card-title" className="font-bold text-slate-900 truncate">{profile.fullName || profile.email}</h3>
                  <p className="text-sm text-slate-500 truncate">{profile.position?.title || 'Посада не вказана'}</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Закрити" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{profile.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-700">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{profile.department?.name || 'Підрозділ не вказано'}</span>
                </div>
                {profile.location && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{profile.location.name}</span>
                  </div>
                )}
                {profile.manager && (
                  <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
                    <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">Керівник: {profile.manager.fullName || profile.manager.email}</span>
                  </div>
                )}
                {profile.canViewFull && profile.hireDate && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">У компанії з {new Date(profile.hireDate).toLocaleDateString('uk-UA')}</span>
                  </div>
                )}
              </div>

              {!profile.canViewFull && (
                <p className="text-xs text-slate-400 italic">
                  Розширені дані (дата найму, результати навчання) доступні лише керівнику, HR або адміністратору.
                </p>
              )}

              {isAdmin && onViewAnalytics && (
                <button
                  onClick={() => onViewAnalytics(userId)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition"
                >
                  <BarChart3 className="w-4 h-4" /> Переглянути повну аналітику навчання
                </button>
              )}

              {saveMessage && (
                <div className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  {saveMessage}
                </div>
              )}

              {isSelf && (
                <form onSubmit={handleSaveSelf} className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Мої контакти</h4>
                  <div>
                    <label htmlFor="ec-phone" className="block text-xs font-semibold text-slate-700 mb-1">Телефон</label>
                    <input
                      id="ec-phone"
                      type="text"
                      value={selfForm.phone}
                      onChange={e => setSelfForm({ ...selfForm, phone: e.target.value })}
                      placeholder="+380..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="ec-avatar" className="block text-xs font-semibold text-slate-700 mb-1">Посилання на фото</label>
                    <input
                      id="ec-avatar"
                      type="text"
                      value={selfForm.avatarUrl}
                      onChange={e => setSelfForm({ ...selfForm, avatarUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingSelf}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
                  >
                    {isSavingSelf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Зберегти контакти
                  </button>
                </form>
              )}

              {profile.canEdit && (
                <form onSubmit={handleSaveOrg} className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Кадрові дані (HR/адмін)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ec-position" className="block text-xs font-semibold text-slate-700 mb-1">Посада</label>
                      <select
                        id="ec-position"
                        value={orgForm.positionId}
                        onChange={e => setOrgForm({ ...orgForm, positionId: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Не обрано</option>
                        {positions.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ec-department" className="block text-xs font-semibold text-slate-700 mb-1">Підрозділ</label>
                      <select
                        id="ec-department"
                        value={orgForm.departmentId}
                        onChange={e => setOrgForm({ ...orgForm, departmentId: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Не обрано</option>
                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ec-location" className="block text-xs font-semibold text-slate-700 mb-1">Локація</label>
                      <select
                        id="ec-location"
                        value={orgForm.locationId}
                        onChange={e => setOrgForm({ ...orgForm, locationId: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Не обрано</option>
                        {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ec-hire-date" className="block text-xs font-semibold text-slate-700 mb-1">Дата найму</label>
                      <input
                        id="ec-hire-date"
                        type="date"
                        value={orgForm.hireDate}
                        onChange={e => setOrgForm({ ...orgForm, hireDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orgForm.isActive}
                      onChange={e => setOrgForm({ ...orgForm, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Активний співробітник
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingOrg}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition disabled:opacity-60"
                  >
                    {isSavingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Зберегти кадрові дані
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
