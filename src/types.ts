export type RoleFilter = 'all' | 'cashier' | 'manager' | 'accountant';

export type PermissionScope = 'self' | 'team' | 'department' | 'all';

export type DocumentStatus = 'draft' | 'in_review' | 'published' | 'archived';

export interface SourceFileMeta {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface KnowledgeSpace {
  _id?: string;
  id: string;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  color?: string;
  department?: string;
  order?: number;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  stats?: {
    totalInstructions: number;
    publishedInstructions: number;
    draftInstructions: number;
    totalCourses: number;
  };
}

export interface InstructionVersion {
  _id?: string;
  sectionId: string;
  version: string;
  versionNumber: number;
  status: DocumentStatus;
  title: string;
  subtitle?: string;
  summary?: string;
  contentMarkdown?: string;
  contentHtml?: string;
  keyPoints?: string[];
  keyFields?: string[];
  stopRules?: string[];
  steps?: any[];
  tableData?: any;
  sourceFile?: SourceFileMeta;
  rawMarkdown?: string;
  changeSummary?: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
}

export interface KnowledgeMetrics {
  spacesCount: number;
  totalInstructions: number;
  totalCourses: number;
  publishedCount: number;
  draftCount: number;
  inReviewCount: number;
  archivedCount: number;
  totalRevisions: number;
  totalReadTimeMin: number;
}

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
  spaceId?: string;
  version?: string;
  status?: DocumentStatus;
  isActive?: boolean;
  isProgressive?: boolean;
  quizTimeLimitMin?: number;
  quizPassScorePercent?: number;
  quizMaxAttempts?: number;
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
  sourceFile?: SourceFileMeta;
  rawMarkdown?: string;
  /** Transient, only used when importing a freshly-uploaded document (see TestManagement upload flow) */
  sourceFileToken?: string;
  sourceFileName?: string;
  sourceMimeType?: string;
  spaceId?: string;
  version?: string;
  versionNumber?: number;
  status?: DocumentStatus;
  changeLog?: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
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
    title?: string;
    type?: string;
    isCritical?: boolean;
  }>;
  certificates?: Array<{
    courseId: string;
    courseTitle: string;
    issuedAt: string;
    expiresAt: string;
  }>;
}

export type SearchEntityType = 'all' | 'instruction' | 'question' | 'case' | 'course' | 'glossary';

export interface SearchResultItem {
  id: string;
  type: 'instruction' | 'question' | 'case' | 'course' | 'glossary';
  title: string;
  subtitle?: string;
  snippet: string;
  matchedField?: string;
  spaceId?: string;
  spaceName?: string;
  department?: string;
  courseId?: string;
  sectionId?: string;
  version?: string;
  status?: string;
  score: number;
}

export interface SearchResponseData {
  query: string;
  total: number;
  counts: {
    all: number;
    instruction: number;
    question: number;
    case: number;
    course: number;
    glossary: number;
  };
  results: SearchResultItem[];
}

export type AssignmentPriority = 'recommended' | 'mandatory' | 'critical';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';
export type AssignmentTargetType = 'course' | 'instruction';

export interface LearningAssignment {
  _id?: string;
  id: string;
  userId: string;
  user?: {
    _id: string;
    username: string;
    fullName?: string;
    email?: string;
    department?: string;
  };
  targetType: AssignmentTargetType;
  targetId: string;
  title: string;
  department?: string;
  assignedBy?: string;
  assignedByName?: string;
  assignedDate: string;
  dueDate: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  completedAt?: string;
  score?: number;
  notes?: string;
  daysRemaining?: number;
  isOverdue?: boolean;
}

export interface AssignmentStats {
  total: number;
  completed: number;
  inProgress: number;
  assigned: number;
  overdue: number;
  complianceRate: number;
}
