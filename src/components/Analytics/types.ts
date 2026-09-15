export interface CoverageRow {
  department: string;
  total: number;
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  complianceRate: number;
}

export interface AcknowledgementRow {
  department: string;
  total: number;
  signed: number;
  unsigned: number;
  percentSigned: number;
}

export interface TestResultsData {
  avgScore: number;
  totalAttempts: number;
  passRate: number;
  distribution: { range: string; count: number }[];
}

export interface ExpiringCertificate {
  userId: string;
  fullName: string;
  email: string;
  courseTitle: string;
  expiresAt: string;
  daysLeft: number;
}

export interface CertificatesData {
  active: number;
  revoked: number;
  expiringIn30: number;
  expiringIn60: number;
  expiringIn90: number;
  expiringSoon: ExpiringCertificate[];
}

export interface ContentData {
  mostViewed: { id: string; title: string; viewsCount: number; department?: string }[];
  zeroViewed: { id: string; title: string; department?: string }[];
  stale: { id: string; title: string; lastReviewedAt?: string; department?: string }[];
  noResultSearches: { query: string; count: number; lastSearchedAt: string }[];
  staleDays: number;
}

export interface ReportFilters {
  departmentId?: string;
  courseId?: string;
  dateFrom?: string;
  dateTo?: string;
}
