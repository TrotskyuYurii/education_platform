import mongoose from 'mongoose';

export const TRASH_KINDS = ['instruction', 'course', 'case'] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

/**
 * Видалений матеріал у корзині.
 *
 * Матеріал не позначається прапорцем у власній колекції, а переноситься сюди
 * цілим знімком разом зі зв'язками, які видалення розірвало (питання тесту,
 * місця в курсах, позначки «прочитано»). Так решта застосунку — каталог,
 * пошук, аналітика — нічого не знає про корзину й не може випадково показати
 * видалене, а відновлення повертає матеріал рівно таким, яким він був.
 */
const trashItemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: TRASH_KINDS, required: true, index: true },
  /** id матеріалу в його колекції (Section.id, Course.id, Case.id) */
  materialId: { type: String, required: true, index: true },
  title: { type: String, default: '' },
  department: { type: String, default: '' },
  /** Документ матеріалу як він був у базі, включно з _id. */
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  related: {
    /** Питання тесту інструкції */
    questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /** Де матеріал стояв у курсах — щоб повернути на те саме місце. */
    courseRefs: { type: [{ courseId: String, field: String, index: Number, _id: false }], default: [] },
    /** Хто мав інструкцію в прочитаних */
    readByUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    /** Записи ReadingProgress: хто і коли прочитав інструкцію */
    readings: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  deletedAt: { type: Date, default: Date.now, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  deletedByName: { type: String, default: '' }
});

export const TrashItem = mongoose.models.TrashItem || mongoose.model('TrashItem', trashItemSchema);
