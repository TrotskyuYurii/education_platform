import mongoose from 'mongoose';

/**
 * Онбординг співробітника.
 *
 * Шаблон онбордінгу — це орієнтований граф кроків: вузли (кроки) + ребра
 * (залежності «спершу це, потім те»). Редактор у фронтенді зберігає сюди
 * координати вузлів, тому граф одночасно є і моделлю проходження, і схемою
 * для візуального редактора.
 */

// Тип кроку. 'start'/'finish' — службові вузли-якорі графа.
export const ONBOARDING_STEP_TYPES = [
  'start',
  'instruction',      // конкретна інструкція (Section.id)
  'course',           // курс цілком (Course.id)
  'quiz',             // тест по курсу (Course.id)
  'case',             // практичний кейс (Case.id)
  'task',             // довільна задача з підтвердженням
  'meeting',          // зустріч / знайомство
  'acknowledgement',  // електронний підпис про ознайомлення
  'link',             // зовнішнє посилання / відео
  'survey',           // опитування-фідбек
  'finish'
] as const;
export type OnboardingStepType = typeof ONBOARDING_STEP_TYPES[number];

// Хто закриває крок. Кроки з ownerRole !== 'employee' не блокують новачка
// у його власному списку — вони з'являються як задачі відповідального.
export const ONBOARDING_OWNER_ROLES = ['employee', 'buddy', 'manager', 'hr', 'it', 'custom'] as const;
export type OnboardingOwnerRole = typeof ONBOARDING_OWNER_ROLES[number];

export const ONBOARDING_STEP_STATUSES = ['locked', 'available', 'in_progress', 'completed', 'skipped'] as const;
export type OnboardingStepStatus = typeof ONBOARDING_STEP_STATUSES[number];

const stepNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },          // локальний id вузла в межах шаблону
  type: { type: String, enum: ONBOARDING_STEP_TYPES, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  targetId: { type: String, default: '' },        // Section.id / Course.id / Case.id залежно від type
  url: { type: String, default: '' },             // для type='link'
  stageKey: { type: String, default: '' },        // до якого етапу (30/60/90) належить крок
  // Дедлайн кроку рахується як startDate (дата виходу) + dueOffsetDays.
  // Від'ємне значення = preboarding (до першого робочого дня).
  dueOffsetDays: { type: Number, default: 0 },
  ownerRole: { type: String, enum: ONBOARDING_OWNER_ROLES, default: 'employee' },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // для ownerRole='custom'
  isRequired: { type: Boolean, default: true },
  estimatedMinutes: { type: Number, default: 0 },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  }
}, { _id: false });

const stepEdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  label: { type: String, default: '' }
}, { _id: false });

const stageSchema = new mongoose.Schema({
  key: { type: String, required: true },
  title: { type: String, required: true },
  dayOffset: { type: Number, default: 0 },
  color: { type: String, default: 'blue' },
  order: { type: Number, default: 0 }
}, { _id: false });

/** Стандартні етапи за світовою практикою (preboarding → 30/60/90). */
export const DEFAULT_STAGES = [
  { key: 'preboarding', title: 'Підготовка (до виходу)', dayOffset: -7, color: 'slate', order: 0 },
  { key: 'day1', title: 'Перший день', dayOffset: 0, color: 'blue', order: 1 },
  { key: 'week1', title: 'Перший тиждень', dayOffset: 7, color: 'indigo', order: 2 },
  { key: 'day30', title: '30 днів', dayOffset: 30, color: 'emerald', order: 3 },
  { key: 'day60', title: '60 днів', dayOffset: 60, color: 'amber', order: 4 },
  { key: 'day90', title: '90 днів', dayOffset: 90, color: 'purple', order: 5 }
];

const onboardingTemplateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'Rocket' },
  color: { type: String, default: 'blue' },
  // Для кого шаблон рекомендований (довідкові поля каталогу; фактичний
  // автозапуск керується OnboardingAutoRule).
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', index: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  version: { type: Number, default: 1 },
  durationDays: { type: Number, default: 90 },
  requiresBuddy: { type: Boolean, default: false },
  // На які дні від виходу надсилати опитування-фідбек.
  surveyDayOffsets: { type: [Number], default: [7, 30, 90] },
  stages: { type: [stageSchema], default: DEFAULT_STAGES },
  nodes: { type: [stepNodeSchema], default: [] },
  edges: { type: [stepEdgeSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Призначення онбордінгу конкретній людині.
 *
 * `graph` — заморожена копія шаблону на момент призначення. Редагування
 * шаблону не повинно ламати вже розпочаті онбордінги: люди в процесі
 * проходять рівно те, що їм призначили.
 */
const onboardingAssignmentSchema = new mongoose.Schema({
  templateId: { type: String, required: true, index: true },
  templateName: { type: String, required: true },
  templateVersion: { type: Number, default: 1 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  graph: {
    stages: { type: [stageSchema], default: [] },
    nodes: { type: [stepNodeSchema], default: [] },
    edges: { type: [stepEdgeSchema], default: [] }
  },
  // Дата, від якої рахуються всі dueOffsetDays (зазвичай дата виходу на роботу).
  startDate: { type: Date, required: true, index: true },
  dueDate: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'overdue', 'cancelled'],
    default: 'not_started',
    index: true
  },
  buddyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  buddyName: { type: String, default: '' },
  managerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedByName: { type: String, default: '' },
  assignedDate: { type: Date, default: Date.now },
  source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
  progressPercent: { type: Number, default: 0 },
  completedSteps: { type: Number, default: 0 },
  totalSteps: { type: Number, default: 0 },
  completedAt: { type: Date },
  notes: { type: String, default: '' },
  // Дедуплікація щоденного планувальника (див. onboarding/scheduler-хуки в notifications).
  overdueNotifiedAt: { type: Date },
  // На які dayOffset уже надіслано запит на опитування.
  surveysSentOffsets: { type: [Number], default: [] }
}, { timestamps: true });

// Один активний онбординг за шаблоном на людину.
onboardingAssignmentSchema.index({ userId: 1, templateId: 1 }, { unique: true });
onboardingAssignmentSchema.index({ status: 1, dueDate: 1 });

const onboardingStepProgressSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingAssignment', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nodeId: { type: String, required: true },
  status: { type: String, enum: ONBOARDING_STEP_STATUSES, default: 'locked', index: true },
  dueDate: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  completedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedByName: { type: String, default: '' },
  comment: { type: String, default: '' },
  // Щоб «розблоковано» і «дедлайн близько» не надсилались повторно щодня.
  unlockNotifiedAt: { type: Date },
  dueReminderSentAt: { type: Date }
}, { timestamps: true });

onboardingStepProgressSchema.index({ assignmentId: 1, nodeId: 1 }, { unique: true });

/**
 * Правило автозапуску: нового співробітника з відповідною посадою/підрозділом
 * система ставить на онбординг без ручної дії HR.
 */
const onboardingAutoRuleSchema = new mongoose.Schema({
  templateId: { type: String, required: true, index: true },
  templateName: { type: String, default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  isActive: { type: Boolean, default: true, index: true },
  // Якщо під нового співробітника підходять кілька правил — виграє більший priority.
  priority: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

/** Відповідь на опитування-фідбек (7/30/90 день). */
const onboardingSurveyResponseSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingAssignment', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dayOffset: { type: Number, required: true },
  // 1-5: наскільки комфортно проходить адаптація
  satisfaction: { type: Number, min: 1, max: 5, required: true },
  // 0-10: чи порекомендує компанію як місце роботи (eNPS)
  nps: { type: Number, min: 0, max: 10 },
  clarity: { type: Number, min: 1, max: 5 },       // чи зрозумілі задачі та очікування
  supportLevel: { type: Number, min: 1, max: 5 },  // чи достатньо підтримки від команди
  comment: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

onboardingSurveyResponseSchema.index({ assignmentId: 1, dayOffset: 1 }, { unique: true });

export const OnboardingTemplate = mongoose.models.OnboardingTemplate
  || mongoose.model('OnboardingTemplate', onboardingTemplateSchema);
export const OnboardingAssignment = mongoose.models.OnboardingAssignment
  || mongoose.model('OnboardingAssignment', onboardingAssignmentSchema);
export const OnboardingStepProgress = mongoose.models.OnboardingStepProgress
  || mongoose.model('OnboardingStepProgress', onboardingStepProgressSchema);
export const OnboardingAutoRule = mongoose.models.OnboardingAutoRule
  || mongoose.model('OnboardingAutoRule', onboardingAutoRuleSchema);
export const OnboardingSurveyResponse = mongoose.models.OnboardingSurveyResponse
  || mongoose.model('OnboardingSurveyResponse', onboardingSurveyResponseSchema);
