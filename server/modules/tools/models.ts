import mongoose from 'mongoose';

/**
 * Пара інструкцій, яку адміністратор переглянув і позначив «це не дубль».
 * Без цього запису пошук щоразу показував би ту саму пару знову.
 */
const duplicateDismissalSchema = new mongoose.Schema({
  /** Відсортовані id через «|» — див. duplicatePairKey */
  pairKey: { type: String, required: true, unique: true },
  sectionIds: { type: [String], default: [], index: true },
  dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

export const DuplicateDismissal = mongoose.models.DuplicateDismissal
  || mongoose.model('DuplicateDismissal', duplicateDismissalSchema);
