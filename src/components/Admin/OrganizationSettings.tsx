import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, MapPin, Briefcase, Building2, Lock, Loader2 } from 'lucide-react';
import { DEFAULT_DEPARTMENT } from '../../../shared/departments';
import { MaterialEditDialog, FormField, FormCheckbox, FIELD_INPUT_CLASS } from './MaterialEditDialog';
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
 * Вкладка «Організація»: підрозділи, посади та локації.
 *
 * Кожен довідник показано так само, як «Користувачів»: таблиця з пошуком,
 * фільтрами, сортуванням і сторінками, а створення й редагування — окремим
 * вікном замість форми над списком.
 */

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

type Kind = 'departments' | 'positions' | 'locations';
type SortKey = 'name' | 'secondary' | 'tertiary' | 'status';

/** Рядок таблиці, зведений до спільного вигляду для всіх трьох довідників. */
interface OrgRow {
  id: string;
  name: string;
  /** Друга й третя колонки: код/порядок, підрозділ/грейд, місто/країна. */
  secondary: string;
  tertiary: string;
  isActive: boolean;
  isSystem: boolean;
  /** Для фільтра посад за підрозділом. */
  departmentId: string;
  haystack: string;
}

const KIND_META: Record<Kind, {
  tab: string;
  icon: React.ElementType;
  addLabel: string;
  editTitle: string;
  nameLabel: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  noMatchLabel: string;
}> = {
  departments: {
    tab: 'Підрозділи',
    icon: Building2,
    addLabel: 'Додати підрозділ',
    editTitle: 'Редагування підрозділу',
    nameLabel: 'Підрозділ',
    secondaryLabel: 'Код',
    tertiaryLabel: 'Порядок',
    searchPlaceholder: 'Пошук: назва або код підрозділу…',
    emptyLabel: 'Підрозділів ще немає.',
    noMatchLabel: 'За цими умовами підрозділів не знайдено.'
  },
  positions: {
    tab: 'Посади',
    icon: Briefcase,
    addLabel: 'Додати посаду',
    editTitle: 'Редагування посади',
    nameLabel: 'Посада',
    secondaryLabel: 'Підрозділ',
    tertiaryLabel: 'Грейд',
    searchPlaceholder: 'Пошук: назва посади, підрозділ, грейд…',
    emptyLabel: 'Посад ще немає.',
    noMatchLabel: 'За цими умовами посад не знайдено.'
  },
  locations: {
    tab: 'Локації',
    icon: MapPin,
    addLabel: 'Додати локацію',
    editTitle: 'Редагування локації',
    nameLabel: 'Локація',
    secondaryLabel: 'Місто',
    tertiaryLabel: 'Країна',
    searchPlaceholder: 'Пошук: назва, місто, країна…',
    emptyLabel: 'Локацій ще немає.',
    noMatchLabel: 'За цими умовами локацій не знайдено.'
  }
};

const blankDep = () => ({ name: '', code: '', order: 0, isActive: true });
const blankPos = () => ({ title: '', departmentId: '', grade: '', isActive: true });
const blankLoc = () => ({ name: '', city: '', country: '', timezone: '', isActive: true });

const refId = (value: any): string => {
  if (!value) return '';
  return String(typeof value === 'object' ? value._id || '' : value);
};

export const OrganizationSettings = () => {
  const [activeSubTab, setActiveSubTab] = useState<Kind>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loaded, setLoaded] = useState<Record<Kind, boolean>>({ departments: false, positions: false, locations: false });

  // Діалог створення / редагування
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Сервер відхиляє зміни системного підрозділу — показуємо причину, а не мовчимо.
  const [formError, setFormError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [depForm, setDepForm] = useState(blankDep);
  const [posForm, setPosForm] = useState(blankPos);
  const [locForm, setLocForm] = useState(blankLoc);

  // Пошук, фільтри, сортування й сторінки таблиці
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const { sort, onSort, page, setPage, pageSize, setPageSize } = useTableState<SortKey>(
    { key: 'name', dir: 'asc' },
    [search, statusFilter, departmentFilter, activeSubTab]
  );

  const fetchKind = useCallback(async (kind: Kind) => {
    try {
      const res = await fetch(`/api/v2/org/${kind}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (kind === 'departments') setDepartments(list);
      else if (kind === 'positions') setPositions(list);
      else setLocations(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(prev => ({ ...prev, [kind]: true }));
    }
  }, []);

  // Підрозділи потрібні й посадам (фільтр і вибір підрозділу), тож вантажимо все одразу.
  useEffect(() => {
    fetchKind('departments');
    fetchKind('positions');
    fetchKind('locations');
  }, [fetchKind]);

  const switchTab = (kind: Kind) => {
    setActiveSubTab(kind);
    setSearch('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setMsg(null);
  };

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach(d => map.set(d._id, d.name));
    return map;
  }, [departments]);

  const rows = useMemo<OrgRow[]>(() => {
    const build = (r: Omit<OrgRow, 'haystack'>): OrgRow => ({
      ...r,
      haystack: [r.name, r.secondary, r.tertiary].join(' ').toLowerCase()
    });
    if (activeSubTab === 'departments') {
      return departments.map(d => build({
        id: d._id,
        name: d.name,
        secondary: d.code || '',
        tertiary: String(d.order ?? 0),
        isActive: d.isActive !== false,
        isSystem: Boolean(d.isSystem),
        departmentId: ''
      }));
    }
    if (activeSubTab === 'positions') {
      return positions.map(p => {
        const depId = refId(p.departmentId);
        const depName = typeof p.departmentId === 'object' && p.departmentId
          ? p.departmentId.name
          : departmentNameById.get(depId) || '';
        return build({
          id: p._id,
          name: p.title,
          secondary: depName,
          tertiary: p.grade || '',
          isActive: p.isActive !== false,
          isSystem: false,
          departmentId: depId
        });
      });
    }
    return locations.map(l => build({
      id: l._id,
      name: l.name,
      secondary: l.city || '',
      tertiary: l.country || '',
      isActive: l.isActive !== false,
      isSystem: false,
      departmentId: ''
    }));
  }, [activeSubTab, departments, positions, locations, departmentNameById]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = rows.filter(r => {
      if (query && !r.haystack.includes(query)) return false;
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'inactive' && r.isActive) return false;
      if (activeSubTab === 'positions') {
        if (departmentFilter === 'none' && r.departmentId) return false;
        if (departmentFilter !== 'all' && departmentFilter !== 'none' && r.departmentId !== departmentFilter) return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case 'secondary': return compareText(a.secondary, b.secondary, sort.dir) || compareText(a.name, b.name, 'asc');
        case 'tertiary':
          // Порядок підрозділів — число, решта — текст
          if (activeSubTab === 'departments') return (Number(a.tertiary) - Number(b.tertiary)) * dir || compareText(a.name, b.name, 'asc');
          return compareText(a.tertiary, b.tertiary, sort.dir) || compareText(a.name, b.name, 'asc');
        case 'status': return (Number(b.isActive) - Number(a.isActive)) * dir || compareText(a.name, b.name, 'asc');
        default: return compareText(a.name, b.name, sort.dir);
      }
    });
    return list;
  }, [rows, search, statusFilter, departmentFilter, activeSubTab, sort]);

  const { pageCount, safePage, pageRows } = paginate(filteredRows, page, pageSize);
  const activeCount = rows.filter(r => r.isActive).length;
  const hasFilters = search.trim() !== '' || statusFilter !== 'all' || departmentFilter !== 'all';
  const meta = KIND_META[activeSubTab];

  const openCreate = () => {
    setEditingId(null);
    setFormError(null);
    if (activeSubTab === 'departments') setDepForm(blankDep());
    else if (activeSubTab === 'positions') setPosForm(blankPos());
    else setLocForm(blankLoc());
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    setFormError(null);
    if (activeSubTab === 'departments') {
      const d = departments.find(x => x._id === id);
      if (!d || d.isSystem) return;
      setDepForm({ name: d.name, code: d.code || '', order: d.order ?? 0, isActive: d.isActive !== false });
    } else if (activeSubTab === 'positions') {
      const p = positions.find(x => x._id === id);
      if (!p) return;
      setPosForm({ title: p.title, departmentId: refId(p.departmentId), grade: p.grade || '', isActive: p.isActive !== false });
    } else {
      const l = locations.find(x => x._id === id);
      if (!l) return;
      setLocForm({ name: l.name, city: l.city || '', country: l.country || '', timezone: l.timezone || '', isActive: l.isActive !== false });
    }
    setEditingId(id);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    const body = activeSubTab === 'departments'
      ? depForm
      // Порожній підрозділ не надсилаємо: сервер чекає ідентифікатор, а не порожній рядок
      : activeSubTab === 'positions'
        ? { ...posForm, departmentId: posForm.departmentId || undefined }
        : locForm;
    const name = activeSubTab === 'positions' ? posForm.title : activeSubTab === 'departments' ? depForm.name : locForm.name;
    try {
      const url = editingId ? `/api/v2/org/${activeSubTab}/${editingId}` : `/api/v2/org/${activeSubTab}`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || 'Не вдалося зберегти запис');
        return;
      }
      setMsg({ type: 'success', text: editingId ? `Зміни для «${name}» збережено.` : `«${name}» додано.` });
      closeDialog();
      fetchKind(activeSubTab);
    } catch (err) {
      console.error(err);
      setFormError('Помилка мережі при збереженні запису');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Видалити «${name}»?`)) return;
    setMsg(null);
    try {
      const res = await fetch(`/api/v2/org/${activeSubTab}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: data.error || 'Не вдалося видалити запис' });
        return;
      }
      setMsg({ type: 'success', text: `«${name}» видалено.` });
      closeDialog();
      fetchKind(activeSubTab);
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Помилка мережі при видаленні запису' });
    }
  };

  const editingName = editingId ? rows.find(r => r.id === editingId)?.name : undefined;

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Організаційна структура</h3>
          <p className="text-sm text-slate-500 mt-1">
            Керування підрозділами, посадами та локаціями.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition"
        >
          <Plus className="w-4 h-4" />
          {meta.addLabel}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_META) as Kind[]).map(kind => {
          const Icon = KIND_META[kind].icon;
          const count = kind === 'departments' ? departments.length : kind === 'positions' ? positions.length : locations.length;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => switchTab(kind)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeSubTab === kind ? 'bg-purple-100 text-purple-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {KIND_META[kind].tab}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeSubTab === kind ? 'bg-purple-200/70 text-purple-800' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {activeSubTab === 'departments' && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
          Перелік підрозділів ведеться лише тут. Завантаження інструкцій нових підрозділів не створює: ШІ обирає
          підрозділ із цього списку, а якщо впевненого збігу немає — відносить матеріал до «{DEFAULT_DEPARTMENT}».
        </p>
      )}

      {msg && <TableNotice tone={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

      {/* Панель пошуку та фільтрів */}
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch value={search} onChange={setSearch} placeholder={meta.searchPlaceholder} />
        {activeSubTab === 'positions' && (
          <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className={FILTER_CLASS} aria-label="Фільтр за підрозділом">
            <option value="all">Усі підрозділи</option>
            <option value="none">Без підрозділу</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={FILTER_CLASS} aria-label="Фільтр за статусом">
          <option value="all">Будь-який статус</option>
          <option value="active">Активні</option>
          <option value="inactive">Вимкнені</option>
        </select>
        {hasFilters && (
          <ResetFiltersButton onClick={() => { setSearch(''); setStatusFilter('all'); setDepartmentFilter('all'); }} />
        )}
        <div className="grow" />
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <meta.icon className="w-3.5 h-3.5" />
          {hasFilters ? `Знайдено ${filteredRows.length} з ${rows.length}` : `Усього ${rows.length}`}
          <span className="text-slate-300">·</span>
          активних {activeCount}
        </span>
      </div>

      {/* Таблиця */}
      <TableFrame
        head={<>
          <SortHeader label={meta.nameLabel} sortKey="name" sort={sort} onSort={onSort} />
          <SortHeader label={meta.secondaryLabel} sortKey="secondary" sort={sort} onSort={onSort} />
          <SortHeader label={meta.tertiaryLabel} sortKey="tertiary" sort={sort} onSort={onSort} className="hidden md:table-cell" />
          <SortHeader label="Статус" sortKey="status" sort={sort} onSort={onSort} />
          <th scope="col" className={`${TH_CLASS} text-right`}><span className="sr-only">Дії</span></th>
        </>}
        empty={pageRows.length === 0 && (!loaded[activeSubTab] ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Завантаження…</span>
        ) : hasFilters ? meta.noMatchLabel : meta.emptyLabel)}
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
          <tr
            key={row.id}
            onClick={row.isSystem ? undefined : () => openEdit(row.id)}
            className={`transition ${row.isSystem ? '' : 'cursor-pointer'} ${
              editingId === row.id ? 'bg-purple-50' : 'hover:bg-slate-50'
            } ${row.isActive ? '' : 'text-slate-400'}`}
          >
            <td className="px-3 py-2.5 align-top">
              <span className={`inline-flex items-center gap-2 flex-wrap font-semibold text-sm ${row.isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                {row.name}
                {row.isSystem && (
                  <span
                    title="Системний запис: до нього потрапляють матеріали без прив'язки до конкретного підрозділу"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide"
                  >
                    <Lock className="w-3 h-3" />
                    Системний
                  </span>
                )}
              </span>
            </td>
            <td className="px-3 py-2.5 align-top text-xs text-slate-700">
              {row.secondary || <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2.5 align-top text-xs text-slate-700 hidden md:table-cell">
              {row.tertiary || <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2.5 align-top">
              <StatusBadge active={row.isActive} activeLabel="Активний" inactiveLabel="Вимкнено" />
            </td>
            <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
              {row.isSystem ? (
                <span className="text-xs text-slate-400">Недоступно для змін</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); openEdit(row.id); }}
                    className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition"
                    title="Редагувати"
                    aria-label={`Редагувати ${row.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDelete(row.id, row.name); }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Видалити"
                    aria-label={`Видалити ${row.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </TableFrame>

      {/* Створення / редагування запису */}
      <MaterialEditDialog
        open={dialogOpen}
        onClose={closeDialog}
        icon={editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        iconTone="bg-purple-50 text-purple-600 border-purple-100"
        title={editingId ? meta.editTitle : meta.addLabel}
        subtitle={editingName}
        submitLabel={editingId ? 'Зберегти зміни' : 'Додати'}
        onSubmit={handleSave}
        saving={saving}
        error={formError}
        footerLeft={editingId ? (
          <button
            type="button"
            onClick={() => handleDelete(editingId, editingName || '')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 className="w-4 h-4" />
            Видалити
          </button>
        ) : undefined}
      >
        {activeSubTab === 'departments' && (
          <>
            <FormField label="Назва підрозділу" required>
              <input required type="text" value={depForm.name} onChange={e => setDepForm({ ...depForm, name: e.target.value })} className={FIELD_INPUT_CLASS} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Код">
                <input type="text" value={depForm.code} onChange={e => setDepForm({ ...depForm, code: e.target.value })} className={FIELD_INPUT_CLASS} />
              </FormField>
              <FormField label="Порядок у списках" hint="Менше число — вище у переліку підрозділів.">
                <input type="number" value={depForm.order} onChange={e => setDepForm({ ...depForm, order: Number(e.target.value) || 0 })} className={FIELD_INPUT_CLASS} />
              </FormField>
            </div>
            <FormCheckbox checked={depForm.isActive} onChange={isActive => setDepForm({ ...depForm, isActive })} label="Активний підрозділ" />
          </>
        )}

        {activeSubTab === 'positions' && (
          <>
            <FormField label="Назва посади" required>
              <input required type="text" value={posForm.title} onChange={e => setPosForm({ ...posForm, title: e.target.value })} className={FIELD_INPUT_CLASS} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Підрозділ">
                <select value={posForm.departmentId} onChange={e => setPosForm({ ...posForm, departmentId: e.target.value })} className={FIELD_INPUT_CLASS}>
                  <option value="">Не обрано</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="Грейд">
                <input type="text" value={posForm.grade} onChange={e => setPosForm({ ...posForm, grade: e.target.value })} className={FIELD_INPUT_CLASS} />
              </FormField>
            </div>
            <FormCheckbox checked={posForm.isActive} onChange={isActive => setPosForm({ ...posForm, isActive })} label="Активна посада" />
          </>
        )}

        {activeSubTab === 'locations' && (
          <>
            <FormField label="Назва локації" required>
              <input required type="text" value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} className={FIELD_INPUT_CLASS} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Місто">
                <input type="text" value={locForm.city} onChange={e => setLocForm({ ...locForm, city: e.target.value })} className={FIELD_INPUT_CLASS} />
              </FormField>
              <FormField label="Країна">
                <input type="text" value={locForm.country} onChange={e => setLocForm({ ...locForm, country: e.target.value })} className={FIELD_INPUT_CLASS} />
              </FormField>
              <FormField label="Часовий пояс" hint="Наприклад, Europe/Kyiv" className="sm:col-span-2">
                <input type="text" value={locForm.timezone} onChange={e => setLocForm({ ...locForm, timezone: e.target.value })} className={FIELD_INPUT_CLASS} />
              </FormField>
            </div>
            <FormCheckbox checked={locForm.isActive} onChange={isActive => setLocForm({ ...locForm, isActive })} label="Активна локація" />
          </>
        )}
      </MaterialEditDialog>
    </div>
  );
};
