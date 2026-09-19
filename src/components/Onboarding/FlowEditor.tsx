import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Save,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Plus,
  Clock,
  Loader2,
  Info,
  X,
  Lock,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Rocket
} from 'lucide-react';
import { OnboardingNode, OnboardingStepType, OnboardingTemplate, OnboardingStageDef } from './types';
import { validateOnboardingGraph } from '../../../shared/onboardingGraph';
import { STEP_TYPE_META, PALETTE_STEP_TYPES, OWNER_ROLE_LABELS, formatOffset } from './constants';
import { MaterialEditDialog, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from '../Admin/MaterialEditDialog';

interface FlowEditorProps {
  templateId: string;
  sections: any[];
  courses: any[];
  cases: any[];
  onBack: () => void;
  onSaved?: () => void;
}

/** Дані, які кожен вузол React Flow несе про свій крок онбордінгу. */
type StepNodeData = {
  step: OnboardingNode;
  stage?: OnboardingStageDef;
  targetTitle?: string;
  hasIssue?: boolean;
};

const nodeToFlow = (
  step: OnboardingNode,
  stages: OnboardingStageDef[],
  targetTitle: string,
  hasIssue: boolean
): Node<StepNodeData> => ({
  id: step.id,
  type: 'onboardingStep',
  position: step.position || { x: 0, y: 0 },
  data: {
    step,
    stage: stages.find(s => s.key === step.stageKey),
    targetTitle,
    hasIssue
  },
  // Службові вузли можна рухати, але не видаляти — граф без старту нічого не варт.
  deletable: !STEP_TYPE_META[step.type].isSystem
});

const edgeToFlow = (e: { id: string; source: string; target: string; label?: string }): Edge => ({
  id: e.id,
  source: e.source,
  target: e.target,
  label: e.label || undefined,
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 18, height: 18 }
});

/** Картка кроку на канвасі. */
const StepNode: React.FC<NodeProps<Node<StepNodeData>>> = ({ data, selected }) => {
  const step = data.step;
  const meta = STEP_TYPE_META[step.type];
  const Icon = meta.icon;
  const isSystem = meta.isSystem;

  return (
    <div
      className={`rounded-2xl border-2 bg-white shadow-sm transition ${
        selected ? 'border-purple-500 shadow-lg ring-2 ring-purple-200' : meta.border
      } ${isSystem ? 'px-4 py-3 min-w-[160px]' : 'px-4 py-3 w-[240px]'}`}
    >
      {step.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
        />
      )}

      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.chip}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {meta.label}
            </span>
            {data.hasIssue && (
              <AlertTriangle className="w-3 h-3 text-amber-500" aria-label="Крок потребує налаштування" />
            )}
            {step.isRequired === false && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                необов'язково
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-slate-900 leading-tight mt-0.5 break-words">
            {step.title || 'Без назви'}
          </div>
          {data.targetTitle && (
            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{data.targetTitle}</div>
          )}
          {!isSystem && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                <Clock className="w-2.5 h-2.5" />
                {formatOffset(step.dueOffsetDays)}
              </span>
              {step.ownerRole && step.ownerRole !== 'employee' && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                  {OWNER_ROLE_LABELS[step.ownerRole].label}
                </span>
              )}
              {data.stage && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                  {data.stage.title}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {step.type !== 'finish' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
        />
      )}
    </div>
  );
};

const nodeTypes = { onboardingStep: StepNode };

/**
 * Проста пошарова розкладка: вузол потрапляє в шар, що на одиницю глибший
 * за найглибшого зі своїх попередників. Дає читабельну схему «зліва направо»
 * навіть для графа, який збирали хаотично.
 */
const autoLayout = (nodes: OnboardingNode[], edges: { source: string; target: string }[]): OnboardingNode[] => {
  const incoming = new Map<string, string[]>();
  for (const n of nodes) incoming.set(n.id, []);
  for (const e of edges) {
    if (incoming.has(e.target)) incoming.get(e.target)!.push(e.source);
  }

  const depth = new Map<string, number>();
  const resolve = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0; // захист від циклу — розкладка не має зациклитись
    seen.add(id);
    const deps = incoming.get(id) || [];
    const value = deps.length === 0 ? 0 : Math.max(...deps.map(d => resolve(d, seen))) + 1;
    depth.set(id, value);
    return value;
  };
  for (const n of nodes) resolve(n.id, new Set());

  const byLayer = new Map<number, OnboardingNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) || 0;
    if (!byLayer.has(d)) byLayer.set(d, []);
    byLayer.get(d)!.push(n);
  }

  const COLUMN_WIDTH = 320;
  const ROW_HEIGHT = 150;
  return nodes.map(n => {
    const d = depth.get(n.id) || 0;
    const layer = byLayer.get(d)!;
    const index = layer.indexOf(n);
    return {
      ...n,
      position: {
        x: 60 + d * COLUMN_WIDTH,
        y: 80 + index * ROW_HEIGHT
      }
    };
  });
};

const FlowEditorInner: React.FC<FlowEditorProps> = ({ templateId, sections, courses, cases, onBack, onSaved }) => {
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Схема — найтісніше місце редактора, тож канвас можна розширювати:
  // повноекранний режим виводить редактор поверх адмін-лейаута,
  // а бічні панелі згортаються до вузьких смужок з іконками.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // У повноекранному режимі редактор перекриває сторінку — прибираємо скрол фону
  // і даємо звичний вихід по Esc (модалка параметрів має пріоритет на цю клавішу).
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showSettings) setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen, showSettings]);

  // Після зміни розмірів робочої зони вписуємо схему в новий кадр,
  // інакше частина вузлів залишається за межами видимої області.
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 80);
    return () => clearTimeout(timer);
  }, [isFullscreen, paletteOpen, propsOpen, fitView]);

  const targetTitleFor = useCallback((step: OnboardingNode): string => {
    if (step.type === 'instruction') return sections.find(s => s.id === step.targetId)?.title || '';
    if (step.type === 'course' || step.type === 'quiz') return courses.find(c => c.id === step.targetId)?.title || '';
    if (step.type === 'case') return cases.find(c => c.id === step.targetId)?.title || '';
    if (step.type === 'link') return step.url || '';
    return '';
  }, [sections, courses, cases]);

  const stepHasIssue = useCallback((step: OnboardingNode): boolean => {
    if (!step.title?.trim()) return true;
    if (STEP_TYPE_META[step.type].needsTarget && !step.targetId) return true;
    if (step.type === 'link' && !step.url) return true;
    if (step.ownerRole === 'custom' && !step.ownerUserId) return true;
    return false;
  }, []);

  // Перебудовуємо подання вузлів, коли змінюються довідники — інакше картка
  // показує порожню назву матеріалу, поки не перезавантажити сторінку.
  const hydrateNodes = useCallback((steps: OnboardingNode[], stages: OnboardingStageDef[]) => {
    setNodes(steps.map(s => nodeToFlow(s, stages, targetTitleFor(s), stepHasIssue(s))));
  }, [setNodes, targetTitleFor, stepHasIssue]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [tplRes, usersRes] = await Promise.all([
          fetch(`/api/v2/onboarding/templates/${templateId}`),
          fetch('/api/admin/users')
        ]);
        const tplData = await tplRes.json();
        if (!tplRes.ok) throw new Error(tplData.error || 'Не вдалося завантажити шаблон');
        if (cancelled) return;

        const tpl: OnboardingTemplate = tplData.template;
        setTemplate(tpl);
        hydrateNodes(tpl.nodes || [], tpl.stages || []);
        setEdges((tpl.edges || []).map(edgeToFlow));

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        }
      } catch (err: any) {
        if (!cancelled) setMessage({ type: 'error', text: err.message || 'Помилка завантаження' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [templateId, hydrateNodes, setEdges]);

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const updateStep = useCallback((nodeId: string, patch: Partial<OnboardingNode>) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const nextStep = { ...n.data.step, ...patch };
      return {
        ...n,
        data: {
          ...n.data,
          step: nextStep,
          stage: (template?.stages || []).find(s => s.key === nextStep.stageKey),
          targetTitle: targetTitleFor(nextStep),
          hasIssue: stepHasIssue(nextStep)
        }
      };
    }));
    setIsDirty(true);
  }, [setNodes, template, targetTitleFor, stepHasIssue]);

  const addStep = useCallback((type: OnboardingStepType, position?: { x: number; y: number }) => {
    const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const step: OnboardingNode = {
      id,
      type,
      title: STEP_TYPE_META[type].label,
      description: '',
      targetId: '',
      url: '',
      stageKey: template?.stages?.[1]?.key || '',
      dueOffsetDays: 0,
      ownerRole: 'employee',
      isRequired: true,
      estimatedMinutes: 15,
      position: position || { x: 320, y: 320 }
    };
    setNodes(prev => [...prev, nodeToFlow(step, template?.stages || [], '', stepHasIssue(step))]);
    setSelectedNodeId(id);
    setIsDirty(true);
  }, [setNodes, template, stepHasIssue]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source === connection.target) return;
    setEdges(prev => addEdge(
      {
        ...connection,
        id: `edge-${connection.source}-${connection.target}`,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 18, height: 18 }
      },
      prev
    ));
    setIsDirty(true);
  }, [setEdges]);

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    if (STEP_TYPE_META[selectedNode.data.step.type].isSystem) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNode.id));
    setEdges(prev => prev.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNodeId(null);
    setIsDirty(true);
  }, [selectedNode, setNodes, setEdges]);

  const applyAutoLayout = useCallback(() => {
    const steps = nodes.map(n => ({ ...n.data.step, position: n.position }));
    const laid = autoLayout(steps, edges.map(e => ({ source: e.source, target: e.target })));
    setNodes(prev => prev.map(n => {
      const updated = laid.find(l => l.id === n.id);
      return updated ? { ...n, position: updated.position!, data: { ...n.data, step: updated } } : n;
    }));
    setIsDirty(true);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [nodes, edges, setNodes, fitView]);

  const collectPayload = useCallback(() => ({
    nodes: nodes.map(n => ({
      ...n.data.step,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      ownerUserId: n.data.step.ownerUserId || '',
      dueOffsetDays: n.data.step.dueOffsetDays ?? 0,
      estimatedMinutes: n.data.step.estimatedMinutes ?? 0
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : ''
    }))
  }), [nodes, edges]);

  // Ті самі правила, що й на сервері (shared/onboardingGraph.ts), але по живій схемі:
  // список проблем має оновлюватись одразу після правки, а не після збереження.
  const graphIssues = useMemo(() => {
    const payload = collectPayload();
    const found = validateOnboardingGraph(payload.nodes, payload.edges);
    // Правило лише редактора: якщо виконавець — конкретна людина, її треба обрати.
    for (const n of nodes) {
      const step = n.data.step;
      if (step.ownerRole === 'custom' && !step.ownerUserId) {
        found.push(`Крок «${step.title}» не має призначеного виконавця`);
      }
    }
    return [...new Set(found)];
  }, [collectPayload, nodes]);

  const save = useCallback(async (publish: boolean) => {
    if (!template) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload: any = {
        ...collectPayload(),
        name: template.name,
        description: template.description,
        durationDays: template.durationDays,
        requiresBuddy: template.requiresBuddy,
        surveyDayOffsets: template.surveyDayOffsets,
        departmentId: template.departmentId || '',
        positionId: template.positionId || ''
      };
      if (publish) payload.status = 'published';

      const res = await fetch(`/api/v2/onboarding/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося зберегти');

      setTemplate(data.template);
      setIsDirty(false);
      setMessage({
        type: 'success',
        text: publish ? 'Онбординг опубліковано — тепер його можна призначати' : 'Чернетку збережено'
      });
      onSaved?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Помилка збереження' });
    } finally {
      setSaving(false);
    }
  }, [template, collectPayload, onSaved]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/onboarding-step') as OnboardingStepType;
    if (!type) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addStep(type, position);
  }, [screenToFlowPosition, addStep]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Завантаження схеми онбордінгу...</span>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-rose-600 mb-4">{message?.text || 'Шаблон не знайдено'}</p>
        <button onClick={onBack} className="text-sm font-semibold text-purple-700 hover:underline">
          Повернутись до каталогу
        </button>
      </div>
    );
  }

  // Проблеми рахуємо з поточного стану схеми тими самими правилами, що й сервер.
  // Відповідь API (issues) описує вже збережену версію, тож після кожної правки
  // вона застаріває — спиратись на неї означало б блокувати публікацію того,
  // що користувач щойно виправив.
  const allIssues = graphIssues;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[60] bg-white px-5 py-4 flex flex-col'
          : 'flex flex-col h-[calc(100vh-180px)] min-h-[600px]'
      }
    >

      {/* Панель дій */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 transition shrink-0"
            title="До каталогу онбордінгів"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 truncate">{template.name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                template.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {template.status === 'published' ? `Опубліковано · v${template.version}` : 'Чернетка'}
              </span>
              {isDirty && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                  Є незбережені зміни
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {nodes.filter(n => !STEP_TYPE_META[n.data.step.type].isSystem).length} кроків · {edges.length} зв'язків
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            <Info className="w-3.5 h-3.5" />
            Параметри
          </button>
          <button
            onClick={applyAutoLayout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            title="Автоматично вирівняти схему зліва направо"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Вирівняти
          </button>
          <button
            onClick={() => setIsFullscreen(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            title={isFullscreen ? 'Вийти з повноекранного режиму (Esc)' : 'Відкрити схему на весь екран'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullscreen ? 'Згорнути' : 'На весь екран'}
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Зберегти
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || allIssues.length > 0}
            title={allIssues.length > 0 ? 'Спершу виправте помилки у схемі' : 'Опублікувати онбординг'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            Опублікувати
          </button>
        </div>
      </div>

      {message && (
        <div className={`mt-3 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {allIssues.length > 0 && (
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Схему ще не можна опублікувати
          </div>
          <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-0.5">
            {allIssues.slice(0, 5).map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      {/* Робоча зона: палітра + канвас + властивості */}
      <div className="flex-1 flex gap-4 mt-4 min-h-0">

        {/* Палітра кроків — у згорнутому стані лишається смужка з іконками */}
        <div
          className={`shrink-0 bg-slate-50 rounded-2xl border border-slate-200 p-2 overflow-y-auto transition-[width] ${
            paletteOpen ? 'w-52' : 'w-14'
          }`}
        >
          <div className={`flex items-center gap-1 mb-2 ${paletteOpen ? 'justify-between px-1' : 'justify-center'}`}>
            {paletteOpen && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Типи кроків
              </span>
            )}
            <button
              onClick={() => setPaletteOpen(v => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white transition shrink-0"
              title={paletteOpen ? 'Згорнути палітру' : 'Розгорнути палітру'}
            >
              {paletteOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>
          {paletteOpen && (
            <p className="text-[10px] text-slate-400 px-1 mb-3 leading-snug">
              Перетягніть на схему або натисніть, щоб додати
            </p>
          )}
          <div className="space-y-1.5">
            {PALETTE_STEP_TYPES.map(type => {
              const meta = STEP_TYPE_META[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/onboarding-step', type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => addStep(type)}
                  className={`w-full flex items-start gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm transition text-left cursor-grab active:cursor-grabbing ${
                    paletteOpen ? '' : 'justify-center'
                  }`}
                  title={paletteOpen ? meta.hint : `${meta.label} — ${meta.hint}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.chip}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {paletteOpen && (
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 leading-tight">{meta.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">{meta.hint}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Канвас */}
        <div
          ref={wrapperRef}
          className="flex-1 rounded-2xl border border-slate-200 overflow-hidden bg-white min-w-0"
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={changes => {
              onNodesChange(changes);
              if (changes.some(c => c.type === 'position' || c.type === 'remove')) setIsDirty(true);
            }}
            onEdgesChange={changes => {
              onEdgesChange(changes);
              if (changes.some(c => c.type === 'remove')) setIsDirty(true);
            }}
            onConnect={onConnect}
            onNodeClick={(_, node) => { setSelectedNodeId(node.id); setPropsOpen(true); }}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            minZoom={0.2}
            maxZoom={1.6}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#cbd5e1" />
            <Controls showInteractive={false} className="!shadow-sm !border !border-slate-200 !rounded-xl overflow-hidden" />
            <MiniMap
              pannable
              zoomable
              className="!bg-slate-50 !border !border-slate-200 !rounded-xl"
              nodeColor={n => {
                const data = n.data as StepNodeData;
                return data?.step ? '#a5b4fc' : '#cbd5e1';
              }}
            />
          </ReactFlow>
        </div>

        {/* Властивості вибраного кроку — згортаються, щоб віддати ширину схемі */}
        {!propsOpen ? (
          <div className="w-12 shrink-0 bg-white rounded-2xl border border-slate-200 p-2 flex flex-col items-center">
            <button
              onClick={() => setPropsOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
              title="Показати властивості кроку"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
        <div className={`shrink-0 bg-white rounded-2xl border border-slate-200 p-4 overflow-y-auto ${isFullscreen ? 'w-80' : 'w-72'}`}>
          <div className="flex justify-end -mt-1 -mr-1 mb-1">
            <button
              onClick={() => setPropsOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
              title="Згорнути панель властивостей"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
          {!selectedNode ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-2 py-10">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-600">Оберіть крок на схемі</p>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Клікніть на картку, щоб змінити її назву, матеріал, строк і відповідального.
                Щоб задати порядок, потягніть з правого кружечка одного кроку до лівого кружечка іншого.
              </p>
            </div>
          ) : (
            <StepPropertiesPanel
              step={selectedNode.data.step}
              stages={template.stages || []}
              sections={sections}
              courses={courses}
              cases={cases}
              users={users}
              onChange={patch => updateStep(selectedNode.id, patch)}
              onDelete={deleteSelected}
            />
          )}
        </div>
        )}
      </div>

      {showSettings && (
        <TemplateSettingsModal
          template={template}
          onClose={() => setShowSettings(false)}
          onChange={patch => { setTemplate({ ...template, ...patch }); setIsDirty(true); }}
        />
      )}
    </div>
  );
};

// ==========================================================
// Панель властивостей кроку
// ==========================================================

interface StepPropertiesPanelProps {
  step: OnboardingNode;
  stages: OnboardingStageDef[];
  sections: any[];
  courses: any[];
  cases: any[];
  users: any[];
  onChange: (patch: Partial<OnboardingNode>) => void;
  onDelete: () => void;
}

const StepPropertiesPanel: React.FC<StepPropertiesPanelProps> = ({
  step, stages, sections, courses, cases, users, onChange, onDelete
}) => {
  const meta = STEP_TYPE_META[step.type];
  const Icon = meta.icon;
  const isSystem = meta.isSystem;

  const targetOptions = useMemo(() => {
    if (step.type === 'instruction') return sections.map(s => ({ id: s.id, title: s.title }));
    if (step.type === 'course' || step.type === 'quiz') return courses.map(c => ({ id: c.id, title: c.title }));
    if (step.type === 'case') return cases.map(c => ({ id: c.id, title: c.title }));
    return [];
  }, [step.type, sections, courses, cases]);

  const inputClass = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none transition';
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1';

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.chip}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-900">{meta.label}</div>
          <div className="text-[10px] text-slate-400 line-clamp-1">{meta.hint}</div>
        </div>
      </div>

      {isSystem ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Службовий вузол. «Початок» відкриває перші кроки маршруту, «Завершення» закривається
            автоматично, коли всі обов'язкові кроки перед ним виконано.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className={labelClass}>Назва кроку</label>
            <input
              value={step.title}
              onChange={e => onChange({ title: e.target.value })}
              className={inputClass}
              placeholder="Наприклад: Ознайомитись з правилами безпеки"
            />
          </div>

          <div>
            <label className={labelClass}>Опис для співробітника</label>
            <textarea
              value={step.description || ''}
              onChange={e => onChange({ description: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Що саме треба зробити і навіщо"
            />
          </div>

          {meta.needsTarget && (
            <div>
              <label className={labelClass}>
                {step.type === 'instruction' ? 'Інструкція' : step.type === 'case' ? 'Кейс' : 'Курс'}
              </label>
              <select
                value={step.targetId || ''}
                onChange={e => onChange({ targetId: e.target.value })}
                className={inputClass}
              >
                <option value="">— оберіть матеріал —</option>
                {targetOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
              {!step.targetId && (
                <p className="text-[10px] text-amber-600 mt-1">Без матеріалу крок не можна опублікувати</p>
              )}
            </div>
          )}

          {step.type === 'link' && (
            <div>
              <label className={labelClass}>Посилання</label>
              <input
                value={step.url || ''}
                onChange={e => onChange({ url: e.target.value })}
                className={inputClass}
                placeholder="https://..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Строк</label>
              <input
                type="number"
                value={step.dueOffsetDays ?? 0}
                onChange={e => onChange({ dueOffsetDays: parseInt(e.target.value, 10) || 0 })}
                className={inputClass}
              />
              <p className="text-[10px] text-slate-400 mt-1">{formatOffset(step.dueOffsetDays)}</p>
            </div>
            <div>
              <label className={labelClass}>Час, хв</label>
              <input
                type="number"
                min={0}
                value={step.estimatedMinutes ?? 0}
                onChange={e => onChange({ estimatedMinutes: parseInt(e.target.value, 10) || 0 })}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 -mt-2 leading-snug">
            Строк рахується від дати виходу співробітника: 0 — перший день, 14 — через два тижні,
            −3 — за три дні до виходу (preboarding).
          </p>

          <div>
            <label className={labelClass}>Етап</label>
            <select
              value={step.stageKey || ''}
              onChange={e => onChange({ stageKey: e.target.value })}
              className={inputClass}
            >
              <option value="">— без етапу —</option>
              {stages.map(s => (
                <option key={s.key} value={s.key}>{s.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Хто виконує</label>
            <select
              value={step.ownerRole || 'employee'}
              onChange={e => onChange({ ownerRole: e.target.value as any, ownerUserId: '' })}
              className={inputClass}
            >
              {Object.entries(OWNER_ROLE_LABELS).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              {OWNER_ROLE_LABELS[step.ownerRole || 'employee'].hint}
            </p>
          </div>

          {step.ownerRole === 'custom' && (
            <div>
              <label className={labelClass}>Відповідальний</label>
              <select
                value={step.ownerUserId || ''}
                onChange={e => onChange({ ownerUserId: e.target.value })}
                className={inputClass}
              >
                <option value="">— оберіть людину —</option>
                {users.map(u => (
                  <option key={u._id || u.id} value={u._id || u.id}>
                    {u.fullName || u.username || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={step.isRequired !== false}
              onChange={e => onChange({ isRequired: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
            />
            <span className="text-xs font-medium text-slate-700">Обов'язковий крок</span>
          </label>
          <p className="text-[10px] text-slate-400 -mt-2 leading-snug">
            Необов'язкові кроки не блокують завершення онбордінгу і не впливають на відсоток прогресу.
          </p>

          <button
            onClick={onDelete}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition mt-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Видалити крок
          </button>
        </>
      )}
    </div>
  );
};

// ==========================================================
// Параметри шаблону
// ==========================================================

const TemplateSettingsModal: React.FC<{
  template: OnboardingTemplate;
  onClose: () => void;
  onChange: (patch: Partial<OnboardingTemplate>) => void;
}> = ({ template, onClose, onChange }) => {
  return (
    <MaterialEditDialog
      open
      onClose={onClose}
      icon={<Rocket className="w-4 h-4" />}
      iconTone="bg-purple-50 text-purple-600 border-purple-100"
      title="Параметри онбордінгу"
      subtitle={template.name}
      submitLabel="Готово"
      onSubmit={onClose}
    >
      <div>
        <label className={FIELD_LABEL_CLASS}>Назва</label>
        <input value={template.name} onChange={e => onChange({ name: e.target.value })} className={FIELD_INPUT_CLASS} />
      </div>
      <div>
        <label className={FIELD_LABEL_CLASS}>Опис</label>
        <textarea
          value={template.description}
          onChange={e => onChange({ description: e.target.value })}
          rows={3}
          className={`${FIELD_INPUT_CLASS} resize-none`}
          placeholder="Для кого цей онбординг і що людина отримає на виході"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={FIELD_LABEL_CLASS}>Тривалість, днів</label>
          <input
            type="number"
            min={1}
            value={template.durationDays}
            onChange={e => onChange({ durationDays: parseInt(e.target.value, 10) || 90 })}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS}>Опитування, дні</label>
          <input
            value={(template.surveyDayOffsets || []).join(', ')}
            onChange={e => onChange({
              surveyDayOffsets: e.target.value
                .split(',')
                .map(v => parseInt(v.trim(), 10))
                .filter(v => Number.isFinite(v) && v >= 0)
            })}
            className={FIELD_INPUT_CLASS}
            placeholder="7, 30, 90"
          />
        </div>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={template.requiresBuddy}
          onChange={e => onChange({ requiresBuddy: e.target.checked })}
          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
        />
        <span className="text-sm font-medium text-slate-700">Вимагати наставника при призначенні</span>
      </label>
      <p className="text-xs text-slate-400 leading-relaxed">
        Опитування-фідбек надсилаються автоматично на вказані дні від дати виходу.
        Порожній список вимикає опитування для цього онбордінгу.
      </p>
    </MaterialEditDialog>
  );
};

export const FlowEditor: React.FC<FlowEditorProps> = (props) => (
  <ReactFlowProvider>
    <FlowEditorInner {...props} />
  </ReactFlowProvider>
);
