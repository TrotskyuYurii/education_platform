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
  revocationReason: { type: String }
}, {
  timestamps: true
});

certificateRecordSchema.index({ userId: 1, courseId: 1, status: 1 });

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
  message: { type: String, required: true },
  type: { type: String, enum: ['certificate_revoked', 'certificate_expiring', 'general'], default: 'general' },
  read: { type: Boolean, default: false, index: true },
  date: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export const ReadingProgress = mongoose.models.ReadingProgress || mongoose.model('ReadingProgress', readingProgressSchema);
export const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);
export const CertificateRecord = mongoose.models.CertificateRecord || mongoose.model('CertificateRecord', certificateRecordSchema);
export const Acknowledgment = mongoose.models.Acknowledgment || mongoose.model('Acknowledgment', acknowledgmentSchema);
export const LearningNotification = mongoose.models.LearningNotification || mongoose.model('LearningNotification', learningNotificationSchema);
