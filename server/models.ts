import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/@viatec\.ua$/i, 'Email має бути в домені @viatec.ua'] 
  },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  roleKeys: { type: [String], default: ['employee'] },
  departments: { type: [String], default: ['Всі підрозділи'] },
  allowedInstructionIds: { type: [String], default: [] }, // Changed from allowedCourseIds
  authMethod: { type: String, enum: ['password', 'otp'], default: 'password' },
  requireEmailCode: { type: Boolean, default: true },
  authCode: { type: String, default: null },
  authCodeExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  fullName: { type: String },
  avatarUrl: { type: String },
  phone: { type: String },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    hireDate: { type: Date },
  isActive: { type: Boolean, default: true },
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
});

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  headUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const positionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  grade: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String },
  country: { type: String },
  timezone: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const courseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  department: { type: String, required: true },
  instructionIds: { type: [String], default: [] },
  caseIds: { type: [String], default: [] },
  useCases: { type: Boolean, default: false },
  hasCertificate: { type: Boolean, default: false },
  certificateValidityYears: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const caseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sectionId: { type: String, required: false },
  title: { type: String, required: true },
  scenario: { type: String, required: true },
  options: [{
    id: String,
    text: String,
    isCorrect: Boolean,
    feedback: String
  }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const sectionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  department: String,
  targetRole: String,
  title: String,
  subtitle: String,
  summary: String,
  contentMarkdown: String,
  keyPoints: [String],
  keyFields: [String],
  readTimeMin: Number,
  contentHtml: String,
  pageReference: String,
  images: [String],
  steps: [{
    number: Number,
    title: String,
    description: String,
    tip: String,
    warning: String,
    imageUrl: String,
    images: [String]
  }],
  tableData: {
    headers: [String],
    rows: [[String]]
  },
  stopRules: [String],
  systemAutomaticActions: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const questionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sectionId: String,
  courseId: String,
  department: String,
  role: String,
  difficulty: { type: String, default: 'medium' },
  question: String,
  contextScenario: String,
  options: [String],
  correctIndex: Number,
  explanation: String,
  sourceDocPage: String,
  createdAt: { type: Date, default: Date.now }
});


const roleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  permissions: [{
    permission: { type: String, required: true },
    scope: { type: String, enum: ['self', 'team', 'department', 'all'], required: true }
  }],
  isSystem: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readSectionIds: [String],
  testScores: [{
    sectionId: String,
    courseId: String,
    department: String,
    mode: String,
    score: Number,
    total: Number,
    percentage: Number,
    date: { type: Date, default: Date.now }
  }],
  notifications: [{
    id: String,
    message: String,
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  }],
  certificates: [{
    courseId: String,
    courseTitle: String,
    issuedAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
  employeeInfo: {
    fullName: String,
    position: String,
    department: String,
    signedDate: String,
    isSigned: Boolean
  },
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Section = mongoose.models.Section || mongoose.model('Section', sectionSchema);
export const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
export const Progress = mongoose.models.Progress || mongoose.model('Progress', progressSchema);
export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
export const Position = mongoose.models.Position || mongoose.model('Position', positionSchema);
export const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);
export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
export const Case = mongoose.models.Case || mongoose.model('Case', caseSchema);

export const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);