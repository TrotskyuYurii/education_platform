import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

const FeatureFlagSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  description: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export const FeatureFlag = mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', FeatureFlagSchema);
