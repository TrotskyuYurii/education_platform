import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarClock, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Bell, 
  Trash2, 
  Edit3, 
  User, 
  Building2, 
  BookOpen, 
  FileText, 
  Sparkles, 
  X,
  ChevronRight,
  TrendingUp,
  Send,
  AlertCircle
} from 'lucide-react';
import { UserSearchSelect } from './UserSearchSelect';
import { MaterialActionsMenu } from './MaterialActionsMenu';
import { 
  LearningAssignment, 
  AssignmentStats, 
  AssignmentPriority, 
  AssignmentStatus, 
  AssignmentTargetType, 
  InstructionSection 
} from '../../types';

interface AssignmentSettingsProps {
  courses: any[];
  sections: InstructionSection[];
}

interface UserOption {
  _id: string;
  username: string;
  fullName?: string;
  email?: string;
  departmentId?: string;
  departments?: string[];
}

/** Сервер віддає щонайбільше стільки користувачів за запит. */
const USERS_PAGE_LIMIT = 1000;

/**
 * Усі користувачі сторінками: інакше після першої тисячі людей частину
 * співробітників не можна було б знайти й обрати у формі призначення.
 * Повертає null, якщо перша ж сторінка не завантажилась.
 */
async function fetchAllUsers(): Promise<UserOption[] | null> {
  const all: UserOption[] = [];
  for (let skip = 0; skip < USERS_PAGE_LIMIT * 50; skip += USERS_PAGE_LIMIT) {
    const res = await fetch(`/api/admin/users?limit=${USERS_PAGE_LIMIT}&skip=${skip}`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) return skip === 0 ? null : all;
    const data = await res.json();
    const batch: UserOption[] = Array.isArray(data.users) ? data.users : [];
    all.push(...batch);
    const total = typeof data.total === 'number' ? data.total : all.length;
    if (batch.length < USERS_PAGE_LIMIT || all.length >= total) break;
  }
  return all;
}

export const AssignmentSettings: React.FC<AssignmentSettingsProps> = ({ courses, sections }) => {
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [stats, setStats] = useState<AssignmentStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    assigned: 0,
    overdue: 0,
    complianceRate: 100
  });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | AssignmentPriority>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LearningAssignment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New assignment form state
  const [targetType, setTargetType] = useState<AssignmentTargetType>('course');
  const [targetId, setTargetId] = useState<string>('');
  const [targetScope, setTargetScope] = useState<'single' | 'department' | 'all'>('single');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [priority, setPriority] = useState<AssignmentPriority>('mandatory');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');

  // Edit deadline state
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editPriority, setEditPriority] = useState<AssignmentPriority>('mandatory');
  const [editNotes, setEditNotes] = useState<string>('');

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/progress-v2/admin/assignments');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return;
      }
      const data = await res.json();
      setAssignments(data.assignments || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to load assignments', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersAndDepts = async () => {
    try {
      const [allUsers, deptRes] = await Promise.all([
        fetchAllUsers(),
        fetch('/api/v2/org/departments').catch(() => null)
      ]);
      const depts = new Set<string>();

      if (deptRes && deptRes.ok) {
        const deptData = await deptRes.json().catch(() => []);
        if (Array.isArray(deptData)) {
          deptData.forEach((d: any) => {
            const name = typeof d === 'string' ? d : d?.name;
            if (name && typeof name === 'string' && name.trim()) {
              depts.add(name.trim());
            }
          });
        }
      }

      if (allUsers) {
        setUsers(allUsers);
        allUsers.forEach((u: any) => {
          if (u.departmentId) {
            const name = typeof u.departmentId === 'object' ? u.departmentId?.name : null;
            if (name && typeof name === 'string' && name.trim()) {
              depts.add(name.trim());
            }
          }
          if (Array.isArray(u.departments)) {
            u.departments.forEach((d: any) => {
              const name = typeof d === 'string' ? d : d?.name;
              if (name && typeof name === 'string' && name.trim()) {
                depts.add(name.trim());
              }
            });
          }
        });
      }
      setDepartments(Array.from(depts).filter(Boolean).sort((a, b) => a.localeCompare(b, 'uk')));
    } catch (err) {
      console.error('Failed to load users for assignment', err);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchUsersAndDepts();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMessage({ text, type });
    setTimeout(() => setNotificationMessage(null), 4000);
  };

  // Helper for quick deadline buttons
  const setQuickDeadline = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split('T')[0]);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      showToast('Оберіть матеріал для призначення', 'error');
      return;
    }
    if (targetScope === 'single' && !selectedUserId) {
      showToast('Оберіть співробітника', 'error');
      return;
    }
    if (targetScope === 'department' && !selectedDepartment) {
      showToast('Оберіть підрозділ', 'error');
      return;
    }
    if (!dueDate) {
      showToast('Вкажіть дедлайн виконання', 'error');
      return;
    }

    let itemTitle = '';
    if (targetType === 'course') {
      const c = courses.find(item => item.id === targetId);
      itemTitle = c ? c.title : 'Курс';
    } else {
      const s = sections.find(item => item.id === targetId);
      itemTitle = s ? s.title : 'Інструкція';
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/progress-v2/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          title: itemTitle,
          targetScope,
          userId: targetScope === 'single' ? selectedUserId : undefined,
          department: targetScope === 'department' ? selectedDepartment : undefined,
          dueDate,
          priority,
          notes
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Успішно призначено: ${data.count} співробітникам!`, 'success');
        setIsCreateModalOpen(false);
        // Reset form
        setTargetId('');
        setNotes('');
        setSelectedUserId('');
        setSelectedDepartment('');
        fetchAssignments();
      } else {
        showToast(data.error || 'Помилка при створенні призначення', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Помилка мережі', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAssignment) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/progress-v2/admin/assignments/${editingAssignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: editDueDate,
          priority: editPriority,
          notes: editNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Дедлайн та налаштування призначення оновлено', 'success');
        setEditingAssignment(null);
        fetchAssignments();
      } else {
        showToast(data.error || 'Помилка оновлення', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Помилка мережі', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReminder = async (assignment: LearningAssignment) => {
    try {
      const res = await fetch(`/api/progress-v2/admin/assignments/${assignment.id}/remind`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`Нагадування надіслано для ${assignment.user?.fullName || assignment.user?.username || 'співробітника'}!`, 'success');
      } else {
        showToast('Помилка надсилання нагадування', 'error');
      }
    } catch (err) {
      showToast('Помилка сервера', 'error');
    }
  };

  // Підтвердження скасування питає меню «Дії» рядка.
  const handleDeleteAssignment = async (assignment: LearningAssignment) => {
    try {
      const res = await fetch(`/api/progress-v2/admin/assignments/${assignment.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Призначення успішно скасовано', 'success');
        fetchAssignments();
      } else {
        showToast('Не вдалося скасувати призначення', 'error');
      }
    } catch (err) {
      showToast('Помилка сервера', 'error');
    }
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const userName = (item.user?.fullName || '').toLowerCase();
        const userEmail = (item.user?.email || item.user?.username || '').toLowerCase();
        const itemTitle = (item.title || '').toLowerCase();
        const itemDept = (item.department || '').toLowerCase();
        if (!userName.includes(q) && !userEmail.includes(q) && !itemTitle.includes(q) && !itemDept.includes(q)) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        if (item.status !== statusFilter) return false;
      }

      // Priority
      if (priorityFilter !== 'all') {
        if (item.priority !== priorityFilter) return false;
      }

      // Department
      if (deptFilter !== 'all') {
        if (item.department !== deptFilter && item.user?.department !== deptFilter) return false;
      }

      return true;
    });
  }, [assignments, searchQuery, statusFilter, priorityFilter, deptFilter]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {notificationMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition animate-in fade-in duration-200 ${
          notificationMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {notificationMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{notificationMessage.text}</span>
          <button onClick={() => setNotificationMessage(null)} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Title and Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              <CalendarClock className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Рушій обов'язкових призначень та дедлайнів
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Керування обов'язковими курсами, контроль строків виконання, своєчасні нагадування та аналіз дотримання дедлайнів.
          </p>
        </div>

        <button
          id="btn-open-create-assignment"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Призначити навчання</span>
        </button>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 xl:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-slate-500 text-xs font-medium mb-1.5">
            <span className="truncate">Всього призначень</span>
            <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">активних та виконаних</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-emerald-600 text-xs font-medium mb-1.5">
            <span className="truncate">Виконано вчасно</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.completed}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            Рівень дисципліни: {stats.complianceRate}%
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-blue-600 text-xs font-medium mb-1.5">
            <span className="truncate">В процесі</span>
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.inProgress}</div>
          <div className="text-[11px] text-blue-600 mt-1">активно вивчають</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-amber-600 text-xs font-medium mb-1.5">
            <span className="truncate">Очікують початку</span>
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.assigned}</div>
          <div className="text-[11px] text-amber-600 mt-1">призначено співробітникам</div>
        </div>

        <div className={`rounded-xl border p-4 shadow-2xs ${
          stats.overdue > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between gap-2 text-rose-600 text-xs font-medium mb-1.5">
            <span className="truncate">Прострочено!</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          </div>
          <div className="text-2xl font-black text-rose-700">{stats.overdue}</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">
            {stats.overdue > 0 ? 'Потребують нагадування' : 'Всі дедлайни дотримано'}
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative grow lg:max-w-md xl:max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Пошук за співробітником, email або назвою..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Усі статуси ({assignments.length})</option>
            <option value="overdue">Прострочені ({stats.overdue})</option>
            <option value="assigned">Очікують ({stats.assigned})</option>
            <option value="in_progress">В процесі ({stats.inProgress})</option>
            <option value="completed">Виконані ({stats.completed})</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as any)}
            className="text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Будь-який пріоритет</option>
            <option value="critical">🚨 Критичний</option>
            <option value="mandatory">📌 Обов'язковий</option>
            <option value="recommended">💡 Рекомендований</option>
          </select>

          {/* Department Filter */}
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Усі підрозділи</option>
              {departments.map((d, idx) => {
                const label = typeof d === 'string' ? d : ((d as any)?.name || String(d));
                return (
                  <option key={`dept-filter-${label}-${idx}`} value={label}>{label}</option>
                );
              })}
            </select>
          )}

          <button
            onClick={fetchAssignments}
            className="text-xs font-medium px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Оновити список"
          >
            Оновити
          </button>
        </div>
      </div>

      {/* Table of Assignments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Завантаження журналу призначень...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarClock className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
            <p className="font-semibold text-slate-700">Призначень не знайдено</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              За вказаними критеріями фільтрації немає записів. Створіть перше призначення або змініть фільтри.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-[26%]">Співробітник</th>
                  <th className="py-3 px-4 w-[26%]">Матеріал</th>
                  <th className="py-3 px-4 w-[13%]">Пріоритет</th>
                  <th className="py-3 px-4 w-[15%]">Дедлайн</th>
                  <th className="py-3 px-4 w-[13%]">Статус</th>
                  <th className="py-3 px-4 w-[7%] text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map(a => {
                  const isOverdue = a.status === 'overdue' || (a.status !== 'completed' && (a.daysRemaining || 0) < 0);
                  const isCompleted = a.status === 'completed';

                  return (
                    <tr key={a.id} className={`hover:bg-slate-50/70 transition ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                      {/* Employee Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {a.user?.fullName ? a.user.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 leading-tight truncate">
                              {a.user?.fullName || a.user?.username || 'Співробітник'}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 min-w-0">
                              <span className="truncate">{a.user?.email || a.user?.username}</span>
                              {a.department && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400 truncate">{a.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Material */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2 min-w-0">
                          {a.targetType === 'course' ? (
                            <BookOpen className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate">
                              {a.title}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {a.targetType === 'course' ? 'Навчальний курс' : 'Регламент'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        {a.priority === 'critical' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                            🚨 Критичний
                          </span>
                        )}
                        {a.priority === 'mandatory' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                            📌 Обов'язковий
                          </span>
                        )}
                        {a.priority === 'recommended' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 whitespace-nowrap">
                            💡 Рекомендовано
                          </span>
                        )}
                      </td>

                      {/* Deadline & Remaining */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {new Date(a.dueDate).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="text-[11px] mt-0.5 whitespace-nowrap">
                            {isCompleted ? (
                              <span className="text-emerald-600 font-medium">Виконано вчасно</span>
                            ) : isOverdue ? (
                              <span className="text-rose-600 font-bold">
                                Прострочено на {Math.abs(a.daysRemaining || 0)} дн.
                              </span>
                            ) : (
                              <span className={a.daysRemaining && a.daysRemaining <= 2 ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                                Залишилось: {a.daysRemaining} дн.
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isCompleted && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Завершено {a.score !== undefined ? `(${a.score}%)` : ''}</span>
                          </div>
                        )}
                        {!isCompleted && isOverdue && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 whitespace-nowrap">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Прострочено</span>
                          </div>
                        )}
                        {!isCompleted && !isOverdue && a.status === 'in_progress' && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5" />
                            <span>В процесі</span>
                          </div>
                        )}
                        {!isCompleted && !isOverdue && a.status === 'assigned' && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Очікує початку</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <MaterialActionsMenu
                            itemLabel={a.title}
                            actions={[
                              {
                                key: 'remind',
                                label: 'Надіслати нагадування',
                                hint: 'Лист співробітнику про дедлайн',
                                icon: Bell,
                                disabled: isCompleted,
                                disabledReason: 'Призначення вже виконано',
                                onSelect: () => handleSendReminder(a)
                              },
                              {
                                key: 'edit',
                                label: 'Змінити призначення',
                                hint: 'Дедлайн, пріоритет, примітки',
                                icon: Edit3,
                                onSelect: () => {
                                  setEditingAssignment(a);
                                  setEditDueDate(a.dueDate.split('T')[0]);
                                  setEditPriority(a.priority);
                                  setEditNotes(a.notes || '');
                                }
                              },
                              {
                                key: 'cancel',
                                danger: true,
                                label: 'Скасувати призначення',
                                icon: Trash2,
                                confirm: {
                                  question: `Скасувати призначення «${a.title}»?`,
                                  details: `Співробітник: ${a.user?.fullName || a.user?.username || '—'}.`,
                                  confirmLabel: 'Скасувати призначення'
                                },
                                onSelect: () => handleDeleteAssignment(a)
                              }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Assignment */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Призначити обов'язкове навчання</h3>
                  <p className="text-xs text-slate-500">Автоматичне створення завдань, дедлайнів та сповіщень</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAssignment} className="p-6 overflow-y-auto space-y-4">
              {/* 1. Target Material Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Тип навчального матеріалу
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setTargetType('course'); setTargetId(''); }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition ${
                      targetType === 'course'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Повний курс ({courses.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTargetType('instruction'); setTargetId(''); }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition ${
                      targetType === 'instruction'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Окремий регламент ({sections.length})</span>
                  </button>
                </div>
              </div>

              {/* Material Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Оберіть конкретний {targetType === 'course' ? 'курс' : 'регламент'} *
                </label>
                <select
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  required
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Оберіть зі списку --</option>
                  {targetType === 'course' ? (
                    courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.instructionIds?.length || 0} тем)
                      </option>
                    ))
                  ) : (
                    sections.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 2. Target Scope */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Кому призначити
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetScope('single')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center ${
                      targetScope === 'single'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Співробітник
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('department')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center ${
                      targetScope === 'department'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Підрозділ
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('all')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center ${
                      targetScope === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Вся компанія
                  </button>
                </div>
              </div>

              {/* Target Selector */}
              {targetScope === 'single' && (
                <div>
                  <label htmlFor="assignment-user-search" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Оберіть співробітника *
                  </label>
                  <UserSearchSelect
                    inputId="assignment-user-search"
                    users={users}
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Почніть вводити частину ПІБ, email або логіна — список відфільтрується.</p>
                </div>
              )}

              {targetScope === 'department' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Оберіть підрозділ *
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={e => setSelectedDepartment(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Оберіть відділ --</option>
                    {departments.map((d, idx) => {
                      const label = typeof d === 'string' ? d : ((d as any)?.name || String(d));
                      return (
                        <option key={`dept-opt-${label}-${idx}`} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* 3. Priority & Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Пріоритет
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="mandatory">📌 Обов'язковий (За замовчуванням)</option>
                    <option value="critical">🚨 Критичний / Терміновий</option>
                    <option value="recommended">💡 Рекомендований</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Дедлайн виконання *
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickDeadline(3)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                    >
                      +3 дні
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDeadline(7)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                    >
                      +7 днів
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDeadline(14)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                    >
                      +14 днів
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDeadline(30)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                    >
                      +1 місяць
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Manager's Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Вказівка / Коментар керівника (необов'язково)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Наприклад: Обов'язково скласти тест перед самостійною роботою в РМК..."
                  rows={2}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Збереження...' : 'Призначити зараз'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Assignment Deadline */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Редагувати дедлайн призначення</h3>
              <button
                onClick={() => setEditingAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-500">Матеріал:</div>
                <div className="font-bold text-slate-900 line-clamp-1">{editingAssignment.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Співробітник: <strong>{editingAssignment.user?.fullName || editingAssignment.user?.username}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Новий дедлайн *
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Пріоритет
                </label>
                <select
                  value={editPriority}
                  onChange={e => setEditPriority(e.target.value as any)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="mandatory">📌 Обов'язковий</option>
                  <option value="critical">🚨 Критичний / Терміновий</option>
                  <option value="recommended">💡 Рекомендований</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Вказівка керівника
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Збереження...' : 'Зберегти зміни'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
