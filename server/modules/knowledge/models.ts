import mongoose from 'mongoose';

/**
 * Knowledge Space Schema
 * Organizes articles, courses and guidelines into thematic or departmental spaces
 * e.g. "Загальний", "Складська логістика", "Бухгалтерія та облік", "IT та безпека", "Касова зона"
 */
const knowledgeSpaceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  code: { type: String, uppercase: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'BookOpen' }, // Lucide icon identifier
  color: { type: String, default: 'indigo' }, // Tailwind color token: blue, indigo, emerald, amber, purple, rose, cyan
  department: { type: String, default: '' }, // Associated department if bound to a specific one
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * Instruction / Section Version Revision Schema
 * Preserves historical snapshots, change logs, authors, and approval state for enterprise compliance
 */
const instructionVersionSchema = new mongoose.Schema({
  sectionId: { type: String, required: true, index: true },
  version: { type: String, required: true }, // e.g. "1.0", "1.1", "2.0"
  versionNumber: { type: Number, required: true }, // Incremental integer (1, 2, 3...)
  status: { 
    type: String, 
    enum: ['draft', 'in_review', 'published', 'archived'], 
    default: 'published' 
  },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  summary: { type: String, default: '' },
  contentMarkdown: { type: String, default: '' },
  contentHtml: { type: String, default: '' },
  keyPoints: { type: [String], default: [] },
  keyFields: { type: [String], default: [] },
  stopRules: { type: [String], default: [] },
  steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
  tableData: { type: mongoose.Schema.Types.Mixed, default: null },
  changeSummary: { type: String, default: '' }, // What was changed in this revision
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, default: 'Адміністратор' },
  authorEmail: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Composite index for fast revision ordering
instructionVersionSchema.index({ sectionId: 1, versionNumber: -1 });

export const KnowledgeSpace = mongoose.models.KnowledgeSpace || mongoose.model('KnowledgeSpace', knowledgeSpaceSchema);
export const InstructionVersion = mongoose.models.InstructionVersion || mongoose.model('InstructionVersion', instructionVersionSchema);
