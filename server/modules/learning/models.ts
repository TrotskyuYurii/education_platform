import mongoose from 'mongoose';

// 1. Reading progress for specific instruction section
const readingProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sectionId: { type: String, required: true, index: true },
  courseId: { type: String, index: true },
  completedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

readingProgressSchema.index({ userId: 1, sectionId: 1 }, { unique: true });

// 2. Individual Quiz / Case Simulation attempt
const quizAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: String, index: true },
  sectionId: { type: String, index: true },
  department: { type: String, default: 'Загальний' },
  mode: { type: String, enum: ['quiz', 'cases'], default: 'quiz' },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },
  passed: { type: Boolean, default: false },
  date: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

quizAttemptSchema.index({ userId: 1, date: -1 });

// 3. Official Certificate issued to user
const certificateRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: String, required: true, index: true },
  courseTitle: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active', index: true },
  revokedAt: { type: Date },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revocationReason: { type: String },
  // Крок 11: set once a "certificate expiring soon" notification has been sent,
  // so the daily scheduler doesn't re-notify for the same certificate every day.
  expiryNotifiedAt: { type: Date }
}, {
  timestamps: true
});

certificateRecordSchema.index({ userId: 1, courseId: 1, status: 1 });
// Крок 14: covers the scheduler's expiring-certificate scan (notifications/scheduler.ts)
// and the analytics "expiring soon" facet (analytics/service.ts) — both query
// {status:'active', expiresAt: <range>}.
certificateRecordSchema.index({ status: 1, expiresAt: 1 });

// 4. Electronic Signoff / Acknowledgment of corporate regulations
const acknowledgmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  fullName: { type: String, required: true },
  position: { type: String, default: '' },
  department: { type: String, default: '' },
  signedDate: { type: String, required: true },
  isSigned: { type: Boolean, default: false },
  signatureHash: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// 5. In-app Learning Notification
const learningNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  notificationId: { type: String, required: true },
  title: { type: String },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'certificate_revoked', 'certificate_expiring', 'certificate_issued',
      'assignment_new', 'assignment_reminder', 'assignment_overdue',
      'course_completed', 'acknowledgement_confirmed',
      'onboarding_assigned', 'onboarding_buddy_assigned', 'onboarding_step_unlocked',
      'onboarding_step_task', 'onboarding_step_due', 'onboarding_overdue',
      'onboarding_overdue_manager', 'onboarding_completed', 'onboarding_completed_manager',
      'onboarding_survey_request',
      'general'
    ],
    default: 'general'
  },
  isCritical: { type: Boolean, default: false },
  read: { type: Boolean, default: false, index: true },
  date: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// 6. Learning Assignment (Крок 7. Рушій призначень)
const learningAssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['course', 'instruction'], default: 'course' },
  targetId: { type: String, required: true, index: true }, // courseId or sectionId
  title: { type: String, required: true },
  department: { type: String, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedByName: { type: String, default: 'Керівник' },
  assignedDate: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date, required: true, index: true },
  priority: { type: String, enum: ['recommended', 'mandatory', 'critical'], default: 'mandatory', index: true },
  status: { type: String, enum: ['assigned', 'in_progress', 'completed', 'overdue'], default: 'assigned', index: true },
  completedAt: { type: Date },
  score: { type: Number },
  notes: { type: String, default: '' },
  // Крок 11: dedup flags for the daily notification scheduler — each fires
  // at most once per assignment, independent of the (already-existing) lazy
  // status flip to 'overdue' that happens on read in getUserAssignments/getAssignmentsReport.
  deadlineReminderSentAt: { type: Date },
  overdueNotifiedAt: { type: Date }
}, {
  timestamps: true
});

learningAssignmentSchema.index({ userId: 1, targetType: 1, targetId: 1 });
learningAssignmentSchema.index({ status: 1, dueDate: 1 });

export const ReadingProgress = mongoose.models.ReadingProgress || mongoose.model('ReadingProgress', readingProgressSchema);
export const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);
export const CertificateRecord = mongoose.models.CertificateRecord || mongoose.model('CertificateRecord', certificateRecordSchema);
export const Acknowledgment = mongoose.models.Acknowledgment || mongoose.model('Acknowledgment', acknowledgmentSchema);
export const LearningNotification = mongoose.models.LearningNotification || mongoose.model('LearningNotification', learningNotificationSchema);
export const LearningAssignment = mongoose.models.LearningAssignment || mongoose.model('LearningAssignment', learningAssignmentSchema);
