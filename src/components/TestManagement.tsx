import React, { useState, useRef } from 'react';
import { InstructionSection, QuizQuestion } from '../types';
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
  ChevronDown
} from 'lucide-react';

interface TestManagementProps {
  sections: InstructionSection[];
  questions: QuizQuestion[];
  courses: any[];
  cases: any[];
  onImport: (newSections: InstructionSection[], newQuestions: QuizQuestion[], replace: boolean) => void;
  onReset: () => void;
  isSetupMode?: boolean;
}

type MgmtTab = 'list' | 'courses' | 'cases' | 'import' | 'export' | 'help' | 'users' | 'departments';

export const TestManagement: React.FC<TestManagementProps> = ({
  sections,
  questions,
  courses,
  cases,
  onImport,
  onReset,
  isSetupMode
}) => {
  const [activeTab, setActiveTab] = useState<MgmtTab>(isSetupMode ? 'users' : 'list');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);

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
      
      await fetch(`/api/admin/instructions/${editingMarkdownInstId}/full`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: newSection, questions: newQuestions })
      });
      
      setEditingMarkdownInstId(null);
      setEditingMarkdownContent('');
      window.location.reload();
    } catch (err) {
      alert('Помилка при збереженні Markdown. Перевірте синтаксис.');
      console.error(err);
    }
  };

  const [newUser, setNewUser] = useState({ 
    email: '', 
    password: '', 
    requireEmailCode: true, 
    role: isSetupMode ? 'admin' : 'user' 
  });
  const [userMsg, setUserMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [helpSubTab, setHelpSubTab] = useState<'prompt' | 'spec' | 'template'>('prompt');
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDep, setEditingCourseDep] = useState<string>('');
  const [editingInstIsActive, setEditingInstIsActive] = useState<boolean>(true);
  const [newCourse, setNewCourse] = useState({ title: '', department: '', instructionIds: [] as string[], caseIds: [] as string[], hasCertificate: false, certificateValidityYears: 1 });
  const [editingCourse, setEditingCourse] = useState<{ id: string, title: string, department: string, instructionIds: string[], caseIds: string[], hasCertificate: boolean, certificateValidityYears: number, isActive: boolean } | null>(null);

  const [newCase, setNewCase] = useState({ title: '', scenario: '', options: [{ id: 'opt-1', text: '', isCorrect: true, feedback: '' }], isActive: true });
  const [editingCase, setEditingCase] = useState<any | null>(null);

  React.useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'departments' || activeTab === 'users' || activeTab === 'list') fetchDepartments();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch (err) {}
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/admin/departments');
      const data = await res.json();
      if (res.ok) setDepartments(data.departments);
    } catch (err) {}
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);

    const cleanEmail = newUser.email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@viatec.ua')) {
      setUserMsg({ type: 'error', text: 'Email має бути виключно в домені @viatec.ua' });
      return;
    }

    if (!newUser.password) {
      setUserMsg({ type: 'error', text: 'Пароль є обов\'язковим полем' });
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: newUser.password,
          role: newUser.role,
          requireEmailCode: newUser.requireEmailCode
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUserMsg({ type: 'success', text: `Користувача ${cleanEmail} успішно створено!` });
      
      const createdRole = newUser.role;
      setNewUser({ email: '', password: '', requireEmailCode: true, role: 'user' });
      fetchUsers();
      
      if (isSetupMode && createdRole === 'admin') {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
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
          email: selectedUser.email,
          departments: selectedUser.departments,
          allowedInstructionIds: selectedUser.allowedInstructionIds,
          role: selectedUser.role,
          requireEmailCode: selectedUser.requireEmailCode !== false,
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

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDepartment })
      });
      setNewDepartment('');
      fetchDepartments();
    } catch (err) {}
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      await fetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
      fetchDepartments();
    } catch (err) {}
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
          <div className="md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 p-4 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 px-2">
              Меню керування
            </h3>
            <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'list' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Усі інструкції</span>
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'courses' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Курси</span>
            </button>
            <button
              onClick={() => setActiveTab('cases')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'cases' 
                  ? 'bg-orange-100 text-orange-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Кейси</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'import' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Імпорт (.md)</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'export' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Експорт (.md)</span>
            </button>
            <button
              onClick={() => setActiveTab('help')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'help' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Допомога / Шаблон</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'users' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Користувачі</span>
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'departments' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Підрозділи</span>
            </button>
          </div>
        </div>
        )}

        {/* Right Content */}
        <div className="p-6 sm:p-8 grow h-full overflow-y-auto">
          
          {/* TAB: LIST */}
          {activeTab === 'list' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Список інструкцій</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Перегляд та редагування завантажених матеріалів. Увага: видалення інструкції також призведе до видалення всіх пов'язаних з нею запитань.
                </p>
              </div>

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
                                    await fetch(`/api/admin/instructions/${inst.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ department: editingCourseDep, isActive: editingInstIsActive })
                                    });
                                    setEditingCourseId(null);
                                    window.location.reload();
                                  } catch (e) {}
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
                                  <Download className="w-3.5 h-3.5 text-slate-600" />
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
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Ви впевнені, що хочете видалити інструкцію "${inst.title}"? Усі питання всередині також будуть видалені.`)) {
                                    try {
                                      await fetch(`/api/admin/instructions/${inst.id}`, { method: 'DELETE' });
                                      window.location.reload();
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }
                                }}
                                className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                title="Видалити інструкцію"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
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
                    {departments.map(d => (
                      <option key={d._id} value={d.name}>{d.name}</option>
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
                  
                  <div className="text-sm font-medium text-slate-700 mt-2">Оберіть інструкції для курсу:</div>
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 bg-white p-2 rounded-md">
                    {sections.map(sec => (
                      <label key={sec.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newCourse.instructionIds.includes(sec.id)}
                          onChange={e => {
                            const ids = newCourse.instructionIds;
                            if (e.target.checked) setNewCourse({ ...newCourse, instructionIds: [...ids, sec.id] });
                            else setNewCourse({ ...newCourse, instructionIds: ids.filter(i => i !== sec.id) });
                          }}
                        />
                        <span className="text-sm">{sec.title} <span className="text-slate-400 text-xs">({sec.department})</span></span>
                      </label>
                    ))}
                  </div>

                  <div className="text-sm font-medium text-slate-700 mt-2">Оберіть практичні кейси для курсу:</div>
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 bg-white p-2 rounded-md">
                    {cases.map(c => (
                      <label key={c.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newCourse.caseIds.includes(c.id)}
                          onChange={e => {
                            const ids = newCourse.caseIds;
                            if (e.target.checked) setNewCourse({ ...newCourse, caseIds: [...ids, c.id] });
                            else setNewCourse({ ...newCourse, caseIds: ids.filter(i => i !== c.id) });
                          }}
                        />
                        <span className="text-sm">{c.title}</span>
                      </label>
                    ))}
                    {cases.length === 0 && <span className="text-xs text-slate-500">Немає доступних кейсів</span>}
                  </div>
                  <button
                    onClick={async () => {
                      if (!newCourse.title || !newCourse.department) return alert('Заповніть назву та підрозділ');
                      try {
                        await fetch('/api/admin/courses', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newCourse)
                        });
                        setNewCourse({ title: '', department: '', instructionIds: [], hasCertificate: false, certificateValidityYears: 1 });
                        window.location.reload();
                      } catch (err) {}
                    }}
                    className="self-start px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold mt-2"
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
                  courses.map((course) => (
                    <div key={course.id} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50">
                      {editingCourse?.id === course.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Назва курсу"
                            value={editingCourse.title}
                            onChange={e => setEditingCourse({ ...editingCourse, title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                          <select
                            value={editingCourse.department}
                            onChange={e => setEditingCourse({ ...editingCourse, department: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Оберіть підрозділ...</option>
                            {departments.map(d => (
                              <option key={d._id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-cert-${course.id}`}
                              checked={editingCourse.hasCertificate}
                              onChange={e => setEditingCourse({ ...editingCourse, hasCertificate: e.target.checked })}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor={`edit-cert-${course.id}`} className="text-sm text-slate-700">
                              Видавати сертифікат
                            </label>
                          </div>
                          
                          {editingCourse.hasCertificate && (
                            <div className="flex items-center gap-2 ml-6">
                              <label className="text-sm text-slate-600">Термін дії (років):</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={editingCourse.certificateValidityYears}
                                onChange={e => setEditingCourse({ ...editingCourse, certificateValidityYears: parseInt(e.target.value) || 1 })}
                                className="px-2 py-1 w-20 border border-slate-300 rounded-md text-sm"
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-course-active-${course.id}`}
                              checked={editingCourse.isActive}
                              onChange={e => setEditingCourse({ ...editingCourse, isActive: e.target.checked })}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`edit-course-active-${course.id}`} className="text-sm font-bold text-slate-700">
                              Курс активний (доступний для проходження)
                            </label>
                          </div>

                          <div className="text-sm font-medium text-slate-700">Інструкції для курсу:</div>
                          <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 bg-white p-2 rounded-md">
                            {sections.map(sec => (
                              <label key={sec.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editingCourse.instructionIds.includes(sec.id)}
                                  onChange={e => {
                                    const ids = editingCourse.instructionIds;
                                    if (e.target.checked) setEditingCourse({ ...editingCourse, instructionIds: [...ids, sec.id] });
                                    else setEditingCourse({ ...editingCourse, instructionIds: ids.filter(i => i !== sec.id) });
                                  }}
                                />
                                <span className="text-sm">{sec.title} <span className="text-slate-400 text-xs">({sec.department})</span></span>
                              </label>
                            ))}
                          </div>
                          <div className="text-sm font-medium text-slate-700 mt-2">Оберіть практичні кейси для курсу:</div>
                          <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 bg-white p-2 rounded-md mb-4">
                            {cases.map(c => (
                              <label key={c.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editingCourse.caseIds?.includes(c.id) || false}
                                  onChange={e => {
                                    const ids = editingCourse.caseIds || [];
                                    if (e.target.checked) setEditingCourse({ ...editingCourse, caseIds: [...ids, c.id] });
                                    else setEditingCourse({ ...editingCourse, caseIds: ids.filter(i => i !== c.id) });
                                  }}
                                />
                                <span className="text-sm">{c.title}</span>
                              </label>
                            ))}
                            {cases.length === 0 && <span className="text-xs text-slate-500">Немає доступних кейсів</span>}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!editingCourse.title || !editingCourse.department) return alert('Заповніть назву та підрозділ');
                                try {
                                  await fetch(`/api/admin/courses/${editingCourse.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(editingCourse)
                                  });
                                  setEditingCourse(null);
                                  window.location.reload();
                                } catch (err) {}
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
                                id: course.id,
                                title: course.title,
                                department: course.department,
                                instructionIds: course.instructionIds || [],
                                hasCertificate: course.hasCertificate || false,
                                certificateValidityYears: course.certificateValidityYears || 1
                              })}
                              className="p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition"
                              title="Редагувати курс"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Видалити курс "${course.title}"?`)) {
                                  await fetch(`/api/admin/courses/${course.id}`, { method: 'DELETE' });
                                  window.location.reload();
                                }
                              }}
                              className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                              title="Видалити курс"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
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
                      value={editingCase ? editingCase.title : newCase.title}
                      onChange={e => editingCase ? setEditingCase({ ...editingCase, title: e.target.value }) : setNewCase({ ...newCase, title: e.target.value })}
                      placeholder="Напр. Розгніваний клієнт на касі"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Сценарій (опис ситуації)</label>
                    <textarea
                      value={editingCase ? editingCase.scenario : newCase.scenario}
                      onChange={e => editingCase ? setEditingCase({ ...editingCase, scenario: e.target.value }) : setNewCase({ ...newCase, scenario: e.target.value })}
                      placeholder="Опишіть ситуацію детально..."
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Варіанти відповідей (виберіть правильний)</label>
                    {(editingCase ? editingCase.options : newCase.options).map((opt: any, idx: number) => (
                      <div key={idx} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                        <div className="flex gap-2 items-center">
                          <input 
                            type="radio" 
                            name={`correct-option-${editingCase ? 'edit' : 'new'}`}
                            checked={opt.isCorrect}
                            onChange={() => {
                              const updatedOptions = (editingCase ? editingCase.options : newCase.options).map((o: any, i: number) => ({
                                ...o,
                                isCorrect: i === idx
                              }));
                              if (editingCase) setEditingCase({ ...editingCase, options: updatedOptions });
                              else setNewCase({ ...newCase, options: updatedOptions });
                            }}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={opt.text}
                            onChange={e => {
                              const updatedOptions = [...(editingCase ? editingCase.options : newCase.options)];
                              updatedOptions[idx] = { ...updatedOptions[idx], text: e.target.value };
                              if (editingCase) setEditingCase({ ...editingCase, options: updatedOptions });
                              else setNewCase({ ...newCase, options: updatedOptions });
                            }}
                            placeholder={`Варіант ${idx + 1}`}
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-sm"
                          />
                          {(editingCase ? editingCase.options : newCase.options).length > 1 && (
                            <button
                              onClick={() => {
                                const updatedOptions = (editingCase ? editingCase.options : newCase.options).filter((_: any, i: number) => i !== idx);
                                if (editingCase) setEditingCase({ ...editingCase, options: updatedOptions });
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
                            const updatedOptions = [...(editingCase ? editingCase.options : newCase.options)];
                            updatedOptions[idx] = { ...updatedOptions[idx], feedback: e.target.value };
                            if (editingCase) setEditingCase({ ...editingCase, options: updatedOptions });
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
                        if (editingCase) setEditingCase({ ...editingCase, options: [...editingCase.options, newOpt] });
                        else setNewCase({ ...newCase, options: [...newCase.options, newOpt] });
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
                      checked={editingCase ? editingCase.isActive !== false : newCase.isActive}
                      onChange={e => editingCase ? setEditingCase({...editingCase, isActive: e.target.checked}) : setNewCase({...newCase, isActive: e.target.checked})}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="case-active" className="text-sm font-medium text-slate-700">Активний кейс</label>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        const payload = editingCase || newCase;
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
                          const url = editingCase ? `/api/admin/cases/${editingCase.id}` : '/api/admin/cases';
                          await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                          });
                          window.location.reload();
                        } catch (e) {
                          console.error(e);
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
                {cases.map(c => (
                  <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className={`font-bold ${c.isActive === false ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{c.title}</h5>
                        {c.isActive === false && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">Вимкнено</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{c.scenario}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setEditingCase(c)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Видалити цей кейс?')) {
                            await fetch(`/api/admin/cases/${c.id}`, { method: 'DELETE' });
                            window.location.reload();
                          }
                        }} 
                        className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* TAB: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Імпорт тестів та інструкцій з файлу</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Завантажте файл у форматі Markdown (.md), що містить структуровані інструкції та питання.
                </p>
              </div>

              {/* AI Assistant Help Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Створюєте тести за допомогою ChatGPT, Claude або Gemini?
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-xl">
                      Скопіюйте готовий системний промпт, надішліть його будь-якій моделі ШІ разом із текстом вашого регламенту — і отримайте ідеальний .md файл для імпорту.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={handleCopyPrompt}
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                      copiedPrompt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                    }`}
                  >
                    {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPrompt ? 'Скопійовано!' : 'Скопіювати промпт для ШІ'}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('help')}
                    className="px-3 py-2.5 bg-blue-100/70 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold transition"
                    title="Переглянути шаблон та специфікацію"
                  >
                    Інструкція
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

              <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center">
                <Download className="w-10 h-10 text-slate-400 mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Оберіть .md файл для завантаження
                </p>
                <p className="text-xs text-slate-500 mb-6 max-w-sm">
                  Файл має відповідати специфікації шаблону для правильного розпізнавання інтерактивних інструкцій, таблиць, стоп-правил та питань.
                </p>

                <input 
                  type="file" 
                  accept=".md,text/markdown"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    handleFileUpload(e, false);
                  }}
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.onchange = (e: any) => handleFileUpload(e, false);
                        fileInputRef.current.click();
                      }
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    Додати до існуючих
                  </button>
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.onchange = (e: any) => handleFileUpload(e, true);
                        fileInputRef.current.click();
                      }
                    }}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
                  >
                    Замінити всі тести
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Експорт тестів у файл</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Збережіть поточну базу інструкцій та питань у файл формату Markdown (.md).
                </p>
              </div>

              <div className="p-6 border border-slate-200 rounded-2xl bg-white flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Поточна база даних</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Розділів інструкцій: <span className="font-bold text-slate-700">{sections.length}</span><br />
                    Тестових питань: <span className="font-bold text-slate-700">{questions.length}</span>
                  </p>
                </div>

                <button
                  onClick={handleExportData}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Експортувати (.md)</span>
                </button>
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
                        onClick={() => setSelectedUser(u)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${selectedUser?._id === u._id ? 'border-purple-500 bg-purple-50/70 shadow-xs' : 'border-slate-200 bg-white hover:border-purple-300'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-900 text-sm">{u.email || u.username}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>
                            {u.role === 'admin' ? 'Адміністратор' : 'Користувач'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">
                            Підрозділів: {u.departments?.length || 0}
                          </span>
                          {u.requireEmailCode !== false ? (
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
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email (@viatec.ua) *</label>
                        <input
                          type="email"
                          required
                          value={selectedUser.email || ''}
                          onChange={e => setSelectedUser({...selectedUser, email: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedUser.requireEmailCode !== false}
                            onChange={e => setSelectedUser({...selectedUser, requireEmailCode: e.target.checked})}
                            className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              Авторизація через email код (8 знаків)
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              При вході користувач отримує одноразовий 8-значний код на пошту, що діє 5 хвилин.
                            </span>
                          </div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Новий пароль (залиште порожнім, щоб не змінювати)
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={selectedUser.newPassword || ''}
                          onChange={e => setSelectedUser({...selectedUser, newPassword: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
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
                          Пароль *
                        </label>
                        <input
                          type="password"
                          required
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="••••••••"
                        />
                      </div>
                      
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newUser.requireEmailCode}
                            onChange={e => setNewUser({...newUser, requireEmailCode: e.target.checked})}
                            className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              Авторизація email код (8 знаків)
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Встановлено за замовчанням. При вході надсилається одноразовий 8-значний код на пошту.
                            </span>
                          </div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Роль</label>
                        <select
                          value={newUser.role}
                          onChange={e => setNewUser({...newUser, role: e.target.value})}
                          disabled={isSetupMode}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="user">Користувач</option>
                          <option value="admin">Адміністратор</option>
                        </select>
                        {isSetupMode && <p className="text-xs text-rose-500 mt-1">В режимі налаштування необхідно створити адміністратора.</p>}
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

          {/* TAB: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-900">Список підрозділів</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Створюйте підрозділи для структурування інструкцій та доступу користувачів.
                </p>
              </div>

              <div className="max-w-md space-y-4">
                <form onSubmit={handleCreateDepartment} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Назва нового підрозділу"
                    value={newDepartment}
                    onChange={e => setNewDepartment(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition">
                    Додати
                  </button>
                </form>

                <div className="space-y-2">
                  {departments.map(d => (
                    <div key={d._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="font-medium text-slate-800">{d.name}</span>
                      {d.name !== 'Всі підрозділи' && (
                        <button 
                          onClick={() => handleDeleteDepartment(d._id)}
                          className="text-slate-400 hover:text-rose-500 transition p-1"
                          title="Видалити"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
