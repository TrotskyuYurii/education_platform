import { Section } from '../../models.js';
import { stripMarkdown } from '../../../shared/searchText.js';
import {
  DuplicatePair,
  DuplicateSource,
  duplicatePairKey,
  findDuplicatePairs,
  groupDuplicatePairs,
  sectionDuplicateText,
  clampThreshold
} from '../../../shared/duplicateDetection.js';
import { DuplicateDismissal } from './models.js';

/** Поля інструкції, потрібні для порівняння, — без зображень і версій. */
const SECTION_PROJECTION = {
  id: 1, title: 1, department: 1, subtitle: 1, summary: 1, keyPoints: 1, steps: 1, stopRules: 1,
  contentMarkdown: 1, rawMarkdown: 1, isActive: 1, createdAt: 1, updatedAt: 1, 'sourceFile.checksum': 1,
  'sourceFile.fileName': 1
};

/** Короткий опис інструкції для картки пари: що це і звідки. */
export interface DuplicateSectionInfo {
  id: string;
  title: string;
  department: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  sourceFileName?: string;
  excerpt: string;
  wordCount: number;
}

export interface DuplicateReport {
  pairs: DuplicatePair[];
  groups: Array<{ ids: string[]; pairs: DuplicatePair[]; maxScore: number }>;
  sections: Record<string, DuplicateSectionInfo>;
  scanned: number;
  threshold: number;
  durationMs: number;
}

function describeSection(s: any, text: string): DuplicateSectionInfo {
  const plain = stripMarkdown(s.summary || text || '');
  return {
    id: s.id,
    title: s.title || 'Без назви',
    department: s.department || '',
    isActive: s.isActive !== false,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    sourceFileName: s.sourceFile?.fileName,
    excerpt: plain.length > 280 ? `${plain.slice(0, 280).trimEnd()}…` : plain,
    wordCount: stripMarkdown(text).split(/\s+/).filter(Boolean).length
  };
}

async function loadIgnoredPairKeys(focusIds?: string[]): Promise<Set<string>> {
  const filter = focusIds && focusIds.length > 0 ? { sectionIds: { $in: focusIds } } : {};
  const rows = await DuplicateDismissal.find(filter as any, { pairKey: 1 } as any).lean<any[]>();
  return new Set(rows.map(r => r.pairKey));
}

export const DuplicateService = {
  /**
   * Пошук дублів. Без `focusIds` — по всій базі; з ними — лише пари, де є
   * хоча б одна з цих інструкцій (перевірка щойно імпортованих).
   */
  async find(options: { threshold?: unknown; focusIds?: string[] } = {}): Promise<DuplicateReport> {
    const started = Date.now();
    const threshold = clampThreshold(options.threshold);
    const focusIds = (options.focusIds || []).filter(id => typeof id === 'string' && id);

    const rows = await Section.find({} as any, SECTION_PROJECTION as any).lean<any[]>();
    const texts = new Map<string, string>();
    const sources: DuplicateSource[] = rows.map(s => {
      const text = sectionDuplicateText(s);
      texts.set(s.id, text);
      return { id: s.id, title: s.title || '', text, department: s.department, checksum: s.sourceFile?.checksum };
    });

    const ignoredPairKeys = await loadIgnoredPairKeys(focusIds.length > 0 ? focusIds : undefined);
    const pairs = findDuplicatePairs(sources, { threshold, focusIds, ignoredPairKeys });

    const involved = new Set<string>();
    pairs.forEach(p => { involved.add(p.a); involved.add(p.b); });
    const sections: Record<string, DuplicateSectionInfo> = {};
    for (const s of rows) {
      if (involved.has(s.id)) sections[s.id] = describeSection(s, texts.get(s.id) || '');
    }

    return {
      pairs,
      groups: groupDuplicatePairs(pairs),
      sections,
      scanned: rows.length,
      threshold,
      durationMs: Date.now() - started
    };
  },

  /** «Це не дубль»: пара більше не з'являтиметься в результатах. */
  async dismiss(a: string, b: string, userId?: string): Promise<void> {
    const pairKey = duplicatePairKey(a, b);
    await DuplicateDismissal.updateOne(
      { pairKey } as any,
      { $setOnInsert: { pairKey, sectionIds: [a, b], dismissedBy: userId, createdAt: new Date() } } as any,
      { upsert: true } as any
    );
  },

  /** Відхилені пари з видаленою інструкцією вже нічого не значать. */
  async forgetSection(sectionId: string): Promise<void> {
    await DuplicateDismissal.deleteMany({ sectionIds: sectionId } as any);
  }
};
