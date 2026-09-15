export type RoleFilter = 'all' | 'cashier' | 'manager' | 'accountant';

export type PermissionScope = 'self' | 'team' | 'department' | 'all';

export interface PermissionItem {
  permission: string;
  scope: PermissionScope;
}

export interface Role {
  _id?: string;
  key: string;
  title: string;
  description?: string;
  permissions: PermissionItem[];
  isSystem?: boolean;
  userCount?: number;
  createdAt?: string;
}

export interface PermissionDefinition {
  code: string;
  name: string;
  category: 'system' | 'users' | 'knowledge' | 'learning' | 'analytics' | 'certificates';
  categoryLabel: string;
  description: string;
  allowedScopes: PermissionScope[];
}

export interface Course {
  id: string;
  title: string;
  department: string;
  instructionIds: string[];
  caseIds?: string[];
  useCases?: boolean;
  hasCertificate?: boolean;
  certificateValidityYears?: number;
  isActive?: boolean;
}

export interface InstructionSection {
  id: string;
  courseId?: string;
  courseTitle?: string;
  department: string;
  title: string;
  subtitle: string;
  targetRole: RoleFilter;
  pageReference: string;
  readTimeMin: number;
  summary: string;
  contentMarkdown?: string;
  contentHtml?: string;
  keyPoints: string[];
  keyFields?: string[];
  images?: string[];
  steps?: {
    number: number;
    title: string;
    description: string;
    tip?: string;
    warning?: string;
    imageUrl?: string;
    images?: string[];
  }[];
  tableData?: {
    headers: string[];
    rows: string[][];
  };
  stopRules?: string[];
  systemAutomaticActions?: string[];
  isActive?: boolean;
}

export interface QuizQuestion {
  id: string;
  sectionId: string;
  courseId?: string;
  department: string;
  role: RoleFilter;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  contextScenario?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceDocPage: string;
}

export interface CaseSimulation {
  id: string;
  sectionId?: string;
  title: string;
  scenario: string;
  role?: string;
  clientDialogue?: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
    feedback: string;
    legalOrSystemBasis?: string;
  }[];
  isActive?: boolean;
}

export interface UserProgress {
  readSectionIds: string[];
  quizCompleted: boolean;
  bestScore: number;
  totalQuestionsAnswered: number;
  employeeInfo: {
    fullName: string;
    position: string;
    department: string;
    signedDate: string;
    isSigned: boolean;
  };
  quizHistory: Array<{
    date: string;
    score: number;
    total: number;
    percentage: number;
    sectionId?: string;
    courseId?: string;
    department?: string;
    mode?: string;
  }>;
  notifications?: Array<{
    id: string;
    message: string;
    date: string;
    read: boolean;
  }>;
  certificates?: Array<{
    courseId: string;
    courseTitle: string;
    issuedAt: string;
    expiresAt: string;
  }>;
}
