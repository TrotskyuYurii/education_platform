export type PermissionScope = 'self' | 'team' | 'department' | 'all';

export interface PermissionDefinition {
  code: string;
  name: string;
  category: 'system' | 'users' | 'knowledge' | 'learning' | 'analytics' | 'certificates';
  categoryLabel: string;
  description: string;
  allowedScopes: PermissionScope[];
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  {
    code: 'admin.access',
    name: 'Доступ до панелі адміністрування',
    category: 'system',
    categoryLabel: 'Система та безпека',
    description: 'Доступ до панелі управління системою, налаштувань та інструментів адміністрування',
    allowedScopes: ['all']
  },
  {
    code: 'roles.manage',
    name: 'Керування ролями та матрицею прав',
    category: 'system',
    categoryLabel: 'Система та безпека',
    description: 'Створення ролей, редагування прав доступу, зон видимості (scopes) та конфігурації RBAC',
    allowedScopes: ['all']
  },
  {
    code: 'users.profile.view',
    name: 'Перегляд користувачів',
    category: 'users',
    categoryLabel: 'Користувачі та оргструктура',
    description: 'Перегляд профілів, посад, контактних даних та призначених курсів співробітників',
    allowedScopes: ['self', 'team', 'department', 'all']
  },
  {
    code: 'users.profile.edit',
    name: 'Редагування користувачів',
    category: 'users',
    categoryLabel: 'Користувачі та оргструктура',
    description: 'Створення облікових записів, скидання паролів, призначення ролей та керівників',
    allowedScopes: ['self', 'team', 'department', 'all']
  },
  {
    code: 'org.manage',
    name: 'Керування структурою компанії',
    category: 'users',
    categoryLabel: 'Користувачі та оргструктура',
    description: 'Керування довідниками підрозділів, посад, локацій та ієрархією підпорядкування',
    allowedScopes: ['all']
  },
  {
    code: 'knowledge.article.publish',
    name: 'Публікація та редагування матеріалів',
    category: 'knowledge',
    categoryLabel: 'База знань та регламенти',
    description: 'Створення, редагування, імпорт/експорт Markdown та публікація навчальних матеріалів',
    allowedScopes: ['department', 'all']
  },
  {
    code: 'learning.assignment.view',
    name: 'Перегляд призначеного навчання',
    category: 'learning',
    categoryLabel: 'Навчання та тестування',
    description: 'Перегляд статусів вивчення, спроб тестування та виконання практичних кейсів',
    allowedScopes: ['self', 'team', 'department', 'all']
  },
  {
    code: 'learning.assignment.create',
    name: 'Призначення обов’язкового навчання',
    category: 'learning',
    categoryLabel: 'Навчання та тестування',
    description: 'Призначення обов’язкових курсів та регламентів для вивчення співробітниками',
    allowedScopes: ['team', 'department', 'all']
  },
  {
    code: 'analytics.report.view',
    name: 'Перегляд аналітики та звітності',
    category: 'analytics',
    categoryLabel: 'Аналітика та звіти',
    description: 'Доступ до дашборду успішності, статистики проходження тестів та симуляцій',
    allowedScopes: ['self', 'team', 'department', 'all']
  },
  {
    code: 'certificate.revoke',
    name: 'Анулювання та перевипуск сертифікатів',
    category: 'certificates',
    categoryLabel: 'Сертифікати',
    description: 'Право анулювати видані сертифікати співробітників з надсиланням сповіщення',
    allowedScopes: ['team', 'department', 'all']
  }
];

export const SCOPE_LABELS: Record<PermissionScope, { label: string; desc: string; order: number }> = {
  self: { label: 'Власні дані (Self)', desc: 'Тільки власні записи поточного користувача', order: 1 },
  team: { label: 'Команда (Team)', desc: 'Співробітники, для яких поточний користувач є керівником', order: 2 },
  department: { label: 'Підрозділ (Dept)', desc: 'Співробітники того ж підрозділу, що й користувач', order: 3 },
  all: { label: 'Вся компанія (All)', desc: 'Повний доступ до всіх записів компанії', order: 4 }
};
