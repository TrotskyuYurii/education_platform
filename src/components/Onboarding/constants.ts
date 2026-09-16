import {
  BookOpen,
  GraduationCap,
  Award,
  Briefcase,
  CheckSquare,
  Users,
  FileSignature,
  Link2,
  MessageSquareHeart,
  Flag,
  Trophy,
  LucideIcon
} from 'lucide-react';
import { OnboardingStepType, OnboardingOwnerRole, OnboardingStepStatus } from './types';

interface StepTypeMeta {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Tailwind-класи; тримаємо повними рядками, бо JIT не бачить складені імена. */
  chip: string;
  border: string;
  dot: string;
  /** Чи прив'язується крок до існуючого матеріалу з бази знань. */
  needsTarget: boolean;
  /** Службові вузли, які не можна додати/видалити вручну. */
  isSystem: boolean;
}

export const STEP_TYPE_META: Record<OnboardingStepType, StepTypeMeta> = {
  start: {
    label: 'Початок',
    hint: 'Точка входу маршруту',
    icon: Flag,
    chip: 'bg-slate-100 text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
    needsTarget: false,
    isSystem: true
  },
  instruction: {
    label: 'Інструкція',
    hint: 'Прочитати конкретний регламент',
    icon: BookOpen,
    chip: 'bg-blue-100 text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
    needsTarget: true,
    isSystem: false
  },
  course: {
    label: 'Курс',
    hint: 'Пройти курс цілком',
    icon: GraduationCap,
    chip: 'bg-indigo-100 text-indigo-700',
    border: 'border-indigo-300',
    dot: 'bg-indigo-500',
    needsTarget: true,
    isSystem: false
  },
  quiz: {
    label: 'Тестування',
    hint: 'Скласти тест за курсом',
    icon: Award,
    chip: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
    needsTarget: true,
    isSystem: false
  },
  case: {
    label: 'Практичний кейс',
    hint: 'Розібрати робочу ситуацію',
    icon: Briefcase,
    chip: 'bg-orange-100 text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
    needsTarget: true,
    isSystem: false
  },
  task: {
    label: 'Задача',
    hint: 'Дія поза системою: видати доступ, підготувати робоче місце',
    icon: CheckSquare,
    chip: 'bg-amber-100 text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    needsTarget: false,
    isSystem: false
  },
  meeting: {
    label: 'Зустріч',
    hint: 'Знайомство з командою, 1-on-1, воркшоп',
    icon: Users,
    chip: 'bg-cyan-100 text-cyan-700',
    border: 'border-cyan-300',
    dot: 'bg-cyan-500',
    needsTarget: false,
    isSystem: false
  },
  acknowledgement: {
    label: 'Електронний підпис',
    hint: 'Підтвердити ознайомлення з правилами',
    icon: FileSignature,
    chip: 'bg-rose-100 text-rose-700',
    border: 'border-rose-300',
    dot: 'bg-rose-500',
    needsTarget: false,
    isSystem: false
  },
  link: {
    label: 'Зовнішнє посилання',
    hint: 'Відео, документ або сторонній сервіс',
    icon: Link2,
    chip: 'bg-violet-100 text-violet-700',
    border: 'border-violet-300',
    dot: 'bg-violet-500',
    needsTarget: false,
    isSystem: false
  },
  survey: {
    label: 'Опитування',
    hint: 'Зібрати фідбек про адаптацію',
    icon: MessageSquareHeart,
    chip: 'bg-pink-100 text-pink-700',
    border: 'border-pink-300',
    dot: 'bg-pink-500',
    needsTarget: false,
    isSystem: false
  },
  finish: {
    label: 'Завершення',
    hint: 'Онбординг пройдено',
    icon: Trophy,
    chip: 'bg-emerald-100 text-emerald-800',
    border: 'border-emerald-400',
    dot: 'bg-emerald-600',
    needsTarget: false,
    isSystem: true
  }
};

/** Типи, які показуємо в палітрі редактора (без службових). */
export const PALETTE_STEP_TYPES: OnboardingStepType[] = [
  'instruction', 'course', 'quiz', 'case', 'task', 'meeting', 'acknowledgement', 'link', 'survey'
];

export const OWNER_ROLE_LABELS: Record<OnboardingOwnerRole, { label: string; hint: string }> = {
  employee: { label: 'Новачок', hint: 'Крок виконує сам співробітник' },
  buddy: { label: 'Наставник', hint: 'Виконує призначений buddy' },
  manager: { label: 'Керівник', hint: 'Виконує безпосередній керівник' },
  hr: { label: 'HR', hint: 'Задача з\'явиться у всіх HR-менеджерів' },
  it: { label: 'IT', hint: 'Задача з\'явиться в IT (або в адміністраторів, якщо ролі IT немає)' },
  custom: { label: 'Конкретна людина', hint: 'Виконує вибраний співробітник' }
};

export const STEP_STATUS_META: Record<OnboardingStepStatus, { label: string; chip: string }> = {
  locked: { label: 'Заблоковано', chip: 'bg-slate-100 text-slate-500 border-slate-200' },
  available: { label: 'Доступно', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'У роботі', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Завершено', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  skipped: { label: 'Пропущено', chip: 'bg-slate-100 text-slate-600 border-slate-300' }
};

export const ASSIGNMENT_STATUS_META: Record<string, { label: string; chip: string }> = {
  not_started: { label: 'Не розпочато', chip: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'У процесі', chip: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Завершено', chip: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'Прострочено', chip: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Скасовано', chip: 'bg-slate-100 text-slate-400' }
};

export const TEMPLATE_STATUS_META: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Чернетка', chip: 'bg-amber-100 text-amber-700' },
  published: { label: 'Опубліковано', chip: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Архів', chip: 'bg-slate-100 text-slate-500' }
};

export const formatDateUa = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** «+14 днів» / «−7 днів (до виходу)» — як показуємо зсув дедлайну в UI. */
export const formatOffset = (days?: number): string => {
  const value = days ?? 0;
  if (value === 0) return 'День виходу';
  if (value < 0) return `${value} дн. (до виходу)`;
  return `+${value} дн.`;
};
