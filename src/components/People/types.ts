export interface PeopleListItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  email: string;
  position: { id: string; title: string; grade?: string } | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string; city?: string } | null;
  manager: { id: string; fullName: string; email: string } | null;
}

export interface PeopleProfile extends PeopleListItem {
  canViewFull: boolean;
  canEdit: boolean;
  hireDate?: string | null;
  customFields?: Record<string, any>;
}

export interface OrgChartNode {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  positionTitle: string | null;
  departmentName: string | null;
  managerId: string | null;
}

export interface OrgDictionaryItem {
  _id: string;
  name?: string;
  title?: string;
  city?: string;
}
