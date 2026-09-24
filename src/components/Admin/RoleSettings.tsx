import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  BookOpen,
  FileText,
  BarChart3,
  Award,
  Sparkles,
  Loader2
} from 'lucide-react';
import { PermissionDefinition, PermissionScope, Role, PermissionItem } from '../../types';
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
  TableNotice
} from './AdminTable';

interface ScopesInfo {
  label: string;
  desc: string;
  order: number;
}

type SortKey = 'title' | 'type' | 'permissions' | 'users';

/**
 * Вкладка «Ролі та права».
 *
 * Перелік ролей показано так само, як «Користувачів»: таблиця з пошуком,
 * фільтрами, сортуванням і сторінками, а матриця прав відкривається окремим
 * вікном — картками ролі погано порівнювати між собою.
 */
export const RoleSettings: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([]);
  const [scopesMeta, setScopesMeta] = useState<Record<PermissionScope, ScopesInfo>>({
    self: { label: 'Власні дані (Self)', desc: 'Тільки власні записи', order: 1 },
    team: { label: 'Команда (Team)', desc: 'Співробітники у підпорядкуванні', order: 2 },
    department: { label: 'Підрозділ (Dept)', desc: 'Співробітники того ж підрозділу', order: 3 },
    all: { label: 'Вся компанія (All)', desc: 'Повний доступ до всіх записів', order: 4 }
  });

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Помилка збереження показується у вікні, щоб не втрачати введене.
  const [formError, setFormError] = useState<string | null>(null);

  // Modals / editing state
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [deletingRoleKey, setDeletingRoleKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [roleForm, setRoleForm] = useState<{
    key: string;
    title: string;
    description: string;
    permissions: PermissionItem[];
  }>({
    key: '',
    title: '',
    description: '',
    permissions: []
  });

  // Пошук, фільтри, сортування й сторінки таблиці
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'system' | 'custom'>('all');
  const [permissionFilter, setPermissionFilter] = useState('all');
  const { sort, onSort, page, setPage, pageSize, setPageSize } = useTableState<SortKey>(
    { key: 'title', dir: 'asc' },
    [search, typeFilter, permissionFilter],
    ['permissions', 'users']
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/permissions')
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }
      if (permsRes.ok) {
        const permsData = await permsRes.json();
        setCatalog(permsData.permissions || []);
        if (permsData.scopes) {
          setScopesMeta(permsData.scopes);
        }
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Помилка завантаження ролей та дозволів' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setRoleForm({
      key: '',
      title: '',
      description: '',
      permissions: [
        { permission: 'users.profile.view', scope: 'self' },
        { permission: 'learning.assignment.view', scope: 'self' }
      ]
    });
    setEditingRole(null);
    setFormError(null);
    setIsCreatingRole(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      key: role.key,
      title: role.title,
      description: role.description || '',
      permissions: JSON.parse(JSON.stringify(role.permissions || []))
    });
    setFormError(null);
    setIsCreatingRole(false);
  };

  const closeModal = () => {
    setIsCreatingRole(false);
    setEditingRole(null);
    setFormError(null);
  };

  const handleTogglePermission = (code: string) => {
    const existingIndex = roleForm.permissions.findIndex(p => p.permission === code);
    if (existingIndex > -1) {
      // Remove permission
      const updated = [...roleForm.permissions];
      updated.splice(existingIndex, 1);
      setRoleForm({ ...roleForm, permissions: updated });
    } else {
      // Add permission with default minimal allowed scope
      const permDef = catalog.find(p => p.code === code);
      const defaultScope = permDef?.allowedScopes[0] || 'self';
      setRoleForm({
        ...roleForm,
        permissions: [...roleForm.permissions, { permission: code, scope: defaultScope }]
      });
    }
  };

  const handleScopeChange = (code: string, newScope: PermissionScope) => {
    const updated = roleForm.permissions.map(p => {
      if (p.permission === code) {
        return { ...p, scope: newScope };
      }
      return p;
    });
    setRoleForm({ ...roleForm, permissions: updated });
  };

  const handleSaveRole = async () => {
    setIsSaving(true);
    setFormError(null);

    try {
      if (isCreatingRole) {
        const res = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(roleForm)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Не вдалося створити роль');
        setMsg({ type: 'success', text: `Роль "${roleForm.title}" успішно створено` });
        setIsCreatingRole(false);
      } else if (editingRole) {
        const res = await fetch(`/api/admin/roles/${editingRole.key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: roleForm.title,
            description: roleForm.description,
            permissions: roleForm.permissions
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Не вдалося оновити роль');
        setMsg({ type: 'success', text: `Роль "${roleForm.title}" успішно оновлено` });
        setEditingRole(null);
      }
      await fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (key: string) => {
    setIsSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/roles/${key}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося видалити роль');
      setMsg({ type: 'success', text: data.message || 'Роль успішно видалено' });
      setDeletingRoleKey(null);
      await fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
      setDeletingRoleKey(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Group catalog permissions by category
  const categories = Array.from(new Set(catalog.map(p => p.category)));
  const categoryLabels: Record<string, { label: string; icon: any }> = {
    system: { label: 'Система та безпека', icon: Shield },
    users: { label: 'Користувачі та оргструктура', icon: Users },
    knowledge: { label: 'База знань та регламенти', icon: BookOpen },
    learning: { label: 'Навчання та тестування', icon: FileText },
    analytics: { label: 'Аналітика та звітність', icon: BarChart3 },
    certificates: { label: 'Сертифікація', icon: Award }
  };

  const permissionNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    catalog.forEach(p => map.set(p.code, p.name));
    return map;
  }, [catalog]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = roles.filter(r => {
      if (query) {
        const haystack = [r.title, r.key, r.description || ''].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (typeFilter === 'system' && !r.isSystem) return false;
      if (typeFilter === 'custom' && r.isSystem) return false;
      // Суперадміністратор має всі права, тож потрапляє під будь-який фільтр за правом
      if (permissionFilter !== 'all' && r.key !== 'admin' && !(r.permissions || []).some(p => p.permission === permissionFilter)) return false;
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const permCount = (r: Role) => r.key === 'admin' ? Number.MAX_SAFE_INTEGER : (r.permissions?.length || 0);
    list.sort((a, b) => {
      switch (sort.key) {
        case 'type': return (Number(b.isSystem) - Number(a.isSystem)) * dir || compareText(a.title, b.title, 'asc');
        case 'permissions': return (permCount(a) - permCount(b)) * dir || compareText(a.title, b.title, 'asc');
        case 'users': return ((a.userCount || 0) - (b.userCount || 0)) * dir || compareText(a.title, b.title, 'asc');
        default: return compareText(a.title, b.title, sort.dir);
      }
    });
    return list;
  }, [roles, search, typeFilter, permissionFilter, sort]);

  const { pageCount, safePage, pageRows } = paginate(filteredRoles, page, pageSize);
  const systemCount = roles.filter(r => r.isSystem).length;
  const hasFilters = search.trim() !== '' || typeFilter !== 'all' || permissionFilter !== 'all';

  return (
    <div className="space-y-5" id="role-settings-container">
      <div className="border-b border-slate-100 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Рольова модель і права доступу</h3>
          <p className="text-sm text-slate-500 mt-1">
            Керування ролями співробітників, матрицею дозволів та зонами видимості даних (RBAC).
          </p>
        </div>
        <button
          id="btn-create-role"
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
        >
          <Plus className="w-4 h-4" />
          Створити роль
        </button>
      </div>

      {msg && <TableNotice tone={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

      {/* Панель пошуку та фільтрів */}
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch value={search} onChange={setSearch} placeholder="Пошук ролі за назвою, ключем або описом…" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className={FILTER_CLASS} aria-label="Фільтр за типом ролі">
          <option value="all">Усі типи</option>
          <option value="system">Системні</option>
          <option value="custom">Користувацькі</option>
        </select>
        <select value={permissionFilter} onChange={e => setPermissionFilter(e.target.value)} className={`${FILTER_CLASS} max-w-[240px]`} aria-label="Фільтр за правом">
          <option value="all">Будь-яке право</option>
          {catalog.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        {hasFilters && (
          <ResetFiltersButton onClick={() => { setSearch(''); setTypeFilter('all'); setPermissionFilter('all'); }} />
        )}
        <div className="grow" />
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          {hasFilters ? `Знайдено ${filteredRoles.length} з ${roles.length}` : `Усього ${roles.length}`}
          <span className="text-slate-300">·</span>
          системних {systemCount}
          <span className="text-slate-300">·</span>
          користувацьких {roles.length - systemCount}
        </span>
      </div>

      {/* Таблиця */}
      <TableFrame
        head={<>
          <SortHeader label="Роль" sortKey="title" sort={sort} onSort={onSort} />
          <SortHeader label="Тип" sortKey="type" sort={sort} onSort={onSort} />
          <th scope="col" className={`${TH_CLASS} hidden lg:table-cell`}>Опис</th>
          <SortHeader label="Права" sortKey="permissions" sort={sort} onSort={onSort} />
          <SortHeader label="Користувачі" sortKey="users" sort={sort} onSort={onSort} className="hidden md:table-cell" />
          <th scope="col" className="px-3 py-2.5"><span className="sr-only">Дії</span></th>
        </>}
        empty={pageRows.length === 0 && (loading ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Завантаження ролей…</span>
        ) : hasFilters ? 'За цими умовами ролей не знайдено.' : 'Ролей ще немає.')}
        footer={
          <TablePagination
            total={filteredRoles.length}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        }
      >
        {pageRows.map(role => {
          const isSuperAdmin = role.key === 'admin';
          const permCount = role.permissions?.length || 0;
          const permTitle = (role.permissions || [])
            .map(p => `${permissionNameByCode.get(p.permission) || p.permission} (${scopesMeta[p.scope]?.label || p.scope})`)
            .join('\n');
          return (
            <tr
              key={role.key}
              id={`role-row-${role.key}`}
              onClick={() => openEditModal(role)}
              className={`cursor-pointer transition ${editingRole?.key === role.key ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
            >
              <td className="px-3 py-2.5 align-top">
                <div className="font-semibold text-sm text-slate-900">{role.title}</div>
                <div className="text-[11px] font-mono text-slate-400">{role.key}</div>
              </td>
              <td className="px-3 py-2.5 align-top">
                {role.isSystem ? (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                    Системна
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    Користувацька
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 align-top text-xs text-slate-600 hidden lg:table-cell max-w-[420px]">
                <span className="line-clamp-2">{role.description || <span className="text-slate-400">—</span>}</span>
              </td>
              <td className="px-3 py-2.5 align-top text-xs whitespace-nowrap">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Повний доступ
                  </span>
                ) : permCount === 0 ? (
                  <span className="text-slate-400 italic">Немає прав</span>
                ) : (
                  <span className="text-slate-700" title={permTitle}>
                    <strong>{permCount}</strong> з {catalog.length}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 align-top text-xs text-slate-700 hidden md:table-cell whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  {role.userCount || 0}
                </span>
              </td>
              <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                <button
                  id={`btn-edit-role-${role.key}`}
                  type="button"
                  onClick={e => { e.stopPropagation(); openEditModal(role); }}
                  className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition"
                  title="Налаштувати права та опис"
                  aria-label={`Редагувати роль ${role.title}`}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!role.isSystem && (
                  <button
                    id={`btn-delete-role-${role.key}`}
                    type="button"
                    onClick={e => { e.stopPropagation(); setDeletingRoleKey(role.key); }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Видалити роль"
                    aria-label={`Видалити роль ${role.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </TableFrame>

      {/* Створення / редагування ролі та матриці прав */}
      <MaterialEditDialog
        open={isCreatingRole || Boolean(editingRole)}
        onClose={closeModal}
        size="xl"
        icon={<ShieldCheck className="w-4 h-4" />}
        iconTone="bg-purple-50 text-purple-600 border-purple-100"
        title={isCreatingRole ? 'Створення нової ролі' : `Налаштування ролі: ${editingRole?.title}`}
        subtitle={isCreatingRole
          ? 'Вкажіть назву, унікальний код та визначте матрицю дозволів'
          : 'Змініть назву, опис або налаштуйте зону видимості кожного права'}
        submitLabel={isCreatingRole ? 'Створити роль' : 'Зберегти зміни'}
        onSubmit={handleSaveRole}
        saving={isSaving}
        error={formError}
        footerLeft={editingRole && !editingRole.isSystem ? (
          <button
            type="button"
            onClick={() => { const key = editingRole.key; closeModal(); setDeletingRoleKey(key); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 className="w-4 h-4" />
            Видалити
          </button>
        ) : undefined}
      >
        {/* Role Metadata Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Назва ролі <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={roleForm.title}
              onChange={(e) => setRoleForm({ ...roleForm, title: e.target.value })}
              placeholder="напр. Тімлід відділу продажів"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Унікальний ідентифікатор (key) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isCreatingRole}
              value={roleForm.key}
              onChange={(e) => setRoleForm({ ...roleForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
              placeholder="напр. sales_team_lead"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono ${
                !isCreatingRole 
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                  : 'border-slate-200 focus:border-purple-600 focus:ring-1 focus:ring-purple-600'
              }`}
            />
            {!isCreatingRole && (
              <span className="text-[11px] text-slate-400 mt-1 block">Ключ ідентифікатора ролі не можна змінювати після створення</span>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Опис ролі та призначеної відповідальності
            </label>
            <textarea
              rows={2}
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              placeholder="Коротко опишіть, для яких обов'язків або посад призначена ця роль..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
            />
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Матриця дозволів та зон видимості (Scopes)</h4>
              <p className="text-xs text-slate-500">Увімкніть необхідні функції та вкажіть область доступу даних для цієї ролі.</p>
            </div>
            <div className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
              Увімкнено: {roleForm.permissions.length} з {catalog.length}
            </div>
          </div>

          {/* Categories Accordions / Groups */}
          <div className="space-y-4">
            {categories.map(catKey => {
              const catInfo = categoryLabels[catKey] || { label: catKey, icon: Shield };
              const CatIcon = catInfo.icon;
              const items = catalog.filter(p => p.category === catKey);

              return (
                <div key={catKey} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
                  <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CatIcon className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        {catInfo.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {items.filter(item => roleForm.permissions.some(p => p.permission === item.code)).length} / {items.length} активних
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 bg-white">
                    {items.map(perm => {
                      const activePerm = roleForm.permissions.find(p => p.permission === perm.code);
                      const isEnabled = !!activePerm;

                      return (
                        <div 
                          key={perm.code}
                          className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isEnabled ? 'bg-purple-50/20' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              id={`check-${perm.code}`}
                              checked={isEnabled}
                              onChange={() => handleTogglePermission(perm.code)}
                              className="mt-1 w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                            />
                            <div>
                              <label 
                                htmlFor={`check-${perm.code}`} 
                                className="text-sm font-semibold text-slate-900 cursor-pointer select-none"
                              >
                                {perm.name}
                              </label>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {perm.description}
                              </p>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {perm.code}
                              </div>
                            </div>
                          </div>

                          {/* Scope Selector */}
                          <div className="sm:text-right pl-7 sm:pl-0 min-w-[200px]">
                            {isEnabled ? (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:text-right">
                                  Зона видимості (Scope)
                                </label>
                                <select
                                  value={activePerm.scope}
                                  onChange={(e) => handleScopeChange(perm.code, e.target.value as PermissionScope)}
                                  className="w-full sm:w-auto text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white text-purple-900 font-medium focus:outline-hidden focus:ring-1 focus:ring-purple-600 shadow-2xs cursor-pointer"
                                >
                                  {perm.allowedScopes.map(scope => (
                                    <option key={scope} value={scope}>
                                      {scopesMeta[scope]?.label || scope}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-slate-400 block mt-0.5 sm:text-right">
                                  {scopesMeta[activePerm.scope]?.desc}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Доступ вимкнено</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </MaterialEditDialog>

      {/* MODAL: Delete Role Confirmation */}
      {deletingRoleKey && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Видалити роль?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Ви впевнені, що бажаєте видалити роль <strong className="text-slate-900">{deletingRoleKey}</strong>? 
              Усі користувачі, яким була призначена ця роль, втратять відповідні права (їм автоматично буде збережено базову роль Співробітника).
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeletingRoleKey(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleDeleteRole(deletingRoleKey)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-sm font-medium transition shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Видалити</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
