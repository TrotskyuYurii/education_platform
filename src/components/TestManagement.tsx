import { MaterialList, MaterialRow } from './Admin/MaterialList';
import { MaterialPreviewDialog, MaterialPreviewTarget } from './Admin/MaterialPreviewDialog';
import {
  MaterialEditDialog,
  FormField,
  FormCheckbox,
  FormSection,
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS
} from './Admin/MaterialEditDialog';
import { UserManagement } from './Admin/UserManagement';
import { useAuth } from '../context/AuthContext';
import { useAiImportJobs } from '../context/AiImportJobsContext';
import { useSystemLogAlarm } from '../hooks/useSystemLogAlarm';
import React, { useState, useRef, useMemo, Suspense, lazy } from 'react';
import { InstructionSection, QuizQuestion, KnowledgeSpace } from '../types';
import { AI_PROMPT_GUIDE, parseMarkdown, exportToMarkdown } from '../utils/markdownParser';

/**
 * Панелі адміністрування вантажаться на вимогу.
 *
 * Статичними імпортами вони тягнули у чанк адмінки recharts (через звіти) і
 * @xyflow (через редактор схем онбордингу) — разом близько пів мегабайта, який
 * завантажувався навіть тоді, коли адміністратор зайшов лише виправити текст
 * інструкції. Кожна з них і так малюється за умовою activeTab, тож lazy тут
 * нічого не змінює в логіці, лише відкладає завантаження коду.
 */
const AdminHelpTab = lazy(() => import('./Admin/AdminHelpTab').then(m => ({ default: m.AdminHelpTab })));
const AnalyticsReports = lazy(() => import('./Analytics/AnalyticsReports').then(m => ({ default: m.AnalyticsReports })));
const OnboardingManagement = lazy(() => import('./Onboarding/OnboardingManagement').then(m => ({ default: m.OnboardingManagement })));
const OrganizationSettings = lazy(() => import('./Admin/OrganizationSettings').then(m => ({ default: m.OrganizationSettings })));
const RoleSettings = lazy(() => import('./Admin/RoleSettings').then(m => ({ default: m.RoleSettings })));
const KnowledgeSettings = lazy(() => import('./Admin/KnowledgeSettings').then(m => ({ default: m.KnowledgeSettings })));
const AssignmentSettings = lazy(() => import('./Admin/AssignmentSettings').then(m => ({ default: m.AssignmentSettings })));
const NotificationTemplates = lazy(() => import('./Admin/NotificationTemplates').then(m => ({ default: m.NotificationTemplates })));
const SystemLogPanel = lazy(() => import('./Admin/SystemLogPanel').then(m => ({ default: m.SystemLogPanel })));

/** Спільна заглушка на час підвантаження чанка панелі. */
const PanelFallback = () => (
  <div className="py-16 flex items-center justify-center" role="status" aria-live="polite">
    <div className="h-7 w-7 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
    <span className="sr-only">Завантаження розділу…</span>
  </div>
);
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
  BarChart3,
  ScrollText,
  Plus,
  Paperclip,
  Rocket
} from 'lucide-react';

/** Що сервер зробив зі скріншотами документа під час імпорту. */
export interface ImportAssetReport {
  /** Збережено файлів у теці інструкції */
  saved: number;
  /** З них розставлено в тексті інструкції */
  used: number;
  /** Прибрано посилань на файли, яких не існує */
  dropped: number;
}

interface TestManagementProps {
  sections: InstructionSection[];
  questions: QuizQuestion[];
  courses: any[];
  cases: any[];
  spaces?: KnowledgeSpace[];
  /** Повертає звіт сервера по збережених скріншотах, якщо імпорт пройшов успішно. */
  onImport: (
    newSections: InstructionSection[],
    newQuestions: QuizQuestion[],
    replace: boolean
  ) => void | Promise<ImportAssetReport | void>;
  onReset: () => void;
  isSetupMode?: boolean;
  onRefresh?: () => Promise<void>;
  /** Відкрити маршрут конкретного онбордінгу на вкладці «Онбординг». */
  onOpenOnboardingAssignment?: (assignmentId: string) => void;
  /** Відкрити певну вкладку при вході в розділ (напр. за кліком по індикатору тривоги). */
  initialTab?: 'systemlog';
}

type MgmtTab = 'list' | 'courses' | 'cases' | 'knowledge' | 'assignments' | 'onboarding' | 'import' | 'export' | 'help' | 'users' | 'roles' | 'organization' | 'notifications' | 'analytics' | 'systemlog';

/** Порожній курс для форми створення — ті самі значення за умовчанням, що й на сервері. */
const blankCourse = () => ({
  title: '',
  department: '',
  instructionIds: [] as string[],
  caseIds: [] as string[],
  useCases: false,
  hasCertificate: false,
  certificateValidityYears: 1,
  isActive: true,
  isProgressive: false,
  quizPassScorePercent: 80,
  quizTimeLimitMin: undefined as number | undefined,
  quizMaxAttempts: undefined as number | undefined
});

export const TestManagement: React.FC<TestManagementProps> = ({
  sections,
  questions,
  courses,
  cases,
  spaces = [],
  onImport,
  onReset,
  isSetupMode,
  onRefresh,
  onOpenOnboardingAssignment,
  initialTab
}) => {
  const { hasPermission } = useAuth();
  // Пакетна ШІ-обробка виконується у фоні: адмінка лише ставить файли в чергу.
  const { enqueueFiles, isEnqueuing, activeJobs } = useAiImportJobs();

  /**
   * Форма курсу — одна на створення й редагування.
   *
   * Раніше створення курсу було окремим блоком, розгорнутим над списком: та сама
   * добірка інструкцій, ті самі налаштування тесту, але власна верстка і власний
   * стан. Через це дві форми розходилися при кожній зміні, а сам блок займав
   * пів екрана й відсував перелік курсів униз. Тепер курс створюється у тому ж
   * діалозі, що й редагується (як кейси та призначення), а `creatingCourse`
   * лише перемикає заголовок і метод збереження.
   */
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [assignmentsCount, setAssignmentsCount] = useState<number | null>(null);
  const [onboardingCount, setOnboardingCount] = useState<number | null>(null);
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

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/v2/org/departments');
      const data = await res.json();
      if (res.ok) setDepartments(Array.isArray(data) ? data : []);
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

  // Каталог онбордінгів за замовчуванням не віддає архівні — саме стільки
  // схем адміністратор і побачить, відкривши розділ.
  const fetchOnboardingCount = async () => {
    try {
      const res = await fetch('/api/v2/onboarding/templates');
      const data = await res.json();
      if (res.ok && Array.isArray(data?.templates)) setOnboardingCount(data.templates.length);
    } catch (err) {}
  };

  // Підрозділи потрібні одразу (з них будується availableDepartments), а два
  // лічильники — для бейджів у навігації. Решту довідників тепер вантажить
  // сама вкладка «Користувачі», коли її відкривають.
  React.useEffect(() => {
    fetchDepartments();
    fetchAssignmentsCount();
    fetchOnboardingCount();
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

  // Фільтр і пошук у добірці інструкцій — спільні для створення й редагування курсу.
  const [courseInstFilter, setCourseInstFilter] = useState('all');
  const [courseInstSearch, setCourseInstSearch] = useState('');
  // Спільний для всіх форм редагування матеріалів стан збереження:
  // діалог показує спінер і текст помилки замість alert().
  const [creatingCase, setCreatingCase] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);

  const [editingCase, setEditingCase] = useState<any>(null);
   // dummy if missing
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [isDeletingCase, setIsDeletingCase] = useState(false);

  const [copiedPrompt, setCopiedPrompt] = useState(false);

const [showImportPanel, setShowImportPanel] = useState<boolean>(false);
  const [showExportPanel, setShowExportPanel] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<MgmtTab>(() => {
    if (isSetupMode) return 'users';
    // Явний запит ззовні (клік по індикатору тривоги) має пріоритет над збереженою вкладкою.
    if (initialTab) return initialTab;
    try {
      const saved = localStorage.getItem('viatec_mgmt_tab') as MgmtTab;
      if (saved === 'import' || saved === 'export') {
        return 'list';
      }
      if (saved && ['list', 'courses', 'cases', 'knowledge', 'assignments', 'onboarding', 'help', 'users', 'roles', 'organization', 'notifications', 'analytics', 'systemlog'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'list';
  });

  // Зведення журналу — для червоного лічильника на вкладці.
  const { summary: logSummary, canView: canViewLogs, refresh: refreshLogSummary } = useSystemLogAlarm();

  // Після опрацювання записів лічильник має оновитись без очікування наступного полінгу.
  React.useEffect(() => {
    if (activeTab !== 'systemlog') refreshLogSummary();
  }, [activeTab, refreshLogSummary]);

  // Зовнішній запит може прийти й коли розділ уже змонтований.
  React.useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

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
  const pdfAttachInputRef = useRef<HTMLInputElement>(null);

  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [attachedSourcePdf, setAttachedSourcePdf] = useState<File | null>(null);

  const [editingMarkdownInstId, setEditingMarkdownInstId] = useState<string | null>(null);
  const [editingMarkdownContent, setEditingMarkdownContent] = useState<string>('');
  const [exportMenuInstId, setExportMenuInstId] = useState<string | null>(null);

  /**
   * Матеріал, відкритий на перегляд поверх списку. Дає подивитися готовий
   * вигляд інструкції, курсу чи кейса, не виходячи з адміністрування.
   */
  const [previewTarget, setPreviewTarget] = useState<MaterialPreviewTarget | null>(null);

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
      // Відредагований текст — це і є .md файл документа: зберігаємо його як першоджерело
      newSection.rawMarkdown = md;

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
      setEditingMarkdownInstId(null);
      setEditingMarkdownContent('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert('Помилка збереження вмісту інструкції');
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

  /**
   * Скільки питань прив'язано до кожної інструкції.
   *
   * Раніше на кожну інструкцію робився окремий прохід по всіх питаннях, тобто
   * O(інструкції × питання): на базі з 200 регламентів і 2000 питань це
   * чотириста тисяч порівнянь. Один прохід із групуванням у Map дає той самий
   * результат за O(інструкції + питання).
   */
  const questionCountBySection = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      if (!q.sectionId) continue;
      counts.set(q.sectionId, (counts.get(q.sectionId) || 0) + 1);
    }
    return counts;
  }, [questions]);

  const groupedCourses = React.useMemo(() => {
    // Return sections since we are listing instructions
    return sections.map(sec => ({
      id: sec.id,
      title: sec.title,
      department: sec.department || 'Загальний',
      isActive: sec.isActive !== undefined ? sec.isActive : true,
      questionCount: questionCountBySection.get(sec.id) || 0
    }));
  }, [sections, questionCountBySection]);

  /**
   * Інструкції, відфільтровані для добірки у формі курсу.
   *
   * Список проганяв цей самий ланцюжок фільтрів двічі за рендер: раз щоб
   * намалювати рядки, і вдруге — щоб перевірити, чи результат порожній. Разом
   * із полем пошуку це означало два проходи по всій базі інструкцій з
   * приведенням регістру на кожне натискання клавіші.
   */
  const filterSections = (departmentFilter: string, search: string) => {
    const query = search.trim().toLowerCase();
    return sections.filter(sec => {
      if (departmentFilter && departmentFilter !== 'all' && sec.department !== departmentFilter) {
        return false;
      }
      if (!query) return true;
      return (sec.title && sec.title.toLowerCase().includes(query)) ||
             (sec.department && sec.department.toLowerCase().includes(query));
    });
  };

  const courseVisibleSections = React.useMemo(
    () => filterSections(courseInstFilter, courseInstSearch),
    [sections, courseInstFilter, courseInstSearch]
  );

  /**
   * Скільки інструкцій у кожному підрозділі. Список вибору підрозділу рахував
   * це лінійним пошуком просто в розмітці, на кожен рендер і для кожного
   * підрозділу.
   */
  const sectionCountByDepartment = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const sec of sections) {
      const dep = sec.department;
      if (!dep) continue;
      counts.set(dep, (counts.get(dep) || 0) + 1);
    }
    return counts;
  }, [sections]);

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

  const uploadSourceFile = async (file: File): Promise<{ sourceFileToken: string; sourceFileName: string; sourceMimeType: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload-source-file', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не вдалося завантажити оригінал документа');
    return { sourceFileToken: data.sourceFileToken, sourceFileName: data.fileName, sourceMimeType: data.mimeType };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, replace: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();

    reader.onload = async (event) => {
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

        result.sections[0].rawMarkdown = text;

        if (attachedSourcePdf) {
          try {
            const uploaded = await uploadSourceFile(attachedSourcePdf);
            Object.assign(result.sections[0], uploaded);
          } catch (uploadErr: any) {
            setImportStatus({
              type: 'error',
              message: uploadErr.message || 'Не вдалося прикріпити оригінал PDF.'
            });
            return;
          }
        }

        onImport(result.sections, result.questions, replace);
        setImportStatus({
          type: 'success',
          message: `Успішно імпортовано: інструкція та ${result.questions.length} питань.`
        });
        setAttachedSourcePdf(null);
        if (pdfAttachInputRef.current) pdfAttachInputRef.current.value = '';
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

  /**
   * Пачка документів для ШІ-генерації.
   *
   * Обробка одного файлу займає десятки секунд, тож усе, що робить адмінка, —
   * віддає файли серверу в чергу. Далі прогрес показує плаваюча панель, а
   * людина може спокійно піти в будь-який інший розділ додатка.
   */
  const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setImportStatus(null);
    const result = await enqueueFiles(files);
    setImportStatus({ type: result.ok ? 'success' : 'error', message: result.message });

    if (aiFileInputRef.current) {
      aiFileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 sm:px-6 sm:py-5 shadow-xs mb-5 lg:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
              <Settings2 className="w-5.5 h-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Адміністрування
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                Керування тестами та інструкціями
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex flex-col lg:flex-row gap-5 xl:gap-6 items-stretch lg:items-start">
        
        {/* Left Nav */}
        {!isSetupMode && (
          <div className="w-full lg:w-64 xl:w-72 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xs p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
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
                    onClick={() => setActiveTab('onboarding')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      activeTab === 'onboarding'
                        ? 'bg-purple-100 text-purple-800 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Rocket className="w-4 h-4 text-purple-600" />
                      <span>Онбординг</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition ${
                      activeTab === 'onboarding'
                        ? 'bg-purple-200/80 text-purple-900'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {onboardingCount !== null ? onboardingCount : '—'}
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

                  {canViewLogs && (
                    <button
                      onClick={() => setActiveTab('systemlog')}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                        activeTab === 'systemlog'
                          ? 'bg-purple-100 text-purple-800 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ScrollText className={`w-4 h-4 ${logSummary.unresolvedErrors > 0 ? 'text-rose-600' : ''}`} />
                        <span>Журнал</span>
                      </div>
                      {logSummary.unresolvedErrors > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-rose-600 text-white animate-pulse">
                          {logSummary.unresolvedErrors}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Content */}
        <div className="grow min-w-0 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 xl:p-8 min-h-[520px]">
          
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
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        ref={pdfAttachInputRef}
                        onChange={(e) => setAttachedSourcePdf(e.target.files?.[0] || null)}
                      />

                      <button
                        onClick={() => pdfAttachInputRef.current?.click()}
                        className={`mb-3 px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                          attachedSourcePdf
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                        title="Прикріпити оригінал документа у форматі PDF (опційно)"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {attachedSourcePdf ? attachedSourcePdf.name : 'Прикріпити оригінал (PDF, опційно)'}
                      </button>

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
                      {isEnqueuing && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                          <span className="text-xs font-bold text-indigo-900">Завантаження файлів...</span>
                        </div>
                      )}
                      <Sparkles className="w-8 h-8 text-indigo-500 mb-2" />
                      <p className="text-sm font-semibold text-indigo-900 mb-1">
                        2. ШІ-Генерація (docx, pdf, txt)
                      </p>
                      <p className="text-xs text-indigo-500/80 mb-4 max-w-sm">
                        Виберіть один або одразу кілька документів (до 25 за раз). ШІ обробить їх у фоні —
                        можна закрити цю сторінку та працювати далі, прогрес показується в кутку екрана.
                      </p>

                      <input 
                        type="file" 
                        accept=".pdf,.txt,.docx"
                        multiple
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
                        disabled={isEnqueuing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition w-full max-w-[220px]"
                      >
                        Вибрати файли та обробити
                      </button>

                      {activeJobs.length > 0 && (
                        <div className="mt-4 w-full max-w-[280px] space-y-2">
                          {activeJobs.map(job => (
                            <div key={job.id} className="text-left">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900 mb-1">
                                <span className="truncate pr-2">
                                  Оброблено {job.processedFiles} з {job.totalFiles}
                                </span>
                                <span className="shrink-0">{job.percent}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                  style={{ width: `${job.percent}%` }}
                                />
                              </div>
                              {job.currentFileName && (
                                <p className="text-[10px] text-indigo-500 mt-1 truncate" title={job.currentFileName}>
                                  Зараз: {job.currentFileName}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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

              <MaterialList
                isEmpty={groupedCourses.length === 0}
                empty="База інструкцій порожня."
              >
                {groupedCourses.map((inst) => (
                  <MaterialRow
                    key={inst.id}
                    icon={<FileText className="w-4 h-4" />}
                    iconTone="bg-blue-50 text-blue-600 border-blue-100"
                    title={inst.title}
                    dimmed={inst.isActive === false}
                    badges={[
                      ...(inst.department ? [{ label: inst.department, tone: 'blue' as const }] : []),
                      ...(inst.isActive === false ? [{ label: 'Вимкнено', tone: 'slate' as const }] : [])
                    ]}
                    meta={`ID: ${inst.id} · Питань: ${inst.questionCount}`}
                    actions={
                      <>
                        <button
                          onClick={() => setPreviewTarget({ kind: 'instruction', id: inst.id })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200"
                          title="Переглянути інструкцію так, як її бачить співробітник"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Перегляд</span>
                        </button>

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
                            setMaterialError(null);
                          }}
                          className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                          title="Редагувати інструкцію"
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
                      </>
                    }
                  />
                ))}
              </MaterialList>
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

              <div className="flex justify-end">
                <button
                  id="btn-open-create-course"
                  onClick={() => {
                    setMaterialError(null);
                    setCourseInstFilter('all');
                    setCourseInstSearch('');
                    setEditingCourse(blankCourse());
                    setCreatingCourse(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Створити курс
                </button>
              </div>

              <MaterialList
                isEmpty={courses.length === 0}
                empty="Немає створених курсів."
              >
                {courses.map((course) => {
                  const currentCourseId = course.id || course._id;
                  return (
                  <MaterialRow
                    key={currentCourseId}
                    icon={<BookOpen className="w-4 h-4" />}
                    iconTone="bg-purple-50 text-purple-600 border-purple-100"
                    title={course.title}
                    dimmed={!course.isActive}
                    badges={[
                      ...(course.department ? [{ label: course.department, tone: 'blue' as const }] : []),
                      ...(!course.isActive ? [{ label: 'Вимкнено', tone: 'slate' as const }] : []),
                      ...(course.hasCertificate
                        ? [{ label: `Сертифікат (${course.certificateValidityYears} р.)`, tone: 'emerald' as const }]
                        : [])
                    ]}
                    meta={`Включає ${course.instructionIds?.length || 0} інструкцій`}
                    actions={
                      <>
                        <button
                          onClick={() => setPreviewTarget({ kind: 'course', id: currentCourseId })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200"
                          title="Переглянути склад курсу та його матеріали"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Перегляд</span>
                        </button>
                        <button
                          onClick={() => {
                            setMaterialError(null);
                            setCreatingCourse(false);
                            setCourseInstFilter('all');
                            setCourseInstSearch('');
                            setEditingCourse({
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
                            });
                          }}
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
                      </>
                    }
                  />
                  );
                })}
              </MaterialList>
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

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingCase(null);
                    setNewCase({ title: '', sectionId: '', scenario: '', options: [{ id: 'opt-1', text: '', isCorrect: true, feedback: '' }], isActive: true });
                    setCreatingCase(true);
                    setMaterialError(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Створити кейс
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-md font-bold text-slate-900">Існуючі кейси ({cases.length})</h4>
                <MaterialList
                  isEmpty={cases.length === 0}
                  empty="Немає створених кейсів."
                >
                  {cases.map(c => {
                    const currentCaseId = c.id || c._id;
                    const isConfirming = deletingCaseId === currentCaseId;
                    return (
                      <MaterialRow
                        key={currentCaseId}
                        icon={<Briefcase className="w-4 h-4" />}
                        iconTone="bg-amber-50 text-amber-600 border-amber-100"
                        title={c.title}
                        dimmed={c.isActive === false}
                        badges={c.isActive === false ? [{ label: 'Вимкнено', tone: 'slate' as const }] : []}
                        meta={<span className="line-clamp-2">{c.scenario}</span>}
                        actions={
                          <>
                            <button
                              onClick={() => setPreviewTarget({ kind: 'case', id: currentCaseId })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200"
                              title="Переглянути сценарій кейса з правильними відповідями"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>Перегляд</span>
                            </button>

                            <button
                            onClick={() => { setMaterialError(null); setEditingCase(c); }}
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
                          </>
                        }
                      />
                    );
                  })}
                </MaterialList>
              </div>
            </div>
          )}

          {/* TAB: HELP / TEMPLATE */}
          {activeTab === 'help' && (
            <Suspense fallback={<PanelFallback />}>
              <AdminHelpTab />
            </Suspense>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <UserManagement sections={sections} departments={departments} />
          )}

          {/* TAB: ROLES & PERMISSIONS */}
          <Suspense fallback={<PanelFallback />}>
          {activeTab === 'roles' && <RoleSettings />}

          {/* TAB: DEPARTMENTS */}
          {activeTab === 'organization' && <OrganizationSettings />}
          {activeTab === 'notifications' && <NotificationTemplates />}
          {activeTab === 'analytics' && <AnalyticsReports courses={courses} />}
          {activeTab === 'systemlog' && <SystemLogPanel />}

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

          {activeTab === 'onboarding' && (
            <OnboardingManagement
              sections={sections}
              courses={courses}
              cases={cases}
              onOpenAssignment={onOpenOnboardingAssignment}
              onCatalogChanged={setOnboardingCount}
            />
          )}
          </Suspense>

        </div>
      </div>
      
      {/* Створення / редагування кейсу */}
      <MaterialEditDialog
        open={Boolean(editingCase) || creatingCase}
        onClose={() => { setEditingCase(null); setCreatingCase(false); setMaterialError(null); }}
        icon={<Briefcase className="w-4 h-4" />}
        iconTone="bg-amber-50 text-amber-600 border-amber-100"
        title={editingCase ? 'Редагувати кейс' : 'Створити кейс'}
        subtitle={editingCase?.title}
        size="lg"
        saving={savingMaterial}
        error={materialError}
        submitLabel={editingCase ? 'Зберегти' : 'Створити'}
        onSubmit={async () => {
          const payload = editingCase || newCase;
          if (!payload.sectionId) {
            setMaterialError("Обов'язково оберіть інструкцію, до якої прив'язаний цей кейс");
            return;
          }
          if (!payload.title.trim() || !payload.scenario.trim()) {
            setMaterialError('Заповніть назву та сценарій');
            return;
          }
          if (!payload.options.some((o: any) => o.text.trim())) {
            setMaterialError('Додайте хоча б один заповнений варіант');
            return;
          }
          setSavingMaterial(true);
          setMaterialError(null);
          try {
            const method = editingCase ? 'PUT' : 'POST';
            const url = editingCase ? `/api/admin/cases/${editingCase?.id}` : '/api/admin/cases';
            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || 'Не вдалося зберегти кейс');
            }
            setEditingCase(null);
            setCreatingCase(false);
            setNewCase({ title: '', sectionId: '', scenario: '', options: [{ id: 'opt-1', text: '', isCorrect: true, feedback: '' }], isActive: true });
            if (onRefresh) await onRefresh();
          } catch (e: any) {
            setMaterialError(e?.message || 'Помилка при збереженні кейсу');
          } finally {
            setSavingMaterial(false);
          }
        }}
      >
        <FormField label="Назва кейсу" required>
          <input
            type="text"
            value={editingCase ? editingCase?.title : newCase.title}
            onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, title: e.target.value }) : setNewCase({ ...newCase, title: e.target.value })}
            placeholder="Напр. Розгніваний клієнт на касі"
            className={FIELD_INPUT_CLASS}
          />
        </FormField>

        <FormField label="Прив'язка до інструкції" required>
          <select
            value={editingCase ? editingCase?.sectionId || '' : newCase.sectionId || ''}
            onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, sectionId: e.target.value }) : setNewCase({ ...newCase, sectionId: e.target.value })}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">-- Оберіть інструкцію --</option>
            {sections.map(sec => (
              <option key={sec.id} value={sec.id}>{sec.title}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Сценарій (опис ситуації)" required>
          <textarea
            value={editingCase ? editingCase?.scenario : newCase.scenario}
            onChange={e => editingCase ? setEditingCase((prev: any) => !prev ? null : { ...prev, scenario: e.target.value }) : setNewCase({ ...newCase, scenario: e.target.value })}
            placeholder="Опишіть ситуацію детально..."
            rows={4}
            className={`${FIELD_INPUT_CLASS} resize-none`}
          />
        </FormField>

        <div>
          <label className={FIELD_LABEL_CLASS}>Варіанти відповідей (виберіть правильний)</label>
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
      </MaterialEditDialog>

      {/* Редагування курсу */}
      {/* Створення та редагування курсу — одна форма, як у кейсів */}
      <MaterialEditDialog
        open={Boolean(editingCourse)}
        onClose={() => { setEditingCourse(null); setCreatingCourse(false); setMaterialError(null); }}
        icon={<BookOpen className="w-4 h-4" />}
        iconTone="bg-purple-50 text-purple-600 border-purple-100"
        title={creatingCourse ? 'Створити курс' : 'Редагувати курс'}
        subtitle={creatingCourse ? 'Оберіть інструкції та умови проходження' : editingCourse?.title}
        size="lg"
        saving={savingMaterial}
        error={materialError}
        submitLabel={creatingCourse ? 'Створити' : 'Зберегти'}
        submitDisabled={!editingCourse?.title || !editingCourse?.department}
        onSubmit={async () => {
          setSavingMaterial(true);
          setMaterialError(null);
          try {
            const courseIdToUpdate = editingCourse?.id || editingCourse?._id;
            const res = await fetch(
              creatingCourse ? '/api/admin/courses' : `/api/admin/courses/${encodeURIComponent(courseIdToUpdate)}`,
              {
                method: creatingCourse ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingCourse)
              }
            );
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(
                errData.error || (creatingCourse ? 'Не вдалося створити курс' : 'Не вдалося зберегти зміни курсу')
              );
            }
            setEditingCourse(null);
            setCreatingCourse(false);
            if (onRefresh) await onRefresh();
          } catch (err: any) {
            setMaterialError(
              err?.message || (creatingCourse ? 'Помилка при створенні курсу' : 'Помилка при збереженні курсу')
            );
          } finally {
            setSavingMaterial(false);
          }
        }}
      >
        <FormField label="Назва курсу" required>
          <input
            type="text"
            placeholder="Назва курсу"
            value={editingCourse?.title || ''}
            onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, title: e.target.value })}
            className={FIELD_INPUT_CLASS}
          />
        </FormField>

        <FormField label="Підрозділ" required>
          <select
            value={editingCourse?.department || ''}
            onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, department: e.target.value })}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">Оберіть підрозділ...</option>
            {availableDepartments.map(depName => (
              <option key={depName} value={depName}>{depName}</option>
            ))}
          </select>
        </FormField>

        <FormCheckbox
          id="edit-cert"
          checked={editingCourse?.hasCertificate || false}
          onChange={checked => setEditingCourse((prev: any) => !prev ? null : { ...prev, hasCertificate: checked })}
          label="Видавати сертифікат"
        />
                    
        {editingCourse?.hasCertificate && (
          <FormField label="Термін дії сертифіката, років" className="ml-6">
            <input
              type="number"
              min="1"
              max="10"
              value={editingCourse?.certificateValidityYears || 1}
              onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, certificateValidityYears: parseInt(e.target.value) || 1 })}
              className={`${FIELD_INPUT_CLASS} max-w-[120px]`}
            />
          </FormField>
        )}

        <FormCheckbox
          id="edit-course-active"
          checked={editingCourse?.isActive !== false}
          onChange={checked => setEditingCourse((prev: any) => !prev ? null : { ...prev, isActive: checked })}
          label="Курс активний"
          hint="Неактивні курси приховані від співробітників і недоступні для проходження."
        />

        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
          <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-700">Інструкції для курсу ({editingCourse?.instructionIds?.length || 0} обрано)</div>
              <select
                value={courseInstFilter}
                onChange={e => setCourseInstFilter(e.target.value)}
                className="px-2 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Усі підрозділи ({sections.length})</option>
                {availableDepartments.map(depName => {
                  const count = sectionCountByDepartment.get(depName) || 0;
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
                value={courseInstSearch}
                onChange={e => setCourseInstSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>
          <div className="h-[300px] overflow-y-auto p-2 bg-white flex flex-col gap-1">
            {courseVisibleSections
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
              <div className="p-6 text-center text-sm text-slate-500">
                В базі знань ще немає інструкцій. Створіть їх у вкладці «Регламенти / Інструкції».
              </div>
            ) : courseVisibleSections.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">За заданими критеріями інструкцій не знайдено</div>
            ) : null}
          </div>
        </div>
        <FormSection title="Проходження">
          <FormCheckbox
            checked={editingCourse?.useCases || false}
            onChange={checked => setEditingCourse((prev: any) => !prev ? null : { ...prev, useCases: checked })}
            label="Використовувати практичні кейси"
          />
          <FormCheckbox
            checked={editingCourse?.isProgressive || false}
            onChange={checked => setEditingCourse((prev: any) => !prev ? null : { ...prev, isProgressive: checked })}
            label="Послідовне проходження (курси-кроки)"
            hint="Наступну інструкцію видно лише після вивчення попередньої."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Мін. бал, %">
              <input
                type="number"
                min="1" max="100"
                value={editingCourse?.quizPassScorePercent ?? 80}
                onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, quizPassScorePercent: Number(e.target.value) })}
                className={FIELD_INPUT_CLASS}
              />
            </FormField>
            <FormField label="Ліміт часу, хв">
              <input
                type="number"
                min="0"
                placeholder="Без ліміту"
                value={editingCourse?.quizTimeLimitMin || ''}
                onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, quizTimeLimitMin: e.target.value ? Number(e.target.value) : undefined })}
                className={FIELD_INPUT_CLASS}
              />
            </FormField>
            <FormField label="Макс. спроб">
              <input
                type="number"
                min="0"
                placeholder="Без ліміту"
                value={editingCourse?.quizMaxAttempts || ''}
                onChange={e => setEditingCourse((prev: any) => !prev ? null : { ...prev, quizMaxAttempts: e.target.value ? Number(e.target.value) : undefined })}
                className={FIELD_INPUT_CLASS}
              />
            </FormField>
          </div>
        </FormSection>
      </MaterialEditDialog>

      {/* Редагування інструкції — спільна оболонка для всіх матеріалів */}
      <MaterialEditDialog
        open={Boolean(editingCourseId)}
        onClose={() => { setEditingCourseId(null); setMaterialError(null); }}
        icon={<FileText className="w-4 h-4" />}
        iconTone="bg-blue-50 text-blue-600 border-blue-100"
        title="Редагувати інструкцію"
        subtitle={groupedCourses.find(i => i.id === editingCourseId)?.title}
        saving={savingMaterial}
        error={materialError}
        onSubmit={async () => {
          setSavingMaterial(true);
          setMaterialError(null);
          try {
            const res = await fetch(`/api/admin/instructions/${editingCourseId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ department: editingCourseDep, isActive: editingInstIsActive })
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || 'Не вдалося оновити інструкцію');
            }
            setEditingCourseId(null);
            if (onRefresh) await onRefresh();
          } catch (e: any) {
            setMaterialError(e?.message || 'Помилка мережі при оновленні інструкції');
          } finally {
            setSavingMaterial(false);
          }
        }}
      >
        <FormField label="Підрозділ">
          <select
            value={editingCourseDep}
            onChange={e => setEditingCourseDep(e.target.value)}
            className={FIELD_INPUT_CLASS}
          >
            <option value="">(Без підрозділу)</option>
            {departments.map(d => (
              <option key={d._id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </FormField>

        <FormCheckbox
          id="edit-inst-active"
          checked={editingInstIsActive}
          onChange={setEditingInstIsActive}
          label="Активна"
          hint="Неактивні інструкції приховані від співробітників і недоступні для проходження."
        />
      </MaterialEditDialog>

      {editingMarkdownInstId && (
        <MarkdownEditor
          initialValue={editingMarkdownContent}
          instructionId={editingMarkdownInstId}
          onSave={handleSaveMarkdown}
          onCancel={() => {
            setEditingMarkdownInstId(null);
            setEditingMarkdownContent('');
          }}
        />
      )}

      {/* Перегляд матеріалу зі списків «Інструкції», «Курси» та «Кейси» */}
      <MaterialPreviewDialog
        target={previewTarget}
        onClose={() => setPreviewTarget(null)}
        sections={sections}
        questions={questions}
        courses={courses}
        cases={cases}
        spaces={spaces}
      />
    </div>
  );
};
