export type OnboardingStepType =
  | 'start'
  | 'instruction'
  | 'course'
  | 'quiz'
  | 'case'
  | 'task'
  | 'meeting'
  | 'acknowledgement'
  | 'link'
  | 'survey'
  | 'finish';

export type OnboardingOwnerRole = 'employee' | 'buddy' | 'manager' | 'hr' | 'it' | 'custom';

export type OnboardingStepStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';

export type OnboardingAssignmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export interface OnboardingStageDef {
  key: string;
  title: string;
  dayOffset: number;
  color: string;
  order: number;
}

/** Вузол у редакторі схеми (те, що зберігається в шаблоні). */
export interface OnboardingNode {
  id: string;
  type: OnboardingStepType;
  title: string;
  description?: string;
  targetId?: string;
  url?: string;
  stageKey?: string;
  dueOffsetDays?: number;
  ownerRole?: OnboardingOwnerRole;
  ownerUserId?: string | null;
  isRequired?: boolean;
  estimatedMinutes?: number;
  position?: { x: number; y: number };
}

export interface OnboardingEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  durationDays: number;
  requiresBuddy: boolean;
  departmentId?: string | null;
  positionId?: string | null;
  surveyDayOffsets: number[];
  stages: OnboardingStageDef[];
  nodes: OnboardingNode[];
  edges: OnboardingEdge[];
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Рядок каталогу — шаблон плюс агрегати використання. */
export interface OnboardingTemplateSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  durationDays: number;
  requiresBuddy: boolean;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  stepsCount: number;
  estimatedMinutes: number;
  assignedTotal: number;
  assignedActive: number;
  assignedCompleted: number;
  createdByName?: string;
  updatedAt?: string;
}

/** Крок у поданні конкретного проходження (шаблон + прогрес людини). */
export interface OnboardingStepView {
  nodeId: string;
  type: OnboardingStepType;
  title: string;
  description: string;
  targetId: string;
  targetTitle: string;
  url: string;
  stageKey: string;
  ownerRole: OnboardingOwnerRole;
  ownerUserId: string | null;
  isRequired: boolean;
  estimatedMinutes: number;
  position: { x: number; y: number };
  status: OnboardingStepStatus;
  dueDate: string | null;
  isOverdue: boolean;
  completedAt: string | null;
  completedByName: string;
  comment: string;
  isMine: boolean;
}

export interface OnboardingAssignmentView {
  id: string;
  templateId: string;
  templateName: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  startDate: string;
  dueDate: string;
  status: OnboardingAssignmentStatus;
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  completedAt: string | null;
  buddyUserId: string | null;
  buddyName: string;
  managerUserId: string | null;
  assignedByName: string;
  assignedDate: string;
  notes: string;
  daysRemaining: number;
  stages: OnboardingStageDef[];
  edges: OnboardingEdge[];
  steps: OnboardingStepView[];
}

export interface OnboardingReportRow {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  departmentName: string;
  positionTitle: string;
  hireDate: string | null;
  templateId: string;
  templateName: string;
  startDate: string;
  dueDate: string;
  status: OnboardingAssignmentStatus;
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  buddyName: string;
  assignedByName: string;
  completedAt: string | null;
  daysRemaining: number;
}

export interface OnboardingReportStats {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completionRate: number;
  avgProgress: number;
  avgDaysToComplete: number;
}

/** Крок чужого онбордінгу, за який відповідає поточний користувач. */
export interface OnboardingOwnerTask {
  assignmentId: string;
  nodeId: string;
  title: string;
  description: string;
  type: OnboardingStepType;
  ownerRole: OnboardingOwnerRole;
  employeeName: string;
  employeeId: string;
  templateName: string;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface OnboardingAutoRule {
  id: string;
  templateId: string;
  templateName: string;
  departmentId: string | null;
  departmentName: string;
  positionId: string | null;
  positionTitle: string;
  locationId: string | null;
  isActive: boolean;
  priority: number;
}

export interface OnboardingPendingSurvey {
  assignmentId: string;
  templateName: string;
  dayOffset: number;
  availableSince: string;
}

export interface OnboardingSurveySummaryRow {
  dayOffset: number;
  responses: number;
  avgSatisfaction: number;
  avgNps: number | null;
  avgClarity: number | null;
  avgSupport: number | null;
}

export interface OnboardingSurveyResponseRow {
  id: string;
  userId: string;
  userName: string;
  dayOffset: number;
  satisfaction: number;
  nps: number | null;
  clarity: number | null;
  supportLevel: number | null;
  comment: string;
  submittedAt: string;
}

export interface OnboardingBottleneck {
  key: string;
  title: string;
  stuckCount: number;
  avgDaysLate: number;
}
