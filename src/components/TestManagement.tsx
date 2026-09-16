import { OrganizationSettings } from './Admin/OrganizationSettings';
import { RoleSettings } from './Admin/RoleSettings';
import { KnowledgeSettings } from './Admin/KnowledgeSettings';
import { AssignmentSettings } from './Admin/AssignmentSettings';
import { NotificationTemplates } from './Admin/NotificationTemplates';
import { AnalyticsReports } from './Analytics/AnalyticsReports';
import { useAuth } from '../context/AuthContext';
import React, { useState, useRef } from 'react';
import { InstructionSection, QuizQuestion, KnowledgeSpace } from '../types';
import { TEMPLATE_MD, AI_PROMPT_GUIDE, parseMarkdown, exportToMarkdown } from '../utils/markdownParser';
import { MarkdownEditor } from './MarkdownEditor';
import { 
  Download, 
  Upload, 
  FileText, 
  HelpCircle, 
  Settings2, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileDown,
  List,
  Trash2,
  Users,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Edit2,
  Briefcase,
  ChevronDown,
  Building2,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  Search,
  FolderTree,
  GitBranch,
  CalendarClock,
  Bell,
  BarChart3
} from 'lucide-react';

interface TestManagementProps {
  sections: InstructionSection[];
  questions: QuizQuestion[];
  courses: any[];
  cases: any[];
  spaces?: KnowledgeSpace[];
  onImport: (newSections: InstructionSection[], newQuestions: QuizQuestion[], replace: boolean) => void;
  onReset: () => void;
  isSetupMode?: boolean;
  onRefresh?: () => Promise<void>;
}

type MgmtTab = 'list' | 'courses' | 'cases' | 'knowledge' | 'assignments' | 'import' | 'export' | 'help' | 'users' | 'roles' | 'organization' | 'notifications' | 'analytics';

export const TestManagement: React.FC<TestManagementProps> = ({
  sections,
  questions,
  courses,
  cases,
  spaces = [],
  onImport,
  onReset,
  isSetupMode,
  onRefresh
}) => {
  const { hasPermission } = useAuth();

  const [newCourse, setNewCourse] = useState<any>({
    title: '', 
    department: '', 
    instructionIds: [], 
    caseIds: [], 
    useCases: false, 
    hasCertificate: false, 
    certificateValidityYears: 1,
    isProgressive: false,
    quizPassScorePercent: 80,
    quizTimeLimitMin: undefined,
    quizMaxAttempts: undefined
  });
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [createCourseInstFilter, setCreateCourseInstFilter] = useState('all');
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [assignmentsCount, setAssignmentsCount] = useState<number | null>(null);
  const [newCase, setNewCase] = useState<any>({ title: '', sectionId: '', scenario: '', expectedResult: '', maxScore: 100, passScore: 80, options: [{ id: 'opt-1', text: '', isCorrect: true, feedback: '' }], isActive: true });

  const availableDepartments = React.useMemo(() => {
    const set = new Set<string>();
    departments.forEach(d => { if (d?.name && typeof d.name === 'string' && d.name.trim()) set.add(d.name.trim()); });
    sections.forEach(s => { if (s?.department && typeof s.department === 'string' && s.department.trim()) set.add(s.department.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [departments, sections]);

  const handleDeleteCourse = async (id: string) => {
    if (!id) return;
    setIsDeletingCourse(true);
    try {
      const res = await fetch('/api/admin/courses/' + encodeURIComponent(id), { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        if (onRefresh) await onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Не вдалося видалити курс');
      }
    } catch(e) {
      console.error('Error deleting course:', e);
      alert('Помилка при видаленні курсу');
    } finally {
      setIsDeletingCourse(false);
      setDeletingCourseId(null);
    }
  };
  

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDep, setEditingCourseDep] = useState<string>('');
  const [editingInstIsActive, setEditingInstIsActive] = useState<boolean>(true);
  const [deletingInstId, setDeletingInstId] = useState<string | null>(null);
  const [isDeletingInst, setIsDeletingInst] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [isDeletingDep, setIsDeletingDep] = useState(false);
  const [deletingDepId, setDeletingDepId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch (err) {}
  };
  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/v2/org/departments');
      const data = await res.json();
      if (res.ok) setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {}
  };
  const fetchPositions = async () => {
    try {
      const res = await fetch('/api/v2/org/positions');
      const data = await res.json();
      if (res.ok) setPositions(Array.isArray(data) ? data : []);
    } catch (err) {}
  };
  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/v2/org/locations');
      const data = await res.json();
      if (res.ok) setLocations(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      if (res.ok) setRoles(data.roles || []);
    } catch (err) {}
  };

  const fetchAssignmentsCount = async () => {
    try {
      const res = await fetch('/api/progress-v2/admin/assignments');
      const data = await res.json();
      if (res.ok && data?.stats) {
        setAssignmentsCount(data.stats.total ?? (Array.isArray(data.assignments) ? data.assignments.length : 0));
      }
    } catch (err) {}
  };

  React.useEffect(() => {
    fetchDepartments();
    fetchPositions();
    fetchLocations();
    fetchRoles();
    fetchUsers();
    fetchAssignmentsCount();
  }, []);
  const handleDeleteInstruction = async (id: string) => {
    if (!id) return;
    setIsDeletingInst(true);
    try {
      const res = await fetch('/api/admin/instructions/' + encodeURIComponent(id), { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        if (onRefresh) await onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Не вдалося видалити інструкцію');
      }
    } catch(e) {
      console.error('Error deleting instruction:', e);
      alert('Помилка при видаленні інструкції');
    } finally {
      setIsDeletingInst(false);
      setDeletingInstId(null);
    }
  };

  const [createCourseInstSearch, setCreateCourseInstSearch] = useState('');
  const [editCourseInstFilter, setEditCourseInstFilter] = useState('all');
  const [editCourseInstSearch, setEditCourseInstSearch] = useState('');
const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<any>({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });
  const [userMsg, setUserMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [editingCase, setEditingCase] = useState<any>(null);
   // dummy if missing
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [isDeletingCase, setIsDeletingCase] = useState(false);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [helpSubTab, setHelpSubTab] = useState('formatting');

const [showImportPanel, setShowImportPanel] = useState<boolean>(false);
  const [showExportPanel, setShowExportPanel] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<MgmtTab>(() => {
    if (isSetupMode) return 'users';
    try {
      const saved = localStorage.getItem('viatec_mgmt_tab') as MgmtTab;
      if (saved === 'import' || saved === 'export') {
        return 'list';
      }
      if (saved && ['list', 'courses', 'cases', 'knowledge', 'assignments', 'help', 'users', 'roles', 'organization', 'notifications', 'analytics'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'list';
  });

  React.useEffect(() => {
    if (!isSetupMode) {
      try {
        localStorage.setItem('viatec_mgmt_tab', activeTab);
      } catch {}
    }
  }, [activeTab, isSetupMode]);

  React.useEffect(() => {
    if (activeTab === 'import') {
      setActiveTab('list');
      setShowImportPanel(true);
    } else if (activeTab === 'export') {
      setActiveTab('list');
      setShowExportPanel(true);
    }
  }, [activeTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  
  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  const [editingMarkdownInstId, setEditingMarkdownInstId] = useState<string | null>(null);
  const [editingMarkdownContent, setEditingMarkdownContent] = useState<string>('');
  const [exportMenuInstId, setExportMenuInstId] = useState<string | null>(null);

  const handleSaveMarkdown = async (md: string) => {
    try {
      const { sections: newSections, questions: newQuestions } = parseMarkdown(md);
      if (newSections.length === 0) {
        alert('Помилка: не знайдено жодної інструкції в Markdown.');
        return;
      }
      const newSection = newSections[0];
      // Keep the original ID
      newSection.id = editingMarkdownInstId!;
      
      const res = await fetch(`/api/admin/instructions/${editingMarkdownInstId}/full`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: newSection, questions: newQuestions })
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
  const handleDeleteCase = async (id: string) => { 
    if (!id) return;
    setIsDeletingCase(true); 
    try { 
      const res = await fetch('/api/admin/cases/' + encodeURIComponent(id), { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      }); 
      if (res.ok) {
        if (onRefresh) await onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Не вдалося видалити кейс');
      }
    } catch(e) {
      console.error('Error deleting case:', e);
      alert('Помилка при видаленні кейсу');
    } finally { 
      setIsDeletingCase(false); 
      setDeletingCaseId(null); 
    } 
  };
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/v2/org/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDepartment })
      });
      setNewDepartment('');
      fetchDepartments();
    } catch (err) {}
  };

  const handleDeleteDepartment = async (id: string) => {
    setIsDeletingDep(true);
    try {
      const res = await fetch(`/api/v2/org/departments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeletingDepId(null);
        fetchDepartments();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Не вдалося видалити підрозділ');
      }
    } catch (err) {
      console.error('Failed to delete department:', err);
      alert('Помилка при видаленні підрозділу');
    } finally {
      setIsDeletingDep(false);
    }
  };

  const groupedCourses = React.useMemo(() => {
    // Return sections since we are listing instructions
    return sections.map(sec => {
      const qCount = questions.filter(q => q.sectionId === sec.id).length;
      return {
        id: sec.id,
        title: sec.title,
        department: sec.department || 'Загальний',
        isActive: sec.isActive !== undefined ? sec.isActive : true,
        questionCount: qCount
      };
    });
  }, [sections, questions]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_MD], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_quiz_instructions.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_GUIDE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = AI_PROMPT_GUIDE;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    }
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([AI_PROMPT_GUIDE], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai_prompt_instruction_format.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportInstMD = (instId: string, title: string) => {
    const sec = sections.find(s => s.id === instId);
    if (!sec) return;
    const secQs = questions.filter(q => q.sectionId === instId);
    const md = exportToMarkdown(title, [sec], secQs);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[\/\\]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportInstPDF = (instId: string) => {
    const sec = sections.find(s => s.id === instId);
    if (!sec) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Будь ласка, дозвольте спливаючі вікна для цього сайту, щоб згенерувати PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${sec.title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #0f172a; }
          .meta { color: #64748b; margin-bottom: 32px; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; }
          h3 { font-size: 18px; font-weight: bold; margin-top: 24px; margin-bottom: 12px; color: #0f172a; }
          p { margin-bottom: 16px; }
          ul { padding-left: 24px; margin-bottom: 24px; }
          li { margin-bottom: 8px; }
          .step { margin-bottom: 20px; }
          .step h4 { font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #334155; }
          .tip { font-size: 13px; color: #0369a1; background: #e0f2fe; padding: 8px 12px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #0284c7; }
          .warning { font-size: 13px; color: #be123c; background: #ffe4e6; padding: 8px 12px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #e11d48; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${sec.title}</h1>
        <div class="meta">Підрозділ: ${sec.department} | Роль: ${sec.targetRole || 'Усі'}</div>
        
        <div>
          <h3>Суть:</h3>
          <p>${sec.summary}</p>
        </div>

        ${sec.keyPoints && sec.keyPoints.length > 0 ? `
          <div>
            <h3>Основні положення:</h3>
            <ul>
              ${sec.keyPoints.map((kp: string) => `<li>${kp}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${sec.steps && sec.steps.length > 0 ? `
          <div>
            <h3>Покроковий порядок:</h3>
            ${sec.steps.map((step: any) => `
              <div class="step">
                <h4>Крок ${step.number}: ${step.title}</h4>
                <p>${step.description}</p>
                ${step.tip ? `<div class="tip">💡 ${step.tip}</div>` : ''}
                ${step.warning ? `<div class="warning">⚠️ ${step.warning}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportData = () => {
    const fullMd = exportToMarkdown('База знань', sections, questions);
    const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exported_instructions_${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, replace: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseMarkdown(text);
        
        if (result.sections.length === 0) {
          setImportStatus({
            type: 'error',
            message: 'Файл не містить інструкції або вона неправильно оформлена.'
          });
          return;
        }

        onImport(result.sections, result.questions, replace);
        setImportStatus({
          type: 'success',
          message: `Успішно імпортовано: інструкція та ${result.questions.length} питань.`
        });
      } catch (err) {
        setImportStatus({
          type: 'error',
          message: 'Помилка розбору файлу. Переконайтесь, що він відповідає шаблону.'
        });
      }
    };

    reader.onerror = () => {
      setImportStatus({
        type: 'error',
        message: 'Помилка читання файлу.'
      });
    };

    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setIsGeneratingAi(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/generate-instruction', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'AI processing failed');

      const result = parseMarkdown(data.markdown);
      if (result.sections.length === 0) {
        setImportStatus({
          type: 'error',
          message: 'ШІ не зміг коректно згенерувати інструкцію. Спробуйте інший файл.'
        });
        setIsGeneratingAi(false);
        return;
      }

      onImport(result.sections, result.questions, false);
      setImportStatus({
        type: 'success',
        message: `ШІ успішно обробив файл та створив: ${result.sections.length} інструкцій та ${result.questions.length} питань.`
      });
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: err.message || 'Помилка при генерації через AI.'
      });
    } finally {
      setIsGeneratingAi(false);
      if (aiFileInputRef.current) {
        aiFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100/60 px-2.5 py-0.5 rounded-full">
                Адміністрування
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Керування тестами та інструкціями
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        
        {/* Left Nav */}
        {!isSetupMode && (
          <div className="md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 p-4 shrink-0">
            <div className="space-y-6">
              {/* Group 1: Матеріали */}
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Матеріали</span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'list' 
                        ? 'bg-purple-100 text-purple-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <List className="w-4 h-4" />
                      <span>Інструкції</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
                      activeTab === 'list' 
                        ? 'bg-purple-200/80 text-purple-900' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {sections.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('courses')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'courses' 
                        ? 'bg-purple-100 text-purple-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4" />
                      <span>Курси</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
                      activeTab === 'courses' 
                        ? 'bg-purple-200/80 text-purple-900' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {courses.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('cases')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'cases' 
                        ? 'bg-orange-100 text-orange-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="w-4 h-4" />
                      <span>Кейси</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
                      activeTab === 'cases' 
                        ? 'bg-orange-200/80 text-orange-900' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {cases.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'knowledge' 
                        ? 'bg-blue-100 text-blue-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderTree className="w-4 h-4" />
                      <span>База знань</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
                      activeTab === 'knowledge' 
                        ? 'bg-blue-200/80 text-blue-900' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {spaces.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('assignments')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'assignments' 
                        ? 'bg-blue-100 text-blue-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CalendarClock className="w-4 h-4 text-blue-600" />
                      <span>Призначення</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
                      activeTab === 'assignments' 
                        ? 'bg-blue-200/80 text-blue-900' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {assignmentsCount !== null ? assignmentsCount : '—'}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('help')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'help' 
                        ? 'bg-purple-100 text-purple-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Допомога / Шаблон</span>
                  </button>
                </div>
              </div>

              {/* Group 2: Організація */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-1.5 px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Організація</span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'users' 
                        ? 'bg-purple-100 text-purple-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Користувачі</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'roles' 
                        ? 'bg-purple-100 text-purple-800 shadow-xs' 
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Ролі та права</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('organization')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'organization'
                        ? 'bg-purple-100 text-purple-800 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Settings2 className="w-4 h-4" />
                    <span>Організація</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'notifications'
                        ? 'bg-purple-100 text-purple-800 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    <span>Сповіщення</span>
                  </button>

                  {hasPermission('analytics.report.view') && (
                    <button
                      onClick={() => setActiveTab('analytics')}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                        activeTab === 'analytics'
                          ? 'bg-purple-100 text-purple-800 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Аналітика</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Content */}
        <div className="p-6 sm:p-8 grow h-full overflow-y-auto">
          
          {/* TAB: LIST */}
          {activeTab === 'list' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-xl font-bold text-slate-900">Інструкції</h3>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        {sections.length} інструкцій
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {questions.length} питань
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Перегляд, редагування матеріалів, імпорт нових регламентів та експорт бази знань.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      id="btn-toggle-import-panel"
                      onClick={() => {
                        setShowImportPanel(!showImportPanel);
                        if (!showImportPanel) setShowExportPanel(false);
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                        showImportPanel
                          ? 'bg-blue-600 text-white shadow-blue-200'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                      title="Імпортувати інструкції з Markdown файлу"
                    >
                      <Download className="w-4 h-4" />
                      <span>{showImportPanel ? 'Приховати імпорт' : 'Імпорт (.md)'}</span>
                    </button>

                    <button
                      id="btn-toggle-export-panel"
                      onClick={() => {
                        setShowExportPanel(!showExportPanel);
                        if (!showExportPanel) setShowImportPanel(false);
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                        showExportPanel
                          ? 'bg-purple-600 text-white shadow-purple-200'
                          : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                      }`}
                      title="Експортувати базу знань у файл Markdown"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{showExportPanel ? 'Приховати експорт' : 'Експорт (.md)'}</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('help')}
                      className="p-2 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition border border-slate-200"
                      title="Шаблон оформлення та ШІ-промпт"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* INTEGRATED IMPORT PANEL */}
              {showImportPanel && (
                <div className="p-5 sm:p-6 bg-gradient-to-b from-blue-50/70 to-white rounded-2xl border-2 border-blue-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">Імпорт інструкцій та тестів (.md)</h4>
                        <p className="text-xs text-slate-500">Завантажте файл формату Markdown із текстом регламенту та запитаннями</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowImportPanel(false)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                      title="Закрити панель"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* AI Assistant Banner */}
                  <div className="p-4 rounded-xl bg-blue-100/50 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-semibold text-blue-900">
                        Створюєте тести за допомогою ChatGPT, Claude або Gemini? Скопіюйте системний промпт:
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleCopyPrompt}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                          copiedPrompt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                        }`}
                      >
                        {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPrompt ? 'Скопійовано!' : 'Копіювати промпт'}</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('help')}
                        className="px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:underline"
                      >
                        Шаблон
                      </button>
                    </div>
                  </div>

                  {importStatus && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                      importStatus.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      {importStatus.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm font-medium">{importStatus.message}</p>
                    </div>
                  )}

                  {/* Upload Boxes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Manual MD Upload */}
                    <div className="p-6 border-2 border-dashed border-blue-200 hover:border-blue-300 rounded-xl bg-white flex flex-col items-center justify-center text-center transition">
                      <FileText className="w-8 h-8 text-blue-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        1. Готовий .md файл
                      </p>
                      <p className="text-xs text-slate-400 mb-4 max-w-sm">
                        Завантажте заздалегідь підготовлений Markdown файл.
                      </p>

                      <input 
                        type="file" 
                        accept=".md,text/markdown"
                        className="hidden" 
                        ref={fileInputRef}
                      />

                      <div className="flex flex-col gap-2 w-full max-w-[200px]">
                        <button
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.onchange = (e: any) => handleFileUpload(e, false);
                              fileInputRef.current.click();
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition w-full"
                        >
                          Додати до існуючих
                        </button>
                      </div>
                    </div>

                    {/* AI Generation Upload */}
                    <div className="p-6 border-2 border-dashed border-indigo-200 hover:border-indigo-300 rounded-xl bg-indigo-50/30 flex flex-col items-center justify-center text-center transition relative overflow-hidden">
                      {isGeneratingAi && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                          <span className="text-xs font-bold text-indigo-900">ШІ аналізує документ...</span>
                        </div>
                      )}
                      <Sparkles className="w-8 h-8 text-indigo-500 mb-2" />
                      <p className="text-sm font-semibold text-indigo-900 mb-1">
                        2. ШІ-Генерація (docx, pdf, txt)
                      </p>
                      <p className="text-xs text-indigo-500/80 mb-4 max-w-sm">
                        Завантажте сирий документ, і ШІ сам згенерує інструкцію та тести.
                      </p>

                      <input 
                        type="file" 
                        accept=".pdf,.txt,.doc,.docx"
                        className="hidden" 
                        ref={aiFileInputRef}
                        onChange={handleAiFileUpload}
                      />

                      <button
                        onClick={() => {
                          if (aiFileInputRef.current) {
                            aiFileInputRef.current.value = '';
                            aiFileInputRef.current.click();
                          }
                        }}
                        disabled={isGeneratingAi}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition w-full max-w-[200px]"
                      >
                        Обробити через ШІ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* INTEGRATED EXPORT PANEL */}
              {showExportPanel && (
                <div className="p-5 sm:p-6 bg-gradient-to-b from-purple-50/70 to-white rounded-2xl border-2 border-purple-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">Експорт повної бази інструкцій</h4>
                        <p className="text-xs text-slate-500">Збережіть базу знань у файл Markdown (.md) для резервної копії чи передачі</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowExportPanel(false)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                      title="Закрити панель"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">Поточний стан бази</div>
                      <div className="flex items-center gap-4 text-sm text-slate-700">
                        <div>Розділів інструкцій: <span className="font-bold text-slate-900">{sections.length}</span></div>
                        <div>•</div>
                        <div>Тестових питань: <span className="font-bold text-slate-900">{questions.length}</span></div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Також кожну окрему інструкцію можна експортувати у форматах .md або PDF окремо у списку нижче.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        handleExportData();
                        setExportSuccess(true);
                        setTimeout(() => setExportSuccess(false), 3000);
                      }}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 shadow-xs ${
                        exportSuccess
                          ? 'bg-emerald-600 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {exportSuccess ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                      <span>{exportSuccess ? 'Файл завантажено!' : 'Завантажити всю базу (.md)'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {groupedCourses.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    База інструкцій порожня.
                  </div>
                ) : (
                  groupedCourses.map((inst) => {
                    return (
                      <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition">
                        {editingCourseId === inst.id ? (
                          <div className="flex-1 flex flex-col gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{inst.title}</h4>
                            <select 
                              value={editingCourseDep}
                              onChange={(e) => setEditingCourseDep(e.target.value)}
                              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm w-full sm:max-w-xs"
                            >
                              <option value="">(Без підрозділу)</option>
                              {departments.map(d => (
                                <option key={d._id} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`edit-inst-active-${inst.id}`}
                                checked={editingInstIsActive}
                                onChange={e => setEditingInstIsActive(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor={`edit-inst-active-${inst.id}`} className="text-sm font-bold text-slate-700">
                                Активний (доступний для проходження)
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/admin/instructions/${inst.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ department: editingCourseDep, isActive: editingInstIsActive })
                                    });
                                    if (res.ok) {
                                      setEditingCourseId(null);
                                      if (onRefresh) await onRefresh();
                                    } else {
                                      alert('Не вдалося оновити інструкцію');
                                    }
                                  } catch (e) {
                                    console.error(e);
                                    alert('Помилка мережі при оновленні інструкції');
                                  }
                                }}
                                className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium"
                              >Зберегти</button>
                              <button 
                                onClick={() => setEditingCourseId(null)}
                                className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium"
                              >Скасувати</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <div className="flex gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-100 px-2 py-0.5 rounded-md inline-block">
                                  {inst.department}
                                </span>
                                {inst.isActive === false && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md inline-block">
                                    Вимкнено
                                  </span>
                                )}
                              </div>
                              <h4 className={`text-sm font-bold ${inst.isActive === false ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{inst.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                ID: {inst.id} · Питань: {inst.questionCount}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0 self-start sm:self-center items-center">
                              {/* Unified Export Submenu */}
                              <div className="relative">
                                <button
                                  id={`btn-export-dropdown-${inst.id}`}
                                  onClick={() => setExportMenuInstId(exportMenuInstId === inst.id ? null : inst.id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border ${
                                    exportMenuInstId === inst.id
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
                                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200'
                                  }`}
                                  title="Підменю експорту"
                                >
                                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Експорт</span>
                                  <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${exportMenuInstId === inst.id ? 'rotate-180' : ''}`} />
                                </button>

                                {exportMenuInstId === inst.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-20" 
                                      onClick={() => setExportMenuInstId(null)} 
                                    />
                                    <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Формат експорту
                                      </div>
                                      <button
                                        onClick={() => {
                                          handleExportInstMD(inst.id, inst.title);
                                          setExportMenuInstId(null);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition text-left"
                                        title="Експортувати у Markdown (.md)"
                                      >
                                        <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                                          MD
                                        </div>
                                        <div>
                                          <div className="font-semibold text-slate-800 leading-tight">Markdown (.md)</div>
                                          <div className="text-[10px] text-slate-400">Текст інструкції з тестами</div>
                                        </div>
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleExportInstPDF(inst.id);
                                          setExportMenuInstId(null);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition text-left"
                                        title="Експортувати у PDF"
                                      >
                                        <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                                          PDF
                                        </div>
                                        <div>
                                          <div className="font-semibold text-slate-800 leading-tight">PDF (.pdf)</div>
                                          <div className="text-[10px] text-slate-400">Формат для друку</div>
                                        </div>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setEditingCourseId(inst.id);
                                  setEditingCourseDep(inst.department);
                                  setEditingInstIsActive(inst.isActive !== false);
                                }}
                                className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                                title="Редагувати підрозділ"
                              >
                                <Settings2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  const sec = sections.find(s => s.id === inst.id);
                                  if (!sec) return;
                                  const secQs = questions.filter(q => q.sectionId === inst.id);
                                  const md = exportToMarkdown(inst.title, [sec], secQs);
                                  setEditingMarkdownInstId(inst.id);
                                  setEditingMarkdownContent(md);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                title="Редагувати вміст (Markdown)"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              {deletingInstId === (inst.id || (inst as any)._id) ? (
                                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                  <span className="text-xs font-semibold text-rose-700">Видалити?</span>
                                  <button
                                    type="button"
                                    disabled={isDeletingInst}
                                    onClick={() => handleDeleteInstruction(inst.id || (inst as any)._id)}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs transition disabled:opacity-50"
                                  >
                                    {isDeletingInst ? '...' : 'Так'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeletingInst}
                                    onClick={() => setDeletingInstId(null)}
                                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition"
                                  >
                                    Ні
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingInstId(inst.id || (inst as any)._id)}
                                  className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                  title="Видалити інструкцію"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: COURSES */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Список курсів</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Об'єднуйте інструкції у курси.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-semibold text-slate-800">Створити новий курс</h4>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Назва курсу"
                    value={newCourse.title}
                    onChange={e => setNewCourse({ ...newCourse, title: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                  <select
                    value={newCourse.department}
                    onChange={e => setNewCourse({ ...newCourse, department: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="">Оберіть підрозділ...</option>
                    {availableDepartments.map(depName => (
                      <option key={depName} value={depName}>{depName}</option>
                    ))}
                  </select>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="new-course-cert"
                      checked={newCourse.hasCertificate}
                      onChange={e => setNewCourse({ ...newCourse, hasCertificate: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="new-course-cert" className="text-sm text-slate-700">
                      Видавати сертифікат по завершенню
                    </label>
                  </div>
                  
                  {newCourse.hasCertificate && (
                    <div className="flex items-center gap-2 ml-6">
                      <label className="text-sm text-slate-600">Термін дії (років):</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newCourse.certificateValidityYears}
                        onChange={e => setNewCourse({ ...newCourse, certificateValidityYears: parseInt(e.target.value) || 1 })}
                        className="px-2 py-1 w-20 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  )}
                  
                  <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-700">Інструкції для курсу ({newCourse.instructionIds?.length || 0} обрано)</div>
                        <select
                          value={createCourseInstFilter}
                          onChange={e => setCreateCourseInstFilter(e.target.value)}
                          className="px-2 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">Усі підрозділи ({sections.length})</option>
                          {availableDepartments.map(depName => {
                            const count = sections.filter(s => s.department === depName).length;
                            return (
                              <option key={depName} value={depName}>{depName} ({count})</option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Пошук інструкції за назвою або підрозділом..."
                          value={createCourseInstSearch}
                          onChange={e => setCreateCourseInstSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="h-[300px] overflow-y-auto p-2 bg-white flex flex-col gap-1">
                      {sections
                        .filter(sec => !createCourseInstFilter || createCourseInstFilter === 'all' || sec.department === createCourseInstFilter)
                        .filter(sec => {
                          const q = createCourseInstSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (sec.title && sec.title.toLowerCase().includes(q)) || (sec.department && sec.department.toLowerCase().includes(q));
                        })
                        .map(sec => {
                          const secId = sec.id || (sec as any)._id;
                          const isSelected = (newCourse.instructionIds || []).includes(secId);
                          return (
                            <label 
                              key={secId} 
                              className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                  : 'border-transparent hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  const ids = newCourse.instructionIds || [];
                                  if (e.target.checked) setNewCourse({ ...newCourse, instructionIds: [...ids, secId] });
                                  else setNewCourse({ ...newCourse, instructionIds: ids.filter((i: any) => i !== secId) });
                                }}
                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                  {sec.title}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">{sec.department}</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      {sections.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">
                          В базі знань ще немає інструкцій. Створіть їх у вкладці «Регламенти / Інструкції».
                        </div>
                      ) : sections
                          .filter(sec => !createCourseInstFilter || createCourseInstFilter === 'all' || sec.department === createCourseInstFilter)
                          .filter(sec => {
                            const q = createCourseInstSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (sec.title && sec.title.toLowerCase().includes(q)) || (sec.department && sec.department.toLowerCase().includes(q));
                          }).length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">За заданими критеріями інструкцій не знайдено</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newCourse.useCases || false}
                        onChange={e => setNewCourse({ ...newCourse, useCases: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">Використовувати практичні кейси</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newCourse.isProgressive || false}
                        onChange={e => setNewCourse({ ...newCourse, isProgressive: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">Послідовне проходження (Курси-кроки)</span>
                    </label>

                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Мін. бал (%)</label>
                        <input
                          type="number"
                          min="1" max="100"
                          value={newCourse.quizPassScorePercent ?? 80}
                          onChange={e => setNewCourse({ ...newCourse, quizPassScorePercent: Number(e.target.value) })}
                          className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ліміт часу (хв)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Без ліміту"
                          value={newCourse.quizTimeLimitMin || ''}
                          onChange={e => setNewCourse({ ...newCourse, quizTimeLimitMin: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Макс. спроб</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Без ліміту"
                          value={newCourse.quizMaxAttempts || ''}
                          onChange={e => setNewCourse({ ...newCourse, quizMaxAttempts: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!newCourse.title || !newCourse.department) return alert('Заповніть назву та підрозділ');
                      try {
                        const res = await fetch('/api/admin/courses', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newCourse)
                        });
                        if (res.ok) {
                          setNewCourse({ 
                            title: '', 
                            department: '', 
                            instructionIds: [], 
                            caseIds: [], 
                            useCases: false, 
                            hasCertificate: false, 
                            certificateValidityYears: 1,
                            isProgressive: false,
                            quizPassScorePercent: 80,
                            quizTimeLimitMin: undefined,
                            quizMaxAttempts: undefined
                          });
                          if (onRefresh) await onRefresh();
                        } else {
                          const errData = await res.json().catch(() => ({}));
                          alert(errData.error || 'Не вдалося створити курс');
                        }
                      } catch (err) {
                        console.error('Failed to create course:', err);
                        alert('Помилка при створенні курсу');
                      }
                    }}
                    className="self-start px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold mt-2 shadow-xs transition"
                  >
                    Створити курс
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {courses.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Немає створених курсів.
                  </div>
                ) : (
                  courses.map((course) => {
                    const currentCourseId = course.id || course._id;
                    const isEditing = editingCourse?.id === currentCourseId || editingCourse?._id === currentCourseId;
                    return (
                    <div key={currentCourseId} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Назва курсу"
                            value={editingCourse?.title || ''}
                            onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                          <select
                            value={editingCourse?.department || ''}
                            onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, department: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Оберіть підрозділ...</option>
                            {availableDepartments.map(depName => (
                              <option key={depName} value={depName}>{depName}</option>
                            ))}
                          </select>
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-cert-${currentCourseId}`}
                              checked={editingCourse?.hasCertificate || false}
                              onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, hasCertificate: e.target.checked })}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor={`edit-cert-${currentCourseId}`} className="text-sm text-slate-700">
                              Видавати сертифікат
                            </label>
                          </div>
                          
                          {editingCourse?.hasCertificate && (
                            <div className="flex items-center gap-2 ml-6">
                              <label className="text-sm text-slate-600">Термін дії (років):</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={editingCourse?.certificateValidityYears || 1}
                                onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, certificateValidityYears: parseInt(e.target.value) || 1 })}
                                className="px-2 py-1 w-20 border border-slate-300 rounded-md text-sm"
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-course-active-${currentCourseId}`}
                              checked={editingCourse?.isActive !== false}
                              onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, isActive: e.target.checked })}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`edit-course-active-${currentCourseId}`} className="text-sm font-bold text-slate-700">
                              Курс активний (доступний для проходження)
                            </label>
                          </div>

                          <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-slate-700">Інструкції для курсу ({editingCourse?.instructionIds?.length || 0} обрано)</div>
                                <select
                                  value={editCourseInstFilter}
                                  onChange={e => setEditCourseInstFilter(e.target.value)}
                                  className="px-2 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="all">Усі підрозділи ({sections.length})</option>
                                  {availableDepartments.map(depName => {
                                    const count = sections.filter(s => s.department === depName).length;
                                    return (
                                      <option key={depName} value={depName}>{depName} ({count})</option>
                                    );
                                  })}
                                </select>
                              </div>
                              <div className="relative">
                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Пошук інструкції за назвою або підрозділом..."
                                  value={editCourseInstSearch}
                                  onChange={e => setEditCourseInstSearch(e.target.value)}
                                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                />
                              </div>
                            </div>
                            <div className="h-[300px] overflow-y-auto p-2 bg-white flex flex-col gap-1">
                              {sections
                                .filter(sec => !editCourseInstFilter || editCourseInstFilter === 'all' || sec.department === editCourseInstFilter)
                                .filter(sec => {
                                  const q = editCourseInstSearch.trim().toLowerCase();
                                  if (!q) return true;
                                  return (sec.title && sec.title.toLowerCase().includes(q)) || (sec.department && sec.department.toLowerCase().includes(q));
                                })
                                .map(sec => {
                                  const secId = sec.id || (sec as any)._id;
                                  const isSelected = (editingCourse?.instructionIds || []).includes(secId);
                                  return (
                                    <label 
                                      key={secId} 
                                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                        isSelected 
                                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                          : 'border-transparent hover:bg-slate-50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={e => {
                                          const ids = editingCourse?.instructionIds || [];
                                          if (e.target.checked) setEditingCourse((prev: any) => !prev ? null : { ...prev, instructionIds: [...ids, secId] });
                                          else setEditingCourse((prev: any) => !prev ? null : { ...prev, instructionIds: ids.filter((i: any) => i !== secId) });
                                        }}
                                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                          {sec.title}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">{sec.department}</span>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              {sections.length === 0 ? (
                                <div className="p-6 text-center text-sm text-slate-500">В базі знань немає доступних інструкцій</div>
                              ) : sections
                                  .filter(sec => !editCourseInstFilter || editCourseInstFilter === 'all' || sec.department === editCourseInstFilter)
                                  .filter(sec => {
                                    const q = editCourseInstSearch.trim().toLowerCase();
                                    if (!q) return true;
                                    return (sec.title && sec.title.toLowerCase().includes(q)) || (sec.department && sec.department.toLowerCase().includes(q));
                                  }).length === 0 ? (
                                <div className="p-6 text-center text-sm text-slate-500">За заданими критеріями інструкцій не знайдено</div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 mt-4 mb-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingCourse?.useCases || false}
                                onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, useCases: e.target.checked })}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Використовувати практичні кейси</span>
                            </label>
                            
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingCourse?.isProgressive || false}
                                onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, isProgressive: e.target.checked })}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Послідовне проходження (Курси-кроки)</span>
                            </label>
                            
                            <div className="grid grid-cols-3 gap-3 mt-2">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Мін. бал (%)</label>
                                <input
                                  type="number"
                                  min="1" max="100"
                                  value={editingCourse?.quizPassScorePercent ?? 80}
                                  onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, quizPassScorePercent: Number(e.target.value) })}
                                  className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Ліміт часу (хв)</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Без ліміту"
                                  value={editingCourse?.quizTimeLimitMin || ''}
                                  onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, quizTimeLimitMin: e.target.value ? Number(e.target.value) : undefined })}
                                  className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Макс. спроб</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Без ліміту"
                                  value={editingCourse?.quizMaxAttempts || ''}
                                  onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, quizMaxAttempts: e.target.value ? Number(e.target.value) : undefined })}
                                  className="w-full text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!editingCourse?.title || !editingCourse?.department) return alert('Заповніть назву та підрозділ');
                                try {
                                  const courseIdToUpdate = editingCourse?.id || editingCourse?._id || currentCourseId;
                                  const res = await fetch(`/api/admin/courses/${encodeURIComponent(courseIdToUpdate)}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(editingCourse)
                                  });
                                  if (res.ok) {
                                    setEditingCourse(null);
                                    if (onRefresh) await onRefresh();
                                  } else {
                                    const errData = await res.json().catch(() => ({}));
                                    alert(errData.error || 'Не вдалося зберегти зміни курсу');
                                  }
                                } catch (err) {
                                  console.error('Failed to edit course:', err);
                                  alert('Помилка при збереженні курсу');
                                }
                              }}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium transition hover:bg-purple-700"
                            >
                              Зберегти
                            </button>
                            <button
                              onClick={() => setEditingCourse(null)}
                              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition hover:bg-slate-300"
                            >
                              Скасувати
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex gap-2 mb-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-100 px-2 py-0.5 rounded-md inline-block">
                                {course.department}
                              </div>
                              {!course.isActive && (
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md inline-block">
                                  Вимкнено
                                </div>
                              )}
                            </div>
                            <h4 className={`text-sm font-bold ${course.isActive ? 'text-slate-900' : 'text-slate-500 line-through'}`}>{course.title}</h4>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <span>Включає {course.instructionIds?.length || 0} інструкцій</span>
                              {course.hasCertificate && (
                                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  Сертифікат ({course.certificateValidityYears} р.)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingCourse({
                                id: currentCourseId,
                                _id: course._id,
                                title: course.title,
                                department: course.department,
                                instructionIds: course.instructionIds || [],
                                useCases: course.useCases || false,
                                hasCertificate: course.hasCertificate || false,
                                certificateValidityYears: course.certificateValidityYears || 1,
                                isProgressive: course.isProgressive || false,
                                quizPassScorePercent: course.quizPassScorePercent ?? 80,
                                quizTimeLimitMin: course.quizTimeLimitMin,
                                quizMaxAttempts: course.quizMaxAttempts,
                                isActive: course.isActive !== undefined ? course.isActive : true
                              })}
                              className="p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition"
                              title="Редагувати курс"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {deletingCourseId === currentCourseId ? (
                              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                <span className="text-xs font-semibold text-rose-700">Видалити?</span>
                                <button
                                  type="button"
                                  disabled={isDeletingCourse}
                                  onClick={() => handleDeleteCourse(currentCourseId)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs transition disabled:opacity-50"
                                >
                                  {isDeletingCourse ? '...' : 'Так'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeletingCourse}
                                  onClick={() => setDeletingCourseId(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition"
                                >
                                  Ні
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingCourseId(currentCourseId)}
                                className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                title="Видалити курс"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: CASES */}
          {activeTab === 'cases' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Управління практичними кейсами</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Створюйте сценарії для практичного тренування. Ви зможете прив'язати їх до конкретних курсів на вкладці "Курси".
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h4 className="text-md font-bold text-slate-900 mb-4">{editingCase ? 'Редагувати кейс' : 'Створити новий кейс'}</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Назва кейсу</label>
                    <input
                      type="text"
                      value={editingCase ? editingCase?.title : newCase.title}
                      onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, title: e.target.value }) : setNewCase({ ...newCase, title: e.target.value })}
                      placeholder="Напр. Розгніваний клієнт на касі"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Прив'язка до інструкції</label>
                    <select
                      value={editingCase ? editingCase?.sectionId || '' : newCase.sectionId || ''}
                      onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, sectionId: e.target.value }) : setNewCase({ ...newCase, sectionId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">-- Оберіть інструкцію --</option>
                      {sections.map(sec => (
                        <option key={sec.id} value={sec.id}>{sec.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Сценарій (опис ситуації)</label>
                    <textarea
                      value={editingCase ? editingCase?.scenario : newCase.scenario}
                      onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, scenario: e.target.value }) : setNewCase({ ...newCase, scenario: e.target.value })}
                      placeholder="Опишіть ситуацію детально..."
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Варіанти відповідей (виберіть правильний)</label>
                    {(editingCase ? (editingCase?.options || []) : (newCase.options || [])).map((opt: any, idx: number) => (
                      <div key={idx} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                        <div className="flex gap-2 items-center">
                          <input 
                            type="radio" 
                            name={`correct-option-${editingCase ? 'edit' : 'new'}`}
                            checked={opt.isCorrect}
                            onChange={() => {
                              const updatedOptions = (editingCase ? (editingCase?.options || []) : (newCase.options || [])).map((o: any, i: number) => ({
                                ...o,
                                isCorrect: i === idx
                              }));
                              if (editingCase) setEditingCase((prev: any) => !prev ? null : { ...prev, options: updatedOptions });
                              else setNewCase({ ...newCase, options: updatedOptions });
                            }}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={opt.text}
                            onChange={e => {
                              const updatedOptions = [...(editingCase ? (editingCase?.options || []) : (newCase.options || []))];
                              updatedOptions[idx] = { ...updatedOptions[idx], text: e.target.value };
                              if (editingCase) setEditingCase((prev: any) => !prev ? null : { ...prev, options: updatedOptions });
                              else setNewCase({ ...newCase, options: updatedOptions });
                            }}
                            placeholder={`Варіант ${idx + 1}`}
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                          />
                          {(editingCase ? (editingCase?.options || []) : (newCase.options || [])).length > 1 && (
                            <button
                              onClick={() => {
                                const updatedOptions = (editingCase ? (editingCase?.options || []) : (newCase.options || [])).filter((_: any, i: number) => i !== idx);
                                if (editingCase) setEditingCase((prev: any) => !prev ? null : { ...prev, options: updatedOptions });
                                else setNewCase({ ...newCase, options: updatedOptions });
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-100 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={opt.feedback || ''}
                          onChange={e => {
                            const updatedOptions = [...(editingCase ? (editingCase?.options || []) : (newCase.options || []))];
                            updatedOptions[idx] = { ...updatedOptions[idx], feedback: e.target.value };
                            if (editingCase) setEditingCase((prev: any) => !prev ? null : { ...prev, options: updatedOptions });
                            else setNewCase({ ...newCase, options: updatedOptions });
                          }}
                          placeholder="Зворотній зв'язок для цього варіанту (напр. 'Неправильно, тому що...')"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white ml-6"
                          style={{ width: 'calc(100% - 1.5rem)' }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newOpt = { id: `opt-${Date.now()}`, text: '', isCorrect: false, feedback: '' };
                        if (editingCase) setEditingCase((prev: any) => !prev ? null : { ...prev, options: [...editingCase?.options, newOpt] });
                        else setNewCase({ ...newCase, options: [...(newCase.options || []), newOpt] });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Додати варіант
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="case-active"
                      checked={editingCase ? editingCase?.isActive !== false : newCase.isActive}
                      onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, isActive: e.target.checked}) : setNewCase({...newCase, isActive: e.target.checked})}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="case-active" className="text-sm font-medium text-slate-700">Активний кейс</label>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        const payload = editingCase || newCase;
                        if (!payload.sectionId) {
                          alert('Обов\'язково оберіть інструкцію, до якої прив\'язаний цей кейс');
                          return;
                        }
                        if (!payload.title.trim() || !payload.scenario.trim()) {
                          alert('Заповніть назву та сценарій');
                          return;
                        }
                        if (!payload.options.some((o: any) => o.text.trim())) {
                          alert('Додайте хоча б один заповнений варіант');
                          return;
                        }
                        try {
                          const method = editingCase ? 'PUT' : 'POST';
                          const url = editingCase ? `/api/admin/cases/${editingCase?.id}` : '/api/admin/cases';
                          const res = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                          });
                          if (res.ok) {
                            setEditingCase(null);
                            setNewCase({ title: '', sectionId: '', scenario: '', options: [{ id: 'opt-1', text: '', isCorrect: true, feedback: '' }], isActive: true });
                            if (onRefresh) await onRefresh();
                          } else {
                            alert('Не вдалося зберегти кейс');
                          }
                        } catch (e) {
                          console.error('Failed to save case:', e);
                          alert('Помилка при збереженні кейсу');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      {editingCase ? 'Зберегти зміни' : 'Створити кейс'}
                    </button>
                    {editingCase && (
                      <button
                        onClick={() => setEditingCase(null)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
                      >
                        Скасувати
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-md font-bold text-slate-900">Існуючі кейси ({cases.length})</h4>
                {cases.map(c => {
                  const currentCaseId = c.id || c._id;
                  const isConfirming = deletingCaseId === currentCaseId;

                  return (
                    <div key={currentCaseId} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className={`font-bold ${c.isActive === false ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{c.title}</h5>
                          {c.isActive === false && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">Вимкнено</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{c.scenario}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => setEditingCase(c)} 
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          title="Редагувати кейс"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                            <span className="text-xs font-semibold text-rose-700">Видалити?</span>
                            <button 
                              type="button"
                              disabled={isDeletingCase}
                              onClick={() => handleDeleteCase(currentCaseId)} 
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs transition disabled:opacity-50"
                            >
                              {isDeletingCase ? '...' : 'Так'}
                            </button>
                            <button 
                              type="button"
                              disabled={isDeletingCase}
                              onClick={() => setDeletingCaseId(null)} 
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition"
                            >
                              Ні
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingCaseId(currentCaseId)} 
                            className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                            title="Видалити кейс"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: HELP / TEMPLATE */}
          {activeTab === 'help' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Формат та шаблон для завантаження</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Повна специфікація розмітки, промпт для моделей ШІ та еталонний файл .md
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPrompt}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
                      copiedPrompt
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-blue-600" />}
                    <span>{copiedPrompt ? 'Скопійовано!' : 'Скопіювати промпт для ШІ'}</span>
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-xs"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Завантажити шаблон (.md)</span>
                  </button>
                </div>
              </div>

              {/* Sub-tabs: Prompt vs Spec vs Template */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setHelpSubTab('prompt')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    helpSubTab === 'prompt'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Промпт для ШІ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHelpSubTab('spec')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    helpSubTab === 'spec'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Специфікація полів</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHelpSubTab('template')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    helpSubTab === 'template'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>Зразок файлу (.md)</span>
                </button>
              </div>

              {/* Sub-tab 1: AI Prompt Guide */}
              {helpSubTab === 'prompt' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed">
                    <p className="font-semibold mb-1">Як підготувати матеріали через інший ШІ:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Натисніть кнопку <strong>«Скопіювати промпт для ШІ»</strong> нижче або вгорі сторінки.</li>
                      <li>Відкрийте <strong>ChatGPT, Claude, Google Gemini або DeepSeek</strong>.</li>
                      <li>Вставте скопійований промпт, а після нього прикріпіть або вставте текст вашого вихідного регламенту (з Word, PDF чи наказу).</li>
                      <li>Модель ШІ згенерує готовий Markdown-текст. Збережіть його у файл з розширенням <code>.md</code> та імпортуйте у вкладці «Імпорт».</li>
                    </ol>
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Текст промпту для передачі моделям ШІ:
                      </span>
                      <button
                        onClick={handleDownloadPrompt}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Зберегти як .txt</span>
                      </button>
                    </div>
                    <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner max-h-[480px]">
                      {AI_PROMPT_GUIDE}
                    </pre>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Field Specification */}
              {helpSubTab === 'spec' && (
                <div className="space-y-6 text-sm text-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        1. Метадані інструкції
                      </h4>
                      <ul className="text-xs space-y-1.5 font-mono text-slate-600">
                        <li><code># Назва інструкції: [Назва]</code> — головний заголовок</li>
                        <li><code>**Підзаголовок:** [Короткий опис]</code> — тема розділу</li>
                        <li><code>**Підрозділ:** [Назва підрозділу]</code> — фільтрація у каталозі</li>
                        <li><code>**Суть:** [1-2 речення]</code> — ключовий висновок</li>
                        <li><code>**Роль:** all | cashier | manager | accountant</code></li>
                        <li><code>**Першоджерело:** [Стор. 1-3, Наказ №4]</code></li>
                        <li><code>**Час читання:** [хв, наприклад: 4 хв]</code></li>
                      </ul>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        2. Зміст та покрокові дії
                      </h4>
                      <ul className="text-xs space-y-1.5 text-slate-600">
                        <li><code>### ТЕКСТ РЕГЛАМЕНТУ</code> — ключові вимоги маркованим списком (<code>- пункт</code>).</li>
                        <li><code>### ПОКРОКОВИЙ ПОРЯДОК ДІЙ</code> — кроки з заголовками <code>#### Крок 1: Дія</code>, детальним описом, порадами (<code>💡 Підказка:</code>) та застереженнями (<code>⚠️ Увага:</code>).</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-600"></span>
                        3. Додавання зображень
                      </h4>
                      <ul className="text-xs space-y-1.5 text-slate-600">
                        <li>Зображення можна вставляти у тіло кроку (під <code>#### Крок X</code>) двома способами:</li>
                        <li>1. Стандартний Markdown-синтаксис:<br/> <code>![Опис](https://посилання-на-скріншот.jpg)</code></li>
                        <li>2. Або за допомогою спеціального тегу:<br/> <code>**Зображення:** https://посилання-на-скріншот.jpg</code></li>
                        <li>Підтримуються прямі посилання на зображення або <code>Base64</code> рядки.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                      <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        4. Таблиці та автоматичні дії
                      </h4>
                      <ul className="text-xs space-y-1.5 text-slate-600">
                        <li><code>### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ</code> — звичайна Markdown таблиця (<code>| Колонка 1 | Колонка 2 |</code>).</li>
                        <li><code>### АВТОМАТИЧНІ ДІЇ СИСТЕМИ</code> — список дій (<code>- дія</code>), які програма (BAS, CRM) виконує автоматично.</li>
                        <li><code>### СТОП-ПРАВИЛА</code> — список критичних заборон (<code>- правило</code>), відображається у червоній рамці уваги.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-white md:col-span-2">
                      <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                        5. Тестові питання
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ul className="text-xs space-y-1.5 text-slate-600">
                          <li><code>### ПИТАННЯ: [Текст питання?]</code></li>
                          <li><code>**Складність:** easy | medium | hard</code></li>
                          <li><code>**Контекст:** [Робоча ситуація/кейс]</code></li>
                          <li><code>**Першоджерело:** [Посилання на регламент]</code></li>
                        </ul>
                        <ul className="text-xs space-y-1.5 text-slate-600">
                          <li><code>- [x] Правильна відповідь</code> (рівно одна позначка <code>[x]</code>)</li>
                          <li><code>- [ ] Неправильна відповідь</code></li>
                          <li><code>**Пояснення:** [Чому саме так]</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Template File Preview */}
              {helpSubTab === 'template' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Повний еталонний приклад файлу .md:
                    </span>
                    <button
                      onClick={handleDownloadTemplate}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Завантажити цей приклад (.md)</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner max-h-[500px]">
                    {TEMPLATE_MD}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Керування користувачами</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Створення та редагування користувачів. Налаштування доступів до підрозділів та інструкцій.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-3">Список користувачів</h4>
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2">
                    {users.map(u => (
                      <div 
                        key={u._id}
                        onClick={() => {
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
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${selectedUser?._id === u._id ? 'border-purple-500 bg-purple-50/70 shadow-xs' : 'border-slate-200 bg-white hover:border-purple-300'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              {u.fullName ? `${u.fullName} (${u.email || u.username})` : (u.email || u.username)}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(u.roleKeys && u.roleKeys.length > 0 ? u.roleKeys : [u.role || 'employee']).map((rk: string) => {
                                const matchedRole = roles.find(r => r.key === rk);
                                const isAdm = rk === 'admin';
                                return (
                                  <span 
                                    key={rk} 
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                      isAdm 
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {matchedRole?.title || rk}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs border-t border-slate-100 pt-2">
                          <span className="text-slate-500">
                            {u.departmentId ? (
                              <span>Відділ: <strong className="text-slate-700">{
                                typeof u.departmentId === 'object' && u.departmentId
                                  ? (u.departmentId.name || 'Призначено')
                                  : (departments.find(d => (d._id || d.id) === u.departmentId)?.name || 'Призначено')
                              }</strong></span>
                            ) : (
                              <span>Підрозділів: {Array.isArray(u.departments) ? u.departments.length : 0}</span>
                            )}
                          </span>
                          {u.authMethod === 'otp' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ✉️ Email-код (8 знаків)
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">
                              Прямий вхід без коду
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {selectedUser ? (
                    <form onSubmit={handleUpdateUser} className="space-y-4 p-5 border border-slate-200 rounded-2xl bg-slate-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-sm">
                          Редагування користувача
                        </h4>
                        <span className="text-xs text-purple-700 font-mono bg-purple-100 px-2 py-0.5 rounded">
                          {selectedUser.email || selectedUser.username}
                        </span>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">ПІБ співробітника</label>
                        <input
                          type="text"
                          value={selectedUser.fullName || ''}
                          onChange={e => setSelectedUser({...selectedUser, fullName: e.target.value})}
                          placeholder="напр. Іваненко Петро Васильович"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email (@viatec.ua) *</label>
                        <input
                          type="email"
                          required
                          value={selectedUser.email || ''}
                          onChange={e => setSelectedUser({...selectedUser, email: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Role selection (RBAC) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Призначені ролі (RBAC)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 bg-white border border-slate-200 rounded-xl max-h-[150px] overflow-y-auto">
                          {roles.map(r => {
                            const currentRoles: string[] = selectedUser.roleKeys || [selectedUser.role || 'employee'];
                            const isChecked = currentRoles.includes(r.key);
                            return (
                              <label key={r.key} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    let next: string[];
                                    if (e.target.checked) {
                                      next = [...currentRoles, r.key];
                                    } else {
                                      next = currentRoles.filter(k => k !== r.key);
                                      if (next.length === 0) next = ['employee'];
                                    }
                                    const nextRole = next.includes('admin') ? 'admin' : 'user';
                                    setSelectedUser({ ...selectedUser, roleKeys: next, role: nextRole });
                                  }}
                                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <div>
                                  <span className="font-medium text-slate-800">{r.title}</span>
                                  <span className="text-[10px] text-slate-400 ml-1 font-mono">({r.key})</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Primary Department and Manager */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Основний підрозділ</label>
                          <select
                            value={typeof selectedUser.departmentId === 'object' ? (selectedUser.departmentId?._id || '') : (selectedUser.departmentId || '')}
                            onChange={e => setSelectedUser({...selectedUser, departmentId: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Не обрано</option>
                            {departments.map(d => (
                              <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Керівник (Manager)</label>
                          <select
                            value={typeof selectedUser.managerId === 'object' ? (selectedUser.managerId?._id || '') : (selectedUser.managerId || '')}
                            onChange={e => setSelectedUser({...selectedUser, managerId: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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

                      {/* Position, Location, Hire date, Active status — Крок 10 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Посада</label>
                          <select
                            value={typeof selectedUser.positionId === 'object' ? (selectedUser.positionId?._id || '') : (selectedUser.positionId || '')}
                            onChange={e => setSelectedUser({...selectedUser, positionId: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Не обрано</option>
                            {positions.map(p => (
                              <option key={p._id} value={p._id}>{p.title}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Локація</label>
                          <select
                            value={typeof selectedUser.locationId === 'object' ? (selectedUser.locationId?._id || '') : (selectedUser.locationId || '')}
                            onChange={e => setSelectedUser({...selectedUser, locationId: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Не обрано</option>
                            {locations.map(l => (
                              <option key={l._id} value={l._id}>{l.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Дата найму</label>
                          <input
                            type="date"
                            value={selectedUser.hireDate ? String(selectedUser.hireDate).slice(0, 10) : ''}
                            onChange={e => setSelectedUser({...selectedUser, hireDate: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedUser.isActive !== false}
                              onChange={e => setSelectedUser({...selectedUser, isActive: e.target.checked})}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            Активний співробітник
                          </label>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Варіант авторизації
                        </label>
                        <select
                          value={selectedUser.authMethod || 'password'}
                          onChange={e => setSelectedUser({...selectedUser, authMethod: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="password">Стандартний логін (email) та пароль</option>
                          <option value="otp">Логін та 8-значний випадковий ключ (Email)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Новий пароль {selectedUser.authMethod === 'otp' ? '(не використовується)' : '(залиште порожнім, щоб не змінювати)'}
                        </label>
                        <div className="relative">
                          <input
                            type={showEditPassword ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={selectedUser.authMethod === 'otp'}
                            value={selectedUser.newPassword || ''}
                            onChange={e => setSelectedUser({...selectedUser, newPassword: e.target.value})}
                            className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <button
                            type="button"
                            disabled={selectedUser.authMethod === 'otp'}
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
                            title={showEditPassword ? "Приховати пароль" : "Показати пароль"}
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
                                onChange={(e) => {
                                  const deps = selectedUser.departments || [];
                                  if (e.target.checked) {
                                    setSelectedUser({...selectedUser, departments: [...deps, d.name]});
                                  } else {
                                    setSelectedUser({...selectedUser, departments: deps.filter((x: string) => x !== d.name)});
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
                                onChange={(e) => {
                                  const allowed = selectedUser.allowedInstructionIds || [];
                                  if (e.target.checked) {
                                    setSelectedUser({...selectedUser, allowedInstructionIds: [...allowed, s.id]});
                                  } else {
                                    setSelectedUser({...selectedUser, allowedInstructionIds: allowed.filter((x: string) => x !== s.id)});
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
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          ПІБ співробітника
                        </label>
                        <input
                          type="text"
                          value={newUser.fullName || ''}
                          onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="напр. Іваненко Петро Васильович"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Корпоративний Email (@viatec.ua) *
                        </label>
                        <input
                          type="email"
                          required
                          value={newUser.email}
                          onChange={e => setNewUser({...newUser, email: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="user@viatec.ua"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Email використовується як логін для входу в систему.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Пароль {newUser.authMethod === 'otp' ? '(не використовується)' : '*'}
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            required={newUser.authMethod !== 'otp'}
                            disabled={newUser.authMethod === 'otp'}
                            value={newUser.password}
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                            className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            disabled={newUser.authMethod === 'otp'}
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50"
                            title={showNewPassword ? "Приховати пароль" : "Показати пароль"}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Варіант авторизації
                        </label>
                        <select
                          value={(newUser as any).authMethod || 'password'}
                          onChange={e => setNewUser({...newUser, authMethod: e.target.value} as any)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="password">Стандартний логін (email) та пароль</option>
                          <option value="otp">Логін та 8-значний випадковий ключ (Email)</option>
                        </select>
                      </div>

                      {/* Role selection (RBAC) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Призначені ролі (RBAC)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 bg-white border border-slate-200 rounded-xl max-h-[140px] overflow-y-auto">
                          {roles.map(r => {
                            const currentRoles: string[] = newUser.roleKeys || [newUser.role || 'employee'];
                            const isChecked = currentRoles.includes(r.key);
                            return (
                              <label key={r.key} className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    let next: string[];
                                    if (e.target.checked) {
                                      next = [...currentRoles, r.key];
                                    } else {
                                      next = currentRoles.filter(k => k !== r.key);
                                      if (next.length === 0) next = ['employee'];
                                    }
                                    const nextRole = next.includes('admin') ? 'admin' : 'user';
                                    setNewUser({ ...newUser, roleKeys: next, role: nextRole });
                                  }}
                                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <div>
                                  <span className="font-medium text-slate-800">{r.title}</span>
                                  <span className="text-[10px] text-slate-400 ml-1 font-mono">({r.key})</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Primary Department and Manager */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Основний підрозділ</label>
                          <select
                            value={newUser.departmentId || ''}
                            onChange={e => setNewUser({...newUser, departmentId: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Не обрано</option>
                            {departments.map(d => (
                              <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Керівник (Manager)</label>
                          <select
                            value={newUser.managerId || ''}
                            onChange={e => setNewUser({...newUser, managerId: e.target.value || undefined})}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          )}

          {/* TAB: ROLES & PERMISSIONS */}
          {activeTab === 'roles' && <RoleSettings />}

          {/* TAB: DEPARTMENTS */}
          {activeTab === 'organization' && <OrganizationSettings />}
          {activeTab === 'notifications' && <NotificationTemplates />}
          {activeTab === 'analytics' && <AnalyticsReports courses={courses} />}

          {/* TAB: KNOWLEDGE SPACES & LIFECYCLE */}
          {activeTab === 'knowledge' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-blue-600" /> База знань: Простори, версії та статуси
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Керування робочими просторами (областями знань), публікацією ревізій, історією змін та життєвим циклом регламентів
                </p>
              </div>
              <KnowledgeSettings 
                spaces={spaces}
                sections={sections}
                onRefresh={onRefresh || (async () => {})}
              />
            </div>
          )}

          {/* TAB: ASSIGNMENTS (Крок 7. Рушій призначень) */}
          {activeTab === 'assignments' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <AssignmentSettings courses={courses} sections={sections} />
            </div>
          )}

        </div>
      </div>
      
      {editingMarkdownInstId && (
        <MarkdownEditor 
          initialValue={editingMarkdownContent}
          onSave={handleSaveMarkdown}
          onCancel={() => {
            setEditingMarkdownInstId(null);
            setEditingMarkdownContent('');
          }}
        />
      )}
    </div>
  );
};
