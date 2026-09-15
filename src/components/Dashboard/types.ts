export interface UserListItem {
  _id: string;
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  roleKeys?: string[];
  departments: string[];
  departmentId?: any;
  managerId?: any;
  allowedInstructionIds?: string[];
  createdAt?: string;
  employeeInfo?: any;
  stats: {
    readCount: number;
    testsCount: number;
    bestScore: number;
    certificatesCount: number;
    totalQuestionsAnswered: number;
    lastActivity: string | null;
  };
}

export interface ReadProgressStats {
  read: number;
  unread: number;
  percentage: number;
}

export interface DepartmentScoreStat {
  name: string;
  avgScore: number;
  testsTaken: number;
}
