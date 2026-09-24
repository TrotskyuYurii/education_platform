import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Plus,
  Users,
  Edit2,
  Loader2
} from 'lucide-react';
import { InstructionSection } from '../../types';
import { MaterialEditDialog } from './MaterialEditDialog';
import {
  SortHeader,
  FILTER_CLASS,
  TH_CLASS,
  compareText,
  useTableState,
  paginate,
  TableSearch,
  ResetFiltersButton,
  TableFrame,
  TablePagination,
  TableNotice,
  StatusBadge
} from './AdminTable';

/**
 * Вкладка «Користувачі» розділу адміністрування.
 *
 * Раніше жила всередині TestManagement і тримала там десять хуків стану, через
 * що кожна літера, введена у форму створення користувача, перемальовувала всі
 * три тисячі рядків адмінки. Винесена окремо, вона перемальовує лише себе, а
 * свої довідники (користувачі, ролі, посади, локації) тягне з мережі тільки
 * коли вкладку справді відкрили.
 *
 * Перелік — таблиця на всю ширину з пошуком, фільтрами, сортуванням і
 * сторінками: картками поруч із формою сотні співробітників не проглянеш.
 * Створення й редагування відкриваються окремим вікном, як і для матеріалів.
 */

interface UserManagementProps {
  /** Потрібні для точкового обмеження доступу до окремих інструкцій. */
  sections: InstructionSection[];
  /** Підрозділами володіє батьківський компонент: їх редагує вкладка оргструктури. */
  departments: any[];
}

/** Сервер віддає щонайбільше стільки користувачів за запит. */
const USERS_PAGE_LIMIT = 1000;

type SortKey = 'name' | 'department' | 'position' | 'manager' | 'status' | 'createdAt';

interface UserRow {
  user: any;
  name: string;
  email: string;
  departmentName: string;
  positionTitle: string;
  managerName: string;
  roleKeys: string[];
  roleBadges: { key: string; label: string; isAdmin: boolean }[];
  isActive: boolean;
  createdAt: number;
  /** Рядок для пошуку, зібраний один раз. */
  haystack: string;
}

const refId = (value: any): string => {
  if (!value) return '';
  return String(typeof value === 'object' ? value._id || '' : value);
};

const userLabel = (u: any) =>
  u?.fullName ? `${u.fullName} (${u.email || u.username})` : (u?.email || u?.username || '');

/**
 * Рядок таблиці.
 *
 * memo тут дає реальний виграш саме тому, що всі пропси — готові рядки або
 * незмінні посилання, а onSelect стабільний через useCallback. Набір тексту в
 * пошуку чи у формі не перемальовує рядки, що лишилися на сторінці.
 */
const UserTableRow = React.memo<{ row: UserRow; isSelected: boolean; onSelect: (user: any) => void }>(({
  row,
  isSelected,
  onSelect
}) => {
  const { user } = row;
  return (
    <tr
      onClick={() => onSelect(user)}
      className={`cursor-pointer transition ${
        isSelected ? 'bg-purple-50' : 'hover:bg-slate-50'
      } ${row.isActive ? '' : 'text-slate-400'}`}
    >
      <td className="px-3 py-2.5 align-top">
        <div className={`font-semibold text-sm ${row.isActive ? 'text-slate-900' : 'text-slate-500'}`}>
          {row.name || <span className="italic text-slate-400">Без ПІБ</span>}
        </div>
        <div className="text-xs text-slate-500 truncate max-w-[260px]">{row.email}</div>
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-slate-700">
        {row.departmentName || <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-slate-700 hidden lg:table-cell">
        {row.positionTitle || <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-slate-700 hidden xl:table-cell">
        {row.managerName || <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-wrap gap-1">
          {row.roleBadges.map(badge => (
            <span
              key={badge.key}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                badge.isAdmin
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top text-xs hidden md:table-cell whitespace-nowrap">
        {user.authMethod === 'otp' ? (
          <span className="font-semibold text-emerald-700">✉️ Email-код</span>
        ) : (
          <span className="text-slate-500">Пароль</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top">
        <StatusBadge active={row.isActive} />
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-slate-500 whitespace-nowrap hidden lg:table-cell">
        {row.createdAt ? new Date(row.createdAt).toLocaleDateString('uk-UA') : '—'}
      </td>
      <td className="px-3 py-2.5 align-top text-right">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onSelect(user); }}
          className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition"
          title="Редагувати користувача"
          aria-label={`Редагувати ${row.name || row.email}`}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});
UserTableRow.displayName = 'UserTableRow';

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

/** Поле пароля з кнопкою «показати». */
const PasswordInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}> = ({ value, onChange, disabled, required }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        disabled={disabled}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
        className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setVisible(v => !v)}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
        title={visible ? 'Приховати пароль' : 'Показати пароль'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

/**
 * Поле «Повторіть пароль» з підказкою під ним: пароль змінюється лише тоді,
 * коли обидва введення збігаються — так одруківка не заблокує людині вхід.
 */
const PasswordConfirmField: React.FC<{
  password: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}> = ({ password, value, onChange, disabled, required }) => {
  const mismatch = !disabled && value !== '' && value !== password;
  const matches = !disabled && password !== '' && value === password;
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        Повторіть пароль {required && !disabled ? '*' : ''}
      </label>
      <PasswordInput value={value} onChange={onChange} disabled={disabled} required={required && !disabled} />
      {mismatch && <p className="text-[11px] font-medium text-rose-600 mt-1">Паролі не збігаються</p>}
      {matches && <p className="text-[11px] font-medium text-emerald-600 mt-1">Паролі збігаються</p>}
    </div>
  );
};

const SELECT_CLASS = 'w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const INPUT_CLASS = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const LABEL_CLASS = 'block text-xs font-semibold text-slate-700 mb-1';

const blankNewUser = () => ({
  fullName: '',
  email: '',
  username: '',
  password: '',
  passwordConfirm: '',
  authMethod: 'password',
  role: 'user',
  roleKeys: ['employee'],
  departmentId: '',
  managerId: ''
});

export const UserManagement: React.FC<UserManagementProps> = ({ sections, departments }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<any>(blankNewUser);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Пошук, фільтри, сортування й сторінки таблиці
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  // Дату додавання зручніше одразу бачити від найновіших
  const { sort, onSort: handleSort, page, setPage, pageSize, setPageSize } = useTableState<SortKey>(
    { key: 'name', dir: 'asc' },
    [search, departmentFilter, roleFilter, statusFilter],
    ['createdAt']
  );

  /**
   * Сервер віддає не більше тисячі користувачів за раз, тож довантажуємо
   * сторінками, доки не отримаємо всіх — інакше частина людей просто не
   * потрапила б ні в таблицю, ні у вибір керівника.
   */
  const fetchUsers = useCallback(async () => {
    try {
      const all: any[] = [];
      for (let skip = 0; skip < USERS_PAGE_LIMIT * 50; skip += USERS_PAGE_LIMIT) {
        const res = await fetch(`/api/admin/users?limit=${USERS_PAGE_LIMIT}&skip=${skip}`);
        const data = await res.json();
        if (!res.ok) break;
        const batch: any[] = data.users || [];
        all.push(...batch);
        const total = typeof data.total === 'number' ? data.total : all.length;
        if (batch.length < USERS_PAGE_LIMIT || all.length >= total) break;
      }
      setUsers(all);
    } catch (err) {
      /* лишаємо попередній перелік */
    } finally {
      setLoadingUsers(false);
    }
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

  // Довідники як Map: інакше кожен рядок шукав би назву підрозділу, посади та
  // підпис ролі лінійним пошуком, тобто O(користувачі × довідник) на рендер.
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach(d => {
      const id = d?._id || d?.id;
      if (id) map.set(String(id), d.name);
    });
    return map;
  }, [departments]);

  const positionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    positions.forEach(p => { if (p?._id) map.set(String(p._id), p.title); });
    return map;
  }, [positions]);

  const roleTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach(r => { if (r?.key) map.set(r.key, r.title || r.key); });
    return map;
  }, [roles]);

  /** Готові до рендеру рядки — перераховуються лише при зміні самих даних. */
  const rows = useMemo<UserRow[]>(() => users.map(u => {
    const departmentName = typeof u.departmentId === 'object' && u.departmentId
      ? (u.departmentId.name || '')
      : (departmentNameById.get(refId(u.departmentId)) || '');
    const positionTitle = typeof u.positionId === 'object' && u.positionId
      ? (u.positionId.title || '')
      : (positionTitleById.get(refId(u.positionId)) || '');
    const managerName = typeof u.managerId === 'object' && u.managerId
      ? (u.managerId.fullName || u.managerId.email || u.managerId.username || '')
      : '';
    const roleKeys: string[] = u.roleKeys && u.roleKeys.length > 0 ? u.roleKeys : [u.role || 'employee'];
    const roleBadges = roleKeys.map(k => ({ key: k, label: roleTitleByKey.get(k) || k, isAdmin: k === 'admin' }));
    const name = u.fullName || '';
    const email = u.email || u.username || '';
    return {
      user: u,
      name,
      email,
      departmentName,
      positionTitle,
      managerName,
      roleKeys,
      roleBadges,
      isActive: u.isActive !== false,
      createdAt: u.createdAt ? new Date(u.createdAt).getTime() : 0,
      haystack: [name, email, departmentName, positionTitle, managerName, ...roleBadges.map(b => b.label)]
        .join(' ')
        .toLowerCase()
    };
  }), [users, departmentNameById, positionTitleById, roleTitleByKey]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.departmentName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'uk')),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = rows.filter(r => {
      if (query && !r.haystack.includes(query)) return false;
      if (departmentFilter === 'none' && r.departmentName) return false;
      if (departmentFilter !== 'all' && departmentFilter !== 'none' && r.departmentName !== departmentFilter) return false;
      if (roleFilter !== 'all' && !r.roleKeys.includes(roleFilter)) return false;
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'inactive' && r.isActive) return false;
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const text = (a: string, b: string) => compareText(a, b, sort.dir);
    list.sort((a, b) => {
      switch (sort.key) {
        case 'department': return text(a.departmentName, b.departmentName) || text(a.name || a.email, b.name || b.email);
        case 'position': return text(a.positionTitle, b.positionTitle) || text(a.name || a.email, b.name || b.email);
        case 'manager': return text(a.managerName, b.managerName) || text(a.name || a.email, b.name || b.email);
        case 'status': return (Number(b.isActive) - Number(a.isActive)) * dir || text(a.name || a.email, b.name || b.email);
        case 'createdAt': return (a.createdAt - b.createdAt) * dir;
        default: return text(a.name || a.email, b.name || b.email);
      }
    });
    return list;
  }, [rows, search, departmentFilter, roleFilter, statusFilter, sort]);

  const { pageCount, safePage, pageRows } = paginate(filteredRows, page, pageSize);

  const activeCount = useMemo(() => rows.filter(r => r.isActive).length, [rows]);
  const hasFilters = search.trim() !== '' || departmentFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all';

  const handleSelectUser = useCallback((u: any) => {
    const normalizedDepts = Array.isArray(u.departments)
      ? u.departments.map((d: any) => typeof d === 'string' ? d : d?.name).filter(Boolean)
      : [];
    setFormError(null);
    setCreating(false);
    setSelectedUser({
      ...u,
      departmentId: refId(u.departmentId) || undefined,
      managerId: refId(u.managerId) || undefined,
      positionId: refId(u.positionId) || undefined,
      locationId: refId(u.locationId) || undefined,
      departments: normalizedDepts
    });
  }, []);

  const openCreate = () => {
    setSelectedUser(null);
    setNewUser(blankNewUser());
    setFormError(null);
    setCreating(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setFormError(null);
    const changesPassword = selectedUser.authMethod !== 'otp' && Boolean(selectedUser.newPassword || selectedUser.newPasswordConfirm);
    if (changesPassword && selectedUser.newPassword !== selectedUser.newPasswordConfirm) {
      setFormError('Паролі не збігаються. Введіть новий пароль двічі однаково.');
      return;
    }
    setSaving(true);
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
          password: changesPassword ? selectedUser.newPassword : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не вдалося оновити користувача');
      setNotice(`Зміни для ${selectedUser.fullName || selectedUser.email} збережено.`);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err?.message || 'Помилка оновлення користувача');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    setFormError(null);
    const cleanEmail = (newUser.email || '').trim().toLowerCase();

    if (!cleanEmail.endsWith('@viatec.ua')) {
      setFormError('Email має бути виключно в домені @viatec.ua');
      return;
    }

    if (!newUser.password && newUser.authMethod !== 'otp') {
      setFormError('Пароль є обов\'язковим полем');
      return;
    }

    if (newUser.authMethod !== 'otp' && newUser.password !== newUser.passwordConfirm) {
      setFormError('Паролі не збігаються. Введіть пароль двічі однаково.');
      return;
    }

    setSaving(true);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не вдалося створити користувача');

      setNotice(`Користувача ${cleanEmail} успішно створено!`);
      setCreating(false);
      setNewUser(blankNewUser());
      fetchUsers();
    } catch (err: any) {
      setFormError(err?.message || 'Помилка створення користувача');
    } finally {
      setSaving(false);
    }
  };

  const closeDialog = () => {
    setSelectedUser(null);
    setCreating(false);
    setFormError(null);
  };

  const managerOptions = (excludeId?: string) => users
    .filter(u => u._id !== excludeId)
    .map(u => ({ id: u._id, label: userLabel(u) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'uk'));

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Керування користувачами</h3>
          <p className="text-sm text-slate-500 mt-1">
            Створення та редагування користувачів. Налаштування доступів до підрозділів та інструкцій.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
        >
          <Plus className="w-4 h-4" />
          Створити користувача
        </button>
      </div>

      {notice && <TableNotice tone="success" text={notice} onClose={() => setNotice(null)} />}

      {/* Панель пошуку та фільтрів */}
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch value={search} onChange={setSearch} placeholder="Пошук: ПІБ, email, посада, керівник…" />
        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className={FILTER_CLASS} aria-label="Фільтр за підрозділом">
          <option value="all">Усі підрозділи</option>
          <option value="none">Без підрозділу</option>
          {departmentOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={FILTER_CLASS} aria-label="Фільтр за роллю">
          <option value="all">Усі ролі</option>
          {roles.map(r => <option key={r.key} value={r.key}>{r.title || r.key}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={FILTER_CLASS} aria-label="Фільтр за статусом">
          <option value="all">Будь-який статус</option>
          <option value="active">Активні</option>
          <option value="inactive">Вимкнені</option>
        </select>
        {hasFilters && (
          <ResetFiltersButton onClick={() => { setSearch(''); setDepartmentFilter('all'); setRoleFilter('all'); setStatusFilter('all'); }} />
        )}
        <div className="grow" />
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {hasFilters ? `Знайдено ${filteredRows.length} з ${rows.length}` : `Усього ${rows.length}`}
          <span className="text-slate-300">·</span>
          активних {activeCount}
        </span>
      </div>

      {/* Таблиця */}
      <TableFrame
        head={<>
          <SortHeader label="Співробітник" sortKey="name" sort={sort} onSort={handleSort} />
          <SortHeader label="Підрозділ" sortKey="department" sort={sort} onSort={handleSort} />
          <SortHeader label="Посада" sortKey="position" sort={sort} onSort={handleSort} className="hidden lg:table-cell" />
          <SortHeader label="Керівник" sortKey="manager" sort={sort} onSort={handleSort} className="hidden xl:table-cell" />
          <th scope="col" className={TH_CLASS}>Ролі</th>
          <th scope="col" className={`${TH_CLASS} hidden md:table-cell`}>Вхід</th>
          <SortHeader label="Статус" sortKey="status" sort={sort} onSort={handleSort} />
          <SortHeader label="Додано" sortKey="createdAt" sort={sort} onSort={handleSort} className="hidden lg:table-cell" />
          <th scope="col" className="px-3 py-2.5"><span className="sr-only">Дії</span></th>
        </>}
        empty={pageRows.length === 0 && (loadingUsers ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Завантаження користувачів…</span>
        ) : hasFilters ? 'За цими умовами користувачів не знайдено.' : 'Користувачів ще немає.')}
        footer={
          <TablePagination
            total={filteredRows.length}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        }
      >
        {pageRows.map(row => (
          <UserTableRow
            key={row.user._id}
            row={row}
            isSelected={selectedUser?._id === row.user._id}
            onSelect={handleSelectUser}
          />
        ))}
      </TableFrame>

      {/* Редагування користувача */}
      <MaterialEditDialog
        open={Boolean(selectedUser)}
        onClose={closeDialog}
        size="lg"
        icon={<Edit2 className="w-4 h-4" />}
        iconTone="bg-purple-50 text-purple-600 border-purple-100"
        title="Редагування користувача"
        subtitle={selectedUser ? (selectedUser.email || selectedUser.username) : undefined}
        submitLabel="Зберегти зміни"
        onSubmit={handleUpdateUser}
        saving={saving}
        error={formError}
      >
        {selectedUser && (
          <>
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
                  value={selectedUser.departmentId || ''}
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
                  value={selectedUser.managerId || ''}
                  onChange={e => setSelectedUser({ ...selectedUser, managerId: e.target.value || undefined })}
                  className={SELECT_CLASS}
                >
                  <option value="">Без керівника</option>
                  {managerOptions(selectedUser._id).map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Посада</label>
                <select
                  value={selectedUser.positionId || ''}
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
                  value={selectedUser.locationId || ''}
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

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
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
              <PasswordInput
                value={selectedUser.newPassword || ''}
                onChange={value => setSelectedUser({ ...selectedUser, newPassword: value })}
                disabled={selectedUser.authMethod === 'otp'}
              />
            </div>

            {selectedUser.authMethod !== 'otp' && (selectedUser.newPassword || selectedUser.newPasswordConfirm) && (
              <PasswordConfirmField
                password={selectedUser.newPassword || ''}
                value={selectedUser.newPasswordConfirm || ''}
                onChange={value => setSelectedUser({ ...selectedUser, newPasswordConfirm: value })}
                required
              />
            )}

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
                        setSelectedUser({
                          ...selectedUser,
                          departments: e.target.checked ? [...deps, d.name] : deps.filter((x: string) => x !== d.name)
                        });
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
                        setSelectedUser({
                          ...selectedUser,
                          allowedInstructionIds: e.target.checked ? [...allowed, s.id] : allowed.filter((x: string) => x !== s.id)
                        });
                      }}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs text-slate-700">{s.title} <span className="text-slate-400">({s.department})</span></span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </MaterialEditDialog>

      {/* Створення користувача */}
      <MaterialEditDialog
        open={creating}
        onClose={closeDialog}
        size="lg"
        icon={<Plus className="w-4 h-4" />}
        iconTone="bg-purple-50 text-purple-600 border-purple-100"
        title="Створити нового користувача"
        submitLabel="Створити користувача"
        onSubmit={handleCreateUser}
        saving={saving}
        error={formError}
      >
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
          <p className="text-[11px] text-slate-500 mt-1">Email використовується як логін для входу в систему.</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <label className={LABEL_CLASS}>Варіант авторизації</label>
          <select
            value={newUser.authMethod || 'password'}
            onChange={e => setNewUser({ ...newUser, authMethod: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="password">Стандартний логін (email) та пароль</option>
            <option value="otp">Логін та 8-значний випадковий ключ (Email)</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>
            Пароль {newUser.authMethod === 'otp' ? '(не використовується)' : '*'}
          </label>
          <PasswordInput
            value={newUser.password}
            onChange={value => setNewUser({ ...newUser, password: value })}
            disabled={newUser.authMethod === 'otp'}
            required={newUser.authMethod !== 'otp'}
          />
        </div>

        <PasswordConfirmField
          password={newUser.password}
          value={newUser.passwordConfirm || ''}
          onChange={value => setNewUser({ ...newUser, passwordConfirm: value })}
          disabled={newUser.authMethod === 'otp'}
          required
        />

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
              {managerOptions().map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </MaterialEditDialog>
    </div>
  );
};
