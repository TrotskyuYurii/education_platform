import mongoose from 'mongoose';

// Крок 12 (Аналітика): every /api/search call gets logged here so we can report
// "запити без результатів" — queries nobody could find content for.
const searchQueryLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  query: { type: String, required: true },
  resultCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
searchQueryLogSchema.index({ createdAt: -1 });
searchQueryLogSchema.index({ resultCount: 1, createdAt: -1 });

export const SearchQueryLog = mongoose.models.SearchQueryLog || mongoose.model('SearchQueryLog', searchQueryLogSchema);
