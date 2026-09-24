import mongoose from 'mongoose';

/**
 * Тека матеріалів адміністративного розділу.
 *
 * Переліки інструкцій, курсів і кейсів росли одним пласким списком: коли
 * регламентів стає кілька сотень, знайти потрібний можна лише пошуком, а
 * згрупувати споріднені — ніяк. Тека дає адміністратору звичну ієрархію,
 * не чіпаючи те, як матеріали бачить співробітник: підрозділи, простори
 * знань і права доступу працюють як раніше, тека — суто організаційний шар.
 *
 * Дерево тек своє для кожного типу матеріалу (`kind`), бо змішувати курс і
 * кейс в одній теці нема сенсу — це різні вкладки адмінки.
 */
export const MATERIAL_FOLDER_KINDS = ['instruction', 'course', 'case'] as const;
export type MaterialFolderKind = (typeof MATERIAL_FOLDER_KINDS)[number];

/** Глибше вкладати нема потреби, а дерево лишається читабельним на екрані. */
export const MATERIAL_FOLDER_MAX_DEPTH = 5;

const materialFolderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: MATERIAL_FOLDER_KINDS, required: true, index: true },
  /** id батьківської теки або null для кореневого рівня. */
  parentId: { type: String, default: null, index: true },
  /** Токен кольору Tailwind для плитки теки: slate, blue, purple, emerald, amber, rose, cyan. */
  color: { type: String, default: 'blue' },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

materialFolderSchema.index({ kind: 1, parentId: 1, order: 1 });

export const MaterialFolder =
  mongoose.models.MaterialFolder || mongoose.model('MaterialFolder', materialFolderSchema);
