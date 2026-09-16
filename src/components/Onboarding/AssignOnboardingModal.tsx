import React, { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Loader2, AlertTriangle, CheckCircle2, Search, Users, Building2, Briefcase } from 'lucide-react';
import { OnboardingTemplateSummary } from './types';

interface AssignOnboardingModalProps {
  template: OnboardingTemplateSummary;
  onClose: () => void;
  onAssigned: () => void;
}

type TargetScope = 'single' | 'multiple' | 'department' | 'position';

const SCOPE_OPTIONS: { key: TargetScope; label: string; hint: string; icon: typeof Users }[] = [
  { key: 'single', label: 'Одна людина', hint: 'Типовий випадок для новачка', icon: UserPlus },
  { key: 'multiple', label: 'Кілька людей', hint: 'Групу, що виходить разом', icon: Users },
  { key: 'department', label: 'Підрозділ', hint: 'Усі співробітники відділу', icon: Building2 },
  { key: 'position', label: 'Посада', hint: 'Усі на конкретній посаді', icon: Briefcase }
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export const AssignOnboardingModal: React.FC<AssignOnboardingModalProps> = ({ template, onClose, onAssigned }) => {
  const [scope, setScope] = useState<TargetScope>('single');
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const [userId, setUserId] = useState('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [buddyUserId, setBuddyUserId] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, deptRes, posRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/v2/org/departments'),
          fetch('/api/v2/org/positions')
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }
        // Довідники org повертають масив напряму, без обгортки.
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (posRes.ok) setPositions(await posRes.json());
      } catch {
        setError('Не вдалося завантажити довідники співробітників');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Дата виходу новачка — типово підставляємо його hireDate, бо саме від неї
  // рахуються всі дедлайни кроків.
  useEffect(() => {
    if (scope !== 'single' || !userId) return;
    const selected = users.find(u => (u._id || u.id) === userId);
    if (selected?.hireDate) {
      setStartDate(String(selected.hireDate).slice(0, 10));
    }
  }, [userId, users, scope]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u =>
      (u.fullName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term)
    );
  }, [users, search]);

  const canSubmit = useMemo(() => {
    if (template.requiresBuddy && !buddyUserId) return false;
    if (scope === 'single') return Boolean(userId);
    if (scope === 'multiple') return userIds.length > 0;
    if (scope === 'department') return Boolean(departmentId);
    if (scope === 'position') return Boolean(positionId);
    return false;
  }, [scope, userId, userIds, departmentId, positionId, buddyUserId, template.requiresBuddy]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/onboarding/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          targetScope: scope,
          userId: scope === 'single' ? userId : '',
          userIds: scope === 'multiple' ? userIds : undefined,
          departmentId: scope === 'department' ? departmentId : '',
          positionId: scope === 'position' ? positionId : '',
          startDate,
          buddyUserId: buddyUserId || '',
          notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося призначити онбординг');

      setSuccess(`Онбординг призначено: ${data.count} співробітник(ів). Сповіщення надіслано.`);
      onAssigned();
      setTimeout(onClose, 1600);
    } catch (err: any) {
      setError(err.message || 'Помилка призначення');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition';
  const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">Призначити онбординг</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              «{template.name}» · {template.stepsCount} кроків · {template.durationDays} дн.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1" aria-label="Закрити">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Завантаження...</span>
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Кому призначити</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SCOPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = scope === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setScope(opt.key)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          active
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className={`text-xs font-bold ${active ? 'text-blue-800' : 'text-slate-700'}`}>
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {scope === 'single' && (
                <div>
                  <label className={labelClass}>Співробітник</label>
                  <select value={userId} onChange={e => setUserId(e.target.value)} className={inputClass}>
                    <option value="">— оберіть співробітника —</option>
                    {users.map(u => (
                      <option key={u._id || u.id} value={u._id || u.id}>
                        {u.fullName || u.username || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'multiple' && (
                <div>
                  <label className={labelClass}>Співробітники ({userIds.length} обрано)</label>
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Пошук за ім'ям або email"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {filteredUsers.map(u => {
                      const id = u._id || u.id;
                      const checked = userIds.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setUserIds(prev =>
                              e.target.checked ? [...prev, id] : prev.filter(x => x !== id)
                            )}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                          />
                          <span className="text-sm text-slate-700 truncate">
                            {u.fullName || u.username || u.email}
                          </span>
                        </label>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <div className="px-3 py-6 text-center text-xs text-slate-400">Нікого не знайдено</div>
                    )}
                  </div>
                </div>
              )}

              {scope === 'department' && (
                <div>
                  <label className={labelClass}>Підрозділ</label>
                  <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className={inputClass}>
                    <option value="">— оберіть підрозділ —</option>
                    {departments.map(d => (
                      <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'position' && (
                <div>
                  <label className={labelClass}>Посада</label>
                  <select value={positionId} onChange={e => setPositionId(e.target.value)} className={inputClass}>
                    <option value="">— оберіть посаду —</option>
                    {positions.map(p => (
                      <option key={p._id || p.id} value={p._id || p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Дата виходу</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    Від неї рахуються строки всіх кроків
                  </p>
                </div>
                <div>
                  <label className={labelClass}>
                    Наставник {template.requiresBuddy && <span className="text-rose-500">*</span>}
                  </label>
                  <select value={buddyUserId} onChange={e => setBuddyUserId(e.target.value)} className={inputClass}>
                    <option value="">— без наставника —</option>
                    {users.map(u => (
                      <option key={u._id || u.id} value={u._id || u.id}>
                        {u.fullName || u.username || u.email}
                      </option>
                    ))}
                  </select>
                  {template.requiresBuddy && !buddyUserId && (
                    <p className="text-[10px] text-rose-500 mt-1">Цей онбординг вимагає наставника</p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Коментар</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="На що звернути увагу новачку"
                />
              </div>

              {scope !== 'single' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Для групового призначення дата виходу однакова для всіх. Якщо люди виходять у різні
                    дні, призначайте індивідуально — інакше строки кроків будуть неточними.
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Скасувати
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit || submitting || Boolean(success)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Призначити
          </button>
        </div>
      </div>
    </div>
  );
};
