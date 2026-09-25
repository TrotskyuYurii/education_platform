/**
 * Людські назви для журналу дій користувачів.
 *
 * Спільні для екрана журналу і вивантаження в Excel — щоб у файлі стояли ті
 * самі слова, що адміністратор бачить на сторінці.
 */

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  LOGIN: 'Вхід',
  LOGIN_FAILED: 'Невдалий вхід',
  OTP_SENT: 'Код входу',
  LOGOUT: 'Вихід',
  SESSION_EXPIRED: 'Вихід через бездіяльність',
  NAVIGATE: 'Перехід',
  MATERIAL_VIEW: 'Перегляд матеріалу',
  QUIZ_ATTEMPT: 'Тестування',
  ACKNOWLEDGEMENT_SIGNED: 'Підпис ознайомлення'
};

// Назви розділів такі самі, як у меню, щоб адміністратор упізнавав їх одразу.
const PAGE_LABELS: Record<string, string> = {
  myday: 'Мій день',
  catalog: 'Навчальні матеріали',
  manual: 'Навчальні матеріали (перегляд)',
  quiz: 'Тестування (Квіз)',
  cases: 'Кейси',
  onboarding: 'Онбординг',
  people: 'Люди',
  signoff: 'Підтвердження',
  dashboard: 'Профіль',
  about: 'Про додаток'
};

const ADMIN_PAGE_LABELS: Record<string, string> = {
  list: 'Інструкції',
  courses: 'Курси',
  cases: 'Кейси',
  knowledge: 'База знань',
  assignments: 'Призначення',
  onboarding: 'Онбординг',
  help: 'Допомога / Шаблон',
  users: 'Користувачі',
  roles: 'Ролі та права',
  organization: 'Організація',
  notifications: 'Сповіщення',
  analytics: 'Аналітика',
  systemlog: 'Журнал адміністратора',
  activity: 'Журнал дій',
  settings: 'Налаштування',
  dashboards: 'Дашборди',
  'dashboards:activity': 'Дашборди → Активність'
};

// Незнайомий ключ показуємо як є — новий розділ не зламає журнал.
export const activityPageLabel = (page?: string | null): string => {
  if (!page) return '—';
  if (page.startsWith('management:')) {
    const sub = page.slice('management:'.length);
    return `Адміністрування → ${ADMIN_PAGE_LABELS[sub] || sub}`;
  }
  return PAGE_LABELS[page] || page;
};

export const describeActivity = (item: { type: string; page?: string | null; title?: string | null }): string => {
  if (item.type === 'NAVIGATE') return `Перейшов у розділ «${activityPageLabel(item.page)}»`;
  if (item.type === 'MATERIAL_VIEW') return `Відкрив матеріал «${item.title || '—'}»`;
  return item.title || ACTIVITY_TYPE_LABELS[item.type] || item.type;
};

/** Коротко: браузер і система — повний рядок лишається в деталях. */
export const shortUserAgent = (ua?: string | null): string => {
  if (!ua) return '';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Браузер';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser}, ${os}` : browser;
};
