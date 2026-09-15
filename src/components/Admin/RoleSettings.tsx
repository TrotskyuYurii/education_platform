import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Users, 
  Key, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  Info, 
  Lock, 
  Globe, 
  Building2, 
  UserCheck, 
  User, 
  BookOpen, 
  FileText, 
  BarChart3, 
  Award,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { PermissionDefinition, PermissionScope, Role, PermissionItem } from '../../types';

interface ScopesInfo {
  label: string;
  desc: string;
  order: number;
}

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

  // Filter state
  const [searchFilter, setSearchFilter] = useState('');

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
    setIsCreatingRole(true);
    setMsg(null);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      key: role.key,
      title: role.title,
      description: role.description || '',
      permissions: JSON.parse(JSON.stringify(role.permissions || []))
    });
    setIsCreatingRole(false);
    setMsg(null);
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

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg(null);

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
      setMsg({ type: 'error', text: err.message });
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

  const filteredRoles = roles.filter(r => 
    r.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.key.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-6" id="role-settings-container">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Рольова модель і права доступу</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Керування ролями співробітників, матрицею дозволів та зонами видимості даних (RBAC).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-create-role"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 font-medium text-sm transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Створити нову роль</span>
          </button>
        </div>
      </div>

      {/* Notifications / Toast */}
      {msg && (
        <div className={`p-4 rounded-xl flex items-center justify-between border ${
          msg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-3">
            {msg.type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="p-1 hover:bg-black/5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Всього ролей</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{roles.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">В системі корпоративного навчання</div>
        </div>
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Системні ролі</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">{roles.filter(r => r.isSystem).length}</div>
          <div className="text-xs text-purple-700/80 mt-0.5">Базові ролі платформи (захищені)</div>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Користувацькі ролі</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{roles.filter(r => !r.isSystem).length}</div>
          <div className="text-xs text-emerald-700/80 mt-0.5">Створені для специфічних обов'язків</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input 
          type="text"
          placeholder="Пошук ролі за назвою, ключем або описом..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-hidden text-slate-800 placeholder-slate-400"
        />
        {searchFilter && (
          <button onClick={() => setSearchFilter('')} className="p-1 text-slate-400 hover:text-slate-600 mr-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Roles Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Завантаження конфігурації ролей...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoles.map(role => {
            const isSuperAdmin = role.key === 'admin';
            const permCount = role.permissions?.length || 0;

            return (
              <div 
                key={role.key} 
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                id={`role-card-${role.key}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900">{role.title}</h4>
                        {role.isSystem ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
                            Системна
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                            Користувацька
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {role.key}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{role.userCount || 0} користувачів</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-edit-role-${role.key}`}
                        onClick={() => openEditModal(role)}
                        className="p-2 rounded-lg text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition"
                        title="Налаштувати права та опис"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!role.isSystem && (
                        <button
                          id={`btn-delete-role-${role.key}`}
                          onClick={() => setDeletingRoleKey(role.key)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Видалити роль"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 line-clamp-2">
                    {role.description || 'Опис відсутній для даної ролі.'}
                  </p>

                  {/* Permissions Chips */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Призначені права ({isSuperAdmin ? 'Повний доступ' : `${permCount} з ${catalog.length}`}):
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {isSuperAdmin ? (
                        <span className="px-2 py-0.8 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Суперадміністратор (всі дозволи)</span>
                        </span>
                      ) : permCount === 0 ? (
                        <span className="text-xs text-slate-400 italic">Жодного права не призначено</span>
                      ) : (
                        role.permissions.map(p => {
                          const pDef = catalog.find(item => item.code === p.permission);
                          return (
                            <span 
                              key={p.permission}
                              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              title={`${pDef?.name || p.permission} (${scopesMeta[p.scope]?.label || p.scope})`}
                            >
                              <span className="font-semibold">{pDef?.name || p.permission}</span>
                              <span className="text-slate-400 ml-1">({p.scope})</span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Статус: <strong className="text-slate-700">Активна</strong></span>
                  <button 
                    onClick={() => openEditModal(role)}
                    className="text-purple-600 hover:text-purple-800 font-medium hover:underline flex items-center gap-1"
                  >
                    <span>Матриця прав</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Create / Edit Role Permissions Matrix */}
      {(isCreatingRole || editingRole) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col my-auto">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {isCreatingRole ? 'Створення нової ролі' : `Налаштування ролі: ${editingRole?.title}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isCreatingRole 
                      ? 'Вкажіть назву, унікальний код та визначте матрицю дозволів'
                      : 'Змініть назву, опис або налаштуйте зону видимості кожного права'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => { setIsCreatingRole(false); setEditingRole(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveRole} className="p-6 space-y-6 overflow-y-auto flex-1">
              
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

              {/* Action Buttons in Modal */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
                <button
                  type="button"
                  onClick={() => { setIsCreatingRole(false); setEditingRole(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-sm font-medium transition shadow-xs disabled:opacity-50"
                >
                  {isSaving ? (
                    <span>Збереження...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isCreatingRole ? 'Створити роль' : 'Зберегти зміни'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
