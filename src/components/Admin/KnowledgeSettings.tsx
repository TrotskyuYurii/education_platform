import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  BookOpen, 
  Layers, 
  GitBranch, 
  History, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Archive, 
  RotateCcw, 
  FileText, 
  Sparkles, 
  Check, 
  X, 
  Building2, 
  Tag, 
  ChevronRight, 
  Eye, 
  Calendar, 
  User, 
  RefreshCw,
  Search,
  Package,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  Users
} from 'lucide-react';
import { KnowledgeSpace, InstructionSection, InstructionVersion, DocumentStatus, KnowledgeMetrics } from '../../types';

interface KnowledgeSettingsProps {
  spaces: KnowledgeSpace[];
  sections: InstructionSection[];
  onRefresh: () => Promise<void>;
}

export const KnowledgeSettings: React.FC<KnowledgeSettingsProps> = ({
  spaces,
  sections,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'spaces' | 'lifecycle' | 'versions'>('spaces');
  const [metrics, setMetrics] = useState<KnowledgeMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Space Modal State
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<KnowledgeSpace | null>(null);
  const [spaceFormData, setSpaceFormData] = useState({
    name: '',
    id: '',
    code: '',
    description: '',
    icon: 'BookOpen',
    color: 'blue',
    department: '',
    order: 10,
    isActive: true
  });
  const [savingSpace, setSavingSpace] = useState(false);
  const [deletingSpaceId, setDeletingSpaceId] = useState<string | null>(null);

  // Version History Modal State
  const [selectedSectionForVersions, setSelectedSectionForVersions] = useState<InstructionSection | null>(null);
  const [versionsList, setVersionsList] = useState<InstructionVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<InstructionVersion | null>(null);
  const [restoringVersionNumber, setRestoringVersionNumber] = useState<number | null>(null);

  // Status Change Dialog State
  const [statusDialogSection, setStatusDialogSection] = useState<InstructionSection | null>(null);
  const [targetStatus, setTargetStatus] = useState<DocumentStatus>('published');
  const [statusReviewNotes, setStatusReviewNotes] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // New Version Dialog State
  const [newVersionSection, setNewVersionSection] = useState<InstructionSection | null>(null);
  const [incrementType, setIncrementType] = useState<'minor' | 'major'>('minor');
  const [changeSummaryText, setChangeSummaryText] = useState('');
  const [newVersionStatus, setNewVersionStatus] = useState<DocumentStatus>('published');
  const [publishingNewVersion, setPublishingNewVersion] = useState(false);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/v2/knowledge/metrics');
      const data = await res.json();
      if (res.ok && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge metrics', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [spaces, sections]);

  const handleOpenCreateSpace = () => {
    setEditingSpace(null);
    setSpaceFormData({
      name: '',
      id: '',
      code: '',
      description: '',
      icon: 'BookOpen',
      color: 'blue',
      department: '',
      order: (spaces.length + 1) * 5,
      isActive: true
    });
    setIsSpaceModalOpen(true);
  };

  const handleOpenEditSpace = (space: KnowledgeSpace) => {
    setEditingSpace(space);
    setSpaceFormData({
      name: space.name,
      id: space.id,
      code: space.code || '',
      description: space.description || '',
      icon: space.icon || 'BookOpen',
      color: space.color || 'blue',
      department: space.department || '',
      order: space.order || 10,
      isActive: space.isActive !== false
    });
    setIsSpaceModalOpen(true);
  };

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceFormData.name.trim()) {
      alert('Будь ласка, введіть назву простору');
      return;
    }

    setSavingSpace(true);
    try {
      if (editingSpace) {
        const res = await fetch(`/api/v2/knowledge/spaces/${editingSpace.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spaceFormData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Помилка оновлення');
        }
      } else {
        const res = await fetch('/api/v2/knowledge/spaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spaceFormData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Помилка створення');
        }
      }

      await onRefresh();
      setIsSpaceModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Помилка збереження простору');
    } finally {
      setSavingSpace(false);
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цей простір? Усі матеріали з нього буде автоматично перенесено в «Загальнокорпоративний простір».')) {
      return;
    }

    setDeletingSpaceId(spaceId);
    try {
      const res = await fetch(`/api/v2/knowledge/spaces/${spaceId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Не вдалося видалити простір');
      }
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingSpaceId(null);
    }
  };

  const handleOpenVersions = async (sec: InstructionSection) => {
    setSelectedSectionForVersions(sec);
    setLoadingVersions(true);
    setPreviewVersion(null);
    try {
      const res = await fetch(`/api/v2/knowledge/sections/${sec.id}/versions`);
      const data = await res.json();
      if (res.ok) {
        setVersionsList(data.versions || []);
      }
    } catch (err) {
      console.error(err);
      alert('Не вдалося завантажити ревізії');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!selectedSectionForVersions) return;
    if (!confirm(`Відновити зміст регламенту до стану ревізії №${versionNumber}? Буде створено нову ревізію з відновленими даними.`)) {
      return;
    }

    setRestoringVersionNumber(versionNumber);
    try {
      const res = await fetch(`/api/v2/knowledge/sections/${selectedSectionForVersions.id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка відновлення');

      await onRefresh();
      // Refresh versions list
      await handleOpenVersions(selectedSectionForVersions);
      alert(`Регламент успішно відновлено до версії v${data.restoredFromVersion}!`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRestoringVersionNumber(null);
    }
  };

  const handleOpenStatusDialog = (sec: InstructionSection) => {
    setStatusDialogSection(sec);
    setTargetStatus(sec.status || 'published');
    setStatusReviewNotes(sec.reviewNotes || '');
  };

  const handleSaveStatus = async () => {
    if (!statusDialogSection) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/v2/knowledge/sections/${statusDialogSection.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          reviewNotes: statusReviewNotes
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Помилка оновлення статусу');
      }
      await onRefresh();
      setStatusDialogSection(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleOpenNewVersionDialog = (sec: InstructionSection) => {
    setNewVersionSection(sec);
    setIncrementType('minor');
    setChangeSummaryText('');
    setNewVersionStatus(sec.status || 'published');
  };

  const handlePublishNewVersion = async () => {
    if (!newVersionSection) return;
    if (!changeSummaryText.trim()) {
      alert('Будь ласка, вкажіть опис змін для нової ревізії');
      return;
    }

    setPublishingNewVersion(true);
    try {
      const res = await fetch(`/api/v2/knowledge/sections/${newVersionSection.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionUpdate: {
            status: newVersionStatus
          },
          incrementType,
          changeSummary: changeSummaryText,
          status: newVersionStatus
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Помилка створення нової версії');
      }
      await onRefresh();
      setNewVersionSection(null);
      alert('Нову ревізію регламенту успішно зареєстровано!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishingNewVersion(false);
    }
  };

  // Helper colors and icons
  const getSpaceColorClass = (color?: string) => {
    switch (color) {
      case 'amber': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'emerald': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'purple': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'rose': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'indigo': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'cyan': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const renderSpaceIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Package': return <Package className="w-5 h-5" />;
      case 'TrendingUp': return <TrendingUp className="w-5 h-5" />;
      case 'CreditCard': return <CreditCard className="w-5 h-5" />;
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5" />;
      case 'Users': return <Users className="w-5 h-5" />;
      case 'FolderTree': return <FolderTree className="w-5 h-5" />;
      default: return <BookOpen className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status?: DocumentStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" /> Чернетка
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <AlertCircle className="w-3 h-3 text-blue-500" /> На погодженні
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Archive className="w-3 h-3 text-rose-500" /> Архів
          </span>
        );
      case 'published':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Опубліковано
          </span>
        );
    }
  };

  // Filtered sections for lifecycle management
  const filteredSections = sections.filter(sec => {
    const matchesSearch = !searchQuery || 
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sec.department && sec.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sec.changeLog && sec.changeLog.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSpace = selectedSpaceFilter === 'all' || sec.spaceId === selectedSpaceFilter;
    const matchesStatus = selectedStatusFilter === 'all' || (sec.status || 'published') === selectedStatusFilter;

    return matchesSearch && matchesSpace && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <FolderTree className="w-4 h-4 text-blue-600" /> Простори знань
          </div>
          <div className="text-2xl font-black text-slate-900">{spaces.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Активних робочих областей</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Опубліковано
          </div>
          <div className="text-2xl font-black text-emerald-600">{metrics?.publishedCount ?? sections.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Діючих регламентів</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4 text-blue-600" /> На погодженні
          </div>
          <div className="text-2xl font-black text-blue-600">{metrics?.inReviewCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Очікують затвердження</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4 text-slate-600" /> В чернетках
          </div>
          <div className="text-2xl font-black text-slate-700">{metrics?.draftCount ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Внутрішні редакції</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <History className="w-4 h-4 text-purple-600" /> Ревізії та версії
          </div>
          <div className="text-2xl font-black text-purple-600">{metrics?.totalRevisions ?? sections.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Збережених зліпків</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('spaces')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'spaces'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" /> Простори знань ({spaces.length})
          </button>
          <button
            onClick={() => setActiveSubTab('lifecycle')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'lifecycle'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" /> Статуси та версії ({sections.length})
          </button>
        </div>

        {activeSubTab === 'spaces' && (
          <button
            onClick={handleOpenCreateSpace}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Додати простір
          </button>
        )}
      </div>

      {/* TAB 1: SPACES MANAGEMENT */}
      {activeSubTab === 'spaces' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map(sp => {
            const colorClass = getSpaceColorClass(sp.color);
            return (
              <div
                key={sp.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClass}`}>
                        {renderSpaceIcon(sp.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-base">{sp.name}</h4>
                          {sp.isDefault && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Базовий
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          ID: {sp.id} {sp.code ? `• [${sp.code}]` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {sp.description && (
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      {sp.description}
                    </p>
                  )}

                  {sp.department && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Підрозділ: <b>{sp.department}</b></span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>Регламентів: <b>{sp.stats?.totalInstructions ?? 0}</b></span>
                    <span>Курсів: <b>{sp.stats?.totalCourses ?? 0}</b></span>
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenEditSpace(sp)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Редагувати простір"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!sp.isDefault && (
                      <button
                        onClick={() => handleDeleteSpace(sp.id)}
                        disabled={deletingSpaceId === sp.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Видалити простір"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: LIFECYCLE, VERSIONS & REVISIONS */}
      {activeSubTab === 'lifecycle' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Пошук за назвою, підрозділом або описом змін..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedSpaceFilter}
                onChange={e => setSelectedSpaceFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Усі простори</option>
                {spaces.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={e => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">Усі статуси</option>
                <option value="published">Опубліковано</option>
                <option value="in_review">На погодженні</option>
                <option value="draft">Чернетки</option>
                <option value="archived">В архіві</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Регламент / Інструкція</th>
                    <th className="p-4">Простір</th>
                    <th className="p-4">Версія</th>
                    <th className="p-4">Статус</th>
                    <th className="p-4">Остання ревізія</th>
                    <th className="p-4 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSections.map(sec => {
                    const space = spaces.find(s => s.id === sec.spaceId) || spaces[0];
                    return (
                      <tr key={sec.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 max-w-sm">
                          <div className="font-bold text-slate-900 line-clamp-1">{sec.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {sec.department || 'Загальний'} • {sec.readTimeMin || 5} хв
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getSpaceColorClass(space?.color)}`}>
                            {renderSpaceIcon(space?.icon)}
                            <span className="truncate max-w-[130px]">{space?.name || 'Загальний'}</span>
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold text-xs">
                            <GitBranch className="w-3 h-3" /> v{sec.version || '1.0'}
                          </span>
                        </td>
                        <td className="p-4">
                          {getStatusBadge(sec.status)}
                        </td>
                        <td className="p-4 text-slate-500 text-[11px]">
                          <div className="font-medium text-slate-700">{sec.changeLog || 'Початкова редакція'}</div>
                          {sec.lastReviewedAt && (
                            <div className="text-slate-400 mt-0.5">
                              {new Date(sec.lastReviewedAt).toLocaleDateString('uk-UA')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenStatusDialog(sec)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                              title="Змінити життєвий цикл / статус"
                            >
                              Статус
                            </button>
                            <button
                              onClick={() => handleOpenNewVersionDialog(sec)}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition"
                              title="Створити нову редакцію (increment)"
                            >
                              + Версія
                            </button>
                            <button
                              onClick={() => handleOpenVersions(sec)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Історія ревізій"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSections.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Не знайдено регламентів за вказаними фільтрами
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SPACE MODAL (CREATE / EDIT) */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <h3 className="font-extrabold text-slate-900 text-lg">
                {editingSpace ? 'Редагувати простір знань' : 'Створити новий простір знань'}
              </h3>
              <button
                onClick={() => setIsSpaceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpace} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Назва простору *</label>
                <input
                  type="text"
                  required
                  value={spaceFormData.name}
                  onChange={e => setSpaceFormData({ ...spaceFormData, name: e.target.value })}
                  placeholder="напр., Склад та логістика"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Код простору (префікс)</label>
                  <input
                    type="text"
                    value={spaceFormData.code}
                    onChange={e => setSpaceFormData({ ...spaceFormData, code: e.target.value.toUpperCase() })}
                    placeholder="напр., LOG"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Порядок сортування</label>
                  <input
                    type="number"
                    value={spaceFormData.order}
                    onChange={e => setSpaceFormData({ ...spaceFormData, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Опис призначення простору</label>
                <textarea
                  rows={2}
                  value={spaceFormData.description}
                  onChange={e => setSpaceFormData({ ...spaceFormData, description: e.target.value })}
                  placeholder="Коротко опишіть, які матеріали та для яких підрозділів тут зберігаються"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Іконка</label>
                  <select
                    value={spaceFormData.icon}
                    onChange={e => setSpaceFormData({ ...spaceFormData, icon: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="BookOpen">📖 Книга (Загальний)</option>
                    <option value="Package">📦 Пакунок / Склад</option>
                    <option value="TrendingUp">📈 Продажі / Ріст</option>
                    <option value="CreditCard">💳 Фінанси / Каса</option>
                    <option value="ShieldCheck">🛡️ IT / Безпека</option>
                    <option value="Users">👥 Команда / HR</option>
                    <option value="FolderTree">📁 Каталог знань</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Колір маркування</label>
                  <select
                    value={spaceFormData.color}
                    onChange={e => setSpaceFormData({ ...spaceFormData, color: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="blue">Синій (Корпоративний)</option>
                    <option value="amber">Бурштиновий (Склад)</option>
                    <option value="emerald">Смарагдовий (Фінанси)</option>
                    <option value="purple">Фіолетовий (Продажі)</option>
                    <option value="indigo">Індиго (IT та системи)</option>
                    <option value="rose">Червоний (Безпека)</option>
                    <option value="cyan">Бірюзовий (Сервіс)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Прив'язка до підрозділу компанії</label>
                <input
                  type="text"
                  value={spaceFormData.department}
                  onChange={e => setSpaceFormData({ ...spaceFormData, department: e.target.value })}
                  placeholder="напр., Складська логістика або Бухгалтерія"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setIsSpaceModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={savingSpace}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {savingSpace ? 'Збереження...' : (editingSpace ? 'Зберегти зміни' : 'Створити простір')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERSION HISTORY MODAL */}
      {selectedSectionForVersions && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    Історія ревізій
                  </span>
                  <span className="text-xs text-slate-400 font-mono">ID: {selectedSectionForVersions.id}</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                  {selectedSectionForVersions.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSectionForVersions(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6 pr-1">
              {/* Versions List */}
              <div className="md:col-span-5 space-y-2.5 border-r border-slate-100 pr-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Всі редакції ({versionsList.length})
                </h4>

                {loadingVersions && (
                  <div className="p-8 text-center text-slate-400 text-xs">Завантаження ревізій...</div>
                )}

                {!loadingVersions && versionsList.map((ver, idx) => {
                  const isSelected = previewVersion?.versionNumber === ver.versionNumber;
                  const isCurrent = idx === 0;

                  return (
                    <div
                      key={ver.versionNumber}
                      onClick={() => setPreviewVersion(ver)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded">
                            v{ver.version}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Поточна
                            </span>
                          )}
                        </div>
                        {getStatusBadge(ver.status)}
                      </div>

                      <div className="font-semibold text-slate-800 line-clamp-2 mb-1.5">
                        {ver.changeSummary || 'Оновлення регламенту'}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-100">
                        <span>{ver.authorName || 'Адміністратор'}</span>
                        <span>{new Date(ver.createdAt).toLocaleDateString('uk-UA')}</span>
                      </div>

                      {!isCurrent && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreVersion(ver.versionNumber);
                            }}
                            disabled={restoringVersionNumber === ver.versionNumber}
                            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded transition"
                          >
                            <RotateCcw className="w-3 h-3" /> Відновити цю версію
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Version Snapshot Preview */}
              <div className="md:col-span-7 pl-2">
                {previewVersion ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="text-xs text-slate-400">Перегляд зліпка версії:</div>
                        <div className="font-extrabold text-slate-900 text-sm font-mono">
                          Версія v{previewVersion.version} (ревізія #{previewVersion.versionNumber})
                        </div>
                      </div>
                      {getStatusBadge(previewVersion.status)}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[11px] text-slate-500 font-semibold">Опис внесених змін:</div>
                      <div className="text-slate-800 font-medium">{previewVersion.changeSummary || 'Не вказано'}</div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Заголовок:</div>
                      <div className="font-bold text-slate-900 text-sm">{previewVersion.title}</div>
                      {previewVersion.subtitle && (
                        <div className="text-slate-500 italic mt-0.5">{previewVersion.subtitle}</div>
                      )}
                    </div>

                    {previewVersion.summary && (
                      <div>
                        <div className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Короткий зміст:</div>
                        <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                          {previewVersion.summary}
                        </p>
                      </div>
                    )}

                    {previewVersion.keyPoints && previewVersion.keyPoints.length > 0 && (
                      <div>
                        <div className="text-[11px] text-slate-400 font-semibold uppercase mb-1">Ключові тези:</div>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {previewVersion.keyPoints.map((kp, i) => (
                            <li key={i}>{kp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {previewVersion.stopRules && previewVersion.stopRules.length > 0 && (
                      <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                        <div className="text-[11px] text-rose-800 font-bold uppercase mb-1">Стоп-правила в цій версії:</div>
                        <ul className="list-disc pl-4 space-y-0.5 text-rose-900 text-[11px]">
                          {previewVersion.stopRules.map((sr, i) => (
                            <li key={i}>{sr}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
                    <FileText className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
                    Оберіть ревізію зі списку ліворуч, щоб переглянути детальний зліпок змісту
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CHANGE DIALOG */}
      {statusDialogSection && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                Зміна статусу регламенту
              </h3>
              <button onClick={() => setStatusDialogSection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 line-clamp-1">{statusDialogSection.title}</div>
                <div className="text-slate-500 mt-1">
                  Поточний статус: {getStatusBadge(statusDialogSection.status)}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Новий статус життєвого циклу:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStatus('published')}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                      targetStatus === 'published' 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Опубліковано
                    </div>
                    <div className="text-[10px] font-normal text-slate-500">Доступний всім співробітникам</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('in_review')}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                      targetStatus === 'in_review' 
                        ? 'border-blue-500 bg-blue-50 text-blue-800' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-600" /> На погодженні
                    </div>
                    <div className="text-[10px] font-normal text-slate-500">Очікує перевірки керівником</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('draft')}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                      targetStatus === 'draft' 
                        ? 'border-slate-500 bg-slate-100 text-slate-800' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-600" /> Чернетка
                    </div>
                    <div className="text-[10px] font-normal text-slate-500">Внутрішня розробка автором</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('archived')}
                    className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                      targetStatus === 'archived' 
                        ? 'border-rose-500 bg-rose-50 text-rose-800' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Archive className="w-3.5 h-3.5 text-rose-600" /> В архів
                    </div>
                    <div className="text-[10px] font-normal text-slate-500">Втратив чинність або застарів</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Коментар рецензента / примітка:</label>
                <textarea
                  rows={2}
                  value={statusReviewNotes}
                  onChange={e => setStatusReviewNotes(e.target.value)}
                  placeholder="Вкажіть причину зміни статусу або вимоги для доопрацювання..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusDialogSection(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {savingStatus ? 'Збереження...' : 'Застосувати статус'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW VERSION DIALOG */}
      {newVersionSection && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                Реєстрація нової редакції регламенту
              </h3>
              <button onClick={() => setNewVersionSection(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-slate-400 text-[11px]">Поточна версія:</div>
                <div className="font-mono font-bold text-purple-700 text-sm">
                  v{newVersionSection.version || '1.0'} (ревізія #{newVersionSection.versionNumber || 1})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Тип інкременту версії:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIncrementType('minor')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      incrementType === 'minor'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono">Minor (v1.1 → v1.2)</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">Уточнення, виправлення, доповнення</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncrementType('major')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      incrementType === 'major'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono">Major (v1.X → v2.0)</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">Глобальна реформа регламенту</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Опис змін (ChangeLog) *</label>
                <textarea
                  rows={2}
                  required
                  value={changeSummaryText}
                  onChange={e => setChangeSummaryText(e.target.value)}
                  placeholder="напр., Оновлено перелік обов'язкових документів для інкасації..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewVersionSection(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handlePublishNewVersion}
                  disabled={publishingNewVersion}
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-sm disabled:opacity-50"
                >
                  {publishingNewVersion ? 'Створення...' : 'Зафіксувати ревізію'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
