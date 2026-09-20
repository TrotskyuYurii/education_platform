import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { InstructionSection } from '../../types';

/**
 * Вкладка «Користувачі» розділу адміністрування.
 *
 * Раніше жила всередині TestManagement і тримала там десять хуків стану, через
 * що кожна літера, введена у форму створення користувача, перемальовувала всі
 * три тисячі рядків адмінки. Винесена окремо, вона перемальовує лише себе, а
 * свої довідники (користувачі, ролі, посади, локації) тягне з мережі тільки
 * коли вкладку справді відкрили.
 */

interface UserManagementProps {
  /** Потрібні для точкового обмеження доступу до окремих інструкцій. */
  sections: InstructionSection[];
  /** Підрозділами володіє батьківський компонент: їх редагує вкладка оргструктури. */
  departments: any[];
}

interface UserListItemProps {
  user: any;
  isSelected: boolean;
  /** Готова назва підрозділу — щоб рядок не шукав її сам і лишався memo-придатним. */
  departmentName: string | null;
  /** Підписи ролей з готовою ознакою адміністратора: рядок нічого не доглядає сам. */
  roleBadges: { key: string; label: string; isAdmin: boolean }[];
  onSelect: (user: any) => void;
}

/**
 * Рядок списку користувачів.
 *
 * memo тут дає реальний виграш саме тому, що всі пропси — примітиви, готові
 * рядки або незмінні посилання, а onSelect стабільний через useCallback. При
 * редагуванні форми праворуч жоден рядок не перемальовується; без memo їх
 * перемальовувалось би стільки, скільки користувачів у компанії.
 */
const UserListItem = React.memo<UserListItemProps>(({
  user,
  isSelected,
  departmentName,
  roleBadges,
  onSelect
}) => {
  const displayName = user.fullName
    ? `${user.fullName} (${user.email || user.username})`
    : (user.email || user.username);

  return (
    <div
      onClick={() => onSelect(user)}
      className={`p-3.5 rounded-xl border cursor-pointer transition ${isSelected ? 'border-purple-500 bg-purple-50/70 shadow-xs' : 'border-slate-200 bg-white hover:border-purple-300'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900 text-sm">{displayName}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {roleBadges.map(badge => (
              <span
                key={badge.key}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                  badge.isAdmin
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs border-t border-slate-100 pt-2">
        <span className="text-slate-500">
          {user.departmentId ? (
            <span>Відділ: <strong className="text-slate-700">{departmentName || 'Призначено'}</strong></span>
          ) : (
            <span>Підрозділів: {Array.isArray(user.departments) ? user.departments.length : 0}</span>
          )}
        </span>
        {user.authMethod === 'otp' ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            ✉️ Email-код (8 знаків)
          </span>
        ) : (
          <span className="text-slate-400 font-medium">Прямий вхід без коду</span>
        )}
      </div>
    </div>
  );
});
UserListItem.displayName = 'UserListItem';

/** Спільний для обох форм перелік чекбоксів з ролями RBAC. */
const RoleCheckboxes: React.FC<{
  roles: any[];
  currentRoles: string[];
  onChange: (nextKeys: string[], nextRole: string) => void;
}> = ({ roles, currentRoles, onChange }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Призначені ролі (RBAC)</label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 bg-white border border-slate-200 rounded-xl max-h-[200px] overflow-y-auto">
      {roles.map(r => (
        <label key={r.key} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={currentRoles.includes(r.key)}
            onChange={e => {
              let next: string[];
              if (e.target.checked) {
                next = [...currentRoles, r.key];
              } else {
                next = currentRoles.filter(k => k !== r.key);
                if (next.length === 0) next = ['employee'];
              }
              onChange(next, next.includes('admin') ? 'admin' : 'user');
            }}
            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
          />
          <div>
            <span className="font-medium text-slate-800">{r.title}</span>
            <span className="text-[10px] text-slate-400 ml-1 font-mono">({r.key})</span>
          </div>
        </label>
      ))}
    </div>
  </div>
);

const SELECT_CLASS = 'w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const INPUT_CLASS = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const LABEL_CLASS = 'block text-xs font-semibold text-slate-700 mb-1';

export const UserManagement: React.FC<UserManagementProps> = ({ sections, departments }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<any>({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch (err) {}
  }, []);

  // Довідники вантажаться при монтуванні вкладки, а не при відкритті адмінки:
  // адміністратор, який зайшов виправити текст інструкції, більше не тягне
  // список усіх співробітників, ролей, посад і локацій.
  useEffect(() => {
    const load = async (url: string, apply: (data: any) => void) => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) apply(data);
      } catch (err) {}
    };
    fetchUsers();
    load('/api/admin/roles', data => setRoles(data.roles || []));
    load('/api/v2/org/positions', data => setPositions(Array.isArray(data) ? data : []));
    load('/api/v2/org/locations', data => setLocations(Array.isArray(data) ? data : []));
  }, [fetchUsers]);

  // Довідники як Map: інакше кожен рядок списку шукав би назву підрозділу та
  // підпис ролі лінійним пошуком, тобто O(користувачі × підрозділи) на рендер.
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach(d => {
      const id = d?._id || d?.id;
      if (id) map.set(String(id), d.name);
    });
    return map;
  }, [departments]);

  const roleTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach(r => { if (r?.key) map.set(r.key, r.title || r.key); });
    return map;
  }, [roles]);

  /**
   * Готові до рендеру рядки. Перерахунок прив'язаний лише до самих даних, тож
   * правки у формі праворуч його не зачіпають — саме це й робить memo на
   * UserListItem дієвим.
   */
  const userRows = useMemo(() => users.map(u => {
    const rawDepId = typeof u.departmentId === 'object' && u.departmentId ? u.departmentId._id : u.departmentId;
    const departmentName = typeof u.departmentId === 'object' && u.departmentId
      ? (u.departmentId.name || null)
      : (rawDepId ? (departmentNameById.get(String(rawDepId)) || null) : null);
    const keys: string[] = u.roleKeys && u.roleKeys.length > 0 ? u.roleKeys : [u.role || 'employee'];
    return {
      user: u,
      departmentName,
      roleBadges: keys.map(k => ({ key: k, label: roleTitleByKey.get(k) || k, isAdmin: k === 'admin' }))
    };
  }), [users, departmentNameById, roleTitleByKey]);

  const handleSelectUser = useCallback((u: any) => {
    const normalizedDeptId = typeof u.departmentId === 'object' && u.departmentId ? u.departmentId._id : u.departmentId;
    const normalizedManagerId = typeof u.managerId === 'object' && u.managerId ? u.managerId._id : u.managerId;
    const normalizedDepts = Array.isArray(u.departments)
      ? u.departments.map((d: any) => typeof d === 'string' ? d : d?.name).filter(Boolean)
      : [];
    setSelectedUser({
      ...u,
      departmentId: normalizedDeptId,
      managerId: normalizedManagerId,
      departments: normalizedDepts
    });
  }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: selectedUser.fullName,
          email: selectedUser.email,
          departments: selectedUser.departments,
          departmentId: selectedUser.departmentId,
          allowedInstructionIds: selectedUser.allowedInstructionIds,
          role: selectedUser.role,
          roleKeys: selectedUser.roleKeys || ['employee'],
          managerId: selectedUser.managerId,
          positionId: selectedUser.positionId,
          locationId: selectedUser.locationId,
          hireDate: selectedUser.hireDate,
          isActive: selectedUser.isActive,
          authMethod: selectedUser.authMethod,
          password: selectedUser.newPassword || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      alert('Помилка оновлення користувача');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    const cleanEmail = newUser.email.trim().toLowerCase();

    if (!cleanEmail.endsWith('@viatec.ua')) {
      setUserMsg({ type: 'error', text: 'Email має бути виключно в домені @viatec.ua' });
      return;
    }

    if (!newUser.password && newUser.authMethod !== 'otp') {
      setUserMsg({ type: 'error', text: 'Пароль є обов\'язковим полем' });
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newUser.fullName,
          email: cleanEmail,
          username: newUser.username,
          password: newUser.password || 'TemporaryPassword123!',
          authMethod: newUser.authMethod || 'password',
          role: newUser.role,
          roleKeys: newUser.roleKeys || ['employee'],
          departmentId: newUser.departmentId,
          managerId: newUser.managerId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUserMsg({ type: 'success', text: `Користувача ${cleanEmail} успішно створено!` });
      setNewUser({ fullName: '', email: '', username: '', password: '', authMethod: 'password', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-900">Керування користувачами</h3>
        <p className="text-sm text-slate-500 mt-1">
          Створення та редагування користувачів. Налаштування доступів до підрозділів та інструкцій.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6">
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-800 mb-3">Список користувачів</h4>
          <div className="space-y-2 max-h-[min(640px,calc(100vh-20rem))] overflow-y-auto pr-2">
            {userRows.map(row => (
              <UserListItem
                key={row.user._id}
                user={row.user}
                isSelected={selectedUser?._id === row.user._id}
                departmentName={row.departmentName}
                roleBadges={row.roleBadges}
                onSelect={handleSelectUser}
              />
            ))}
          </div>
        </div>

        <div>
          {selectedUser ? (
            <form onSubmit={handleUpdateUser} className="space-y-4 p-5 border border-slate-200 rounded-2xl bg-slate-50">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Редагування користувача</h4>
                <span className="text-xs text-purple-700 font-mono bg-purple-100 px-2 py-0.5 rounded">
                  {selectedUser.email || selectedUser.username}
                </span>
              </div>

              <div>
                <label className={LABEL_CLASS}>ПІБ співробітника</label>
                <input
                  type="text"
                  value={selectedUser.fullName || ''}
                  onChange={e => setSelectedUser({ ...selectedUser, fullName: e.target.value })}
                  placeholder="напр. Іваненко Петро Васильович"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Email (@viatec.ua) *</label>
                <input
                  type="email"
                  required
                  value={selectedUser.email || ''}
                  onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <RoleCheckboxes
                roles={roles}
                currentRoles={selectedUser.roleKeys || [selectedUser.role || 'employee']}
                onChange={(roleKeys, role) => setSelectedUser({ ...selectedUser, roleKeys, role })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Основний підрозділ</label>
                  <select
                    value={typeof selectedUser.departmentId === 'object' ? (selectedUser.departmentId?._id || '') : (selectedUser.departmentId || '')}
                    onChange={e => setSelectedUser({ ...selectedUser, departmentId: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Не обрано</option>
                    {departments.map(d => (
                      <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Керівник (Manager)</label>
                  <select
                    value={typeof selectedUser.managerId === 'object' ? (selectedUser.managerId?._id || '') : (selectedUser.managerId || '')}
                    onChange={e => setSelectedUser({ ...selectedUser, managerId: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Без керівника</option>
                    {users.filter(u => u._id !== selectedUser._id).map(u => (
                      <option key={u._id} value={u._id}>
                        {u.fullName ? `${u.fullName} (${u.email || u.username})` : (u.email || u.username)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Посада</label>
                  <select
                    value={typeof selectedUser.positionId === 'object' ? (selectedUser.positionId?._id || '') : (selectedUser.positionId || '')}
                    onChange={e => setSelectedUser({ ...selectedUser, positionId: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Не обрано</option>
                    {positions.map(p => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Локація</label>
                  <select
                    value={typeof selectedUser.locationId === 'object' ? (selectedUser.locationId?._id || '') : (selectedUser.locationId || '')}
                    onChange={e => setSelectedUser({ ...selectedUser, locationId: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Не обрано</option>
                    {locations.map(l => (
                      <option key={l._id} value={l._id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Дата найму</label>
                  <input
                    type="date"
                    value={selectedUser.hireDate ? String(selectedUser.hireDate).slice(0, 10) : ''}
                    onChange={e => setSelectedUser({ ...selectedUser, hireDate: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.isActive !== false}
                      onChange={e => setSelectedUser({ ...selectedUser, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    Активний співробітник
                  </label>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <label className={LABEL_CLASS}>Варіант авторизації</label>
                <select
                  value={selectedUser.authMethod || 'password'}
                  onChange={e => setSelectedUser({ ...selectedUser, authMethod: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="password">Стандартний логін (email) та пароль</option>
                  <option value="otp">Логін та 8-значний випадковий ключ (Email)</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>
                  Новий пароль {selectedUser.authMethod === 'otp' ? '(не використовується)' : '(залиште порожнім, щоб не змінювати)'}
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={selectedUser.authMethod === 'otp'}
                    value={selectedUser.newPassword || ''}
                    onChange={e => setSelectedUser({ ...selectedUser, newPassword: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={selectedUser.authMethod === 'otp'}
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
                    title={showEditPassword ? 'Приховати пароль' : 'Показати пароль'}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Доступ до підрозділів</label>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto p-2.5 bg-white border border-slate-200 rounded-xl">
                  {departments.map(d => (
                    <label key={d._id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUser.departments?.includes(d.name) || false}
                        onChange={e => {
                          const deps = selectedUser.departments || [];
                          if (e.target.checked) {
                            setSelectedUser({ ...selectedUser, departments: [...deps, d.name] });
                          } else {
                            setSelectedUser({ ...selectedUser, departments: deps.filter((x: string) => x !== d.name) });
                          }
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs text-slate-700">{d.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Якщо обрано "Всі підрозділи", користувач бачитиме інструкції всіх підрозділів.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Обмеження за інструкціями (опціонально)</label>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto p-2.5 bg-white border border-slate-200 rounded-xl">
                  {sections.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUser.allowedInstructionIds?.includes(s.id) || false}
                        onChange={e => {
                          const allowed = selectedUser.allowedInstructionIds || [];
                          if (e.target.checked) {
                            setSelectedUser({ ...selectedUser, allowedInstructionIds: [...allowed, s.id] });
                          } else {
                            setSelectedUser({ ...selectedUser, allowedInstructionIds: allowed.filter((x: string) => x !== s.id) });
                          }
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs text-slate-700">{s.title} <span className="text-slate-400">({s.department})</span></span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-xs transition">
                  Зберегти зміни
                </button>
                <button type="button" onClick={() => setSelectedUser(null)} className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition">
                  Скасувати
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-4 p-5 border border-slate-200 rounded-2xl bg-slate-50">
              <h4 className="font-bold text-slate-900 text-sm">Створити нового користувача</h4>
              {userMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium ${userMsg.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {userMsg.text}
                </div>
              )}
              <div>
                <label className={LABEL_CLASS}>ПІБ співробітника</label>
                <input
                  type="text"
                  value={newUser.fullName || ''}
                  onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="напр. Іваненко Петро Васильович"
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Корпоративний Email (@viatec.ua) *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="user@viatec.ua"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Email використовується як логін для входу в систему.
                </p>
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  Пароль {newUser.authMethod === 'otp' ? '(не використовується)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required={newUser.authMethod !== 'otp'}
                    disabled={newUser.authMethod === 'otp'}
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    disabled={newUser.authMethod === 'otp'}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
                    title={showNewPassword ? 'Приховати пароль' : 'Показати пароль'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <label className={LABEL_CLASS}>Варіант авторизації</label>
                <select
                  value={(newUser as any).authMethod || 'password'}
                  onChange={e => setNewUser({ ...newUser, authMethod: e.target.value } as any)}
                  className={INPUT_CLASS}
                >
                  <option value="password">Стандартний логін (email) та пароль</option>
                  <option value="otp">Логін та 8-значний випадковий ключ (Email)</option>
                </select>
              </div>

              <RoleCheckboxes
                roles={roles}
                currentRoles={newUser.roleKeys || [newUser.role || 'employee']}
                onChange={(roleKeys, role) => setNewUser({ ...newUser, roleKeys, role })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Основний підрозділ</label>
                  <select
                    value={newUser.departmentId || ''}
                    onChange={e => setNewUser({ ...newUser, departmentId: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Не обрано</option>
                    {departments.map(d => (
                      <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Керівник (Manager)</label>
                  <select
                    value={newUser.managerId || ''}
                    onChange={e => setNewUser({ ...newUser, managerId: e.target.value || undefined })}
                    className={SELECT_CLASS}
                  >
                    <option value="">Без керівника</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.fullName ? `${u.fullName} (${u.email || u.username})` : (u.email || u.username)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-semibold text-xs transition">
                Створити користувача
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
