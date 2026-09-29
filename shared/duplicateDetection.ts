/**
 * Інтелектуальний пошук дублів інструкцій.
 *
 * Дубль — це не лише дослівна копія. Одну й ту саму інструкцію часто
 * завантажують повторно з іншою назвою, з дрібними правками чи в іншому
 * форматі (PDF замість DOCX), або ШІ по-різному переказує той самий документ.
 * Тому порівнюємо кількома незалежними ознаками:
 *  - однаковий файл-оригінал (контрольна сума) — гарантований дубль;
 *  - схожість назв за основами слів (словоформи не заважають);
 *  - схожість змісту: TF-IDF косинус за основами — ловить переказ тими ж словами;
 *  - збіг фрагментів тексту (шингли з трьох основ) — ловить копію з правками
 *    та випадок, коли одна інструкція повністю входить в іншу.
 *
 * Модуль чистий (без БД): його використовують і сервер, і тести.
 */
import { stripMarkdown, tokenize, isStopWord } from './searchText.js';

/** Рівень збігу: від гарантованого дубля до «варто глянути». */
export type DuplicateLevel = 'exact' | 'high' | 'possible';

export const DUPLICATE_LEVEL_LABELS: Record<DuplicateLevel, string> = {
  exact: 'Повний дубль',
  high: 'Ймовірний дубль',
  possible: 'Схожий зміст'
};

/** Пороги оцінки для рівнів. `possible` — типовий мінімум для показу. */
export const DUPLICATE_THRESHOLDS = {
  exact: 0.95,
  high: 0.8,
  possible: 0.6
} as const;

/** Допустимий діапазон порогу, який може задати адміністратор. */
export const MIN_DUPLICATE_THRESHOLD = 0.3;
export const MAX_DUPLICATE_THRESHOLD = 0.99;

/** Скільки шинглів має бути в тексті, щоб збіг фрагментів щось означав. */
const MIN_SHINGLES = 8;
const SHINGLE_SIZE = 3;

export interface DuplicateSource {
  id: string;
  title: string;
  /** Весь зміст інструкції одним рядком (див. `sectionDuplicateText`). */
  text: string;
  department?: string;
  /** Контрольна сума файлу-оригіналу, якщо він є. */
  checksum?: string;
}

export interface DuplicateFingerprint {
  id: string;
  titleKey: string;
  titleStems: Set<string>;
  termCounts: Map<string, number>;
  shingles: Set<string>;
  checksum: string;
}

export interface DuplicateScores {
  /** Підсумкова оцінка 0..1 */
  score: number;
  title: number;
  content: number;
  overlap: number;
  sameSource: boolean;
}

export interface DuplicatePair extends DuplicateScores {
  a: string;
  b: string;
  level: DuplicateLevel;
  /** Людські пояснення, чому пару вважено дублем. */
  reasons: string[];
}

/** Ключ пари, незалежний від порядку: так зберігаються й відхилені пари. */
export const duplicatePairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Значущі основи тексту: без службових слів і одиночних символів. */
function contentStems(text: string): string[] {
  return tokenize(stripMarkdown(text))
    .filter(t => t.word.length > 1 && !isStopWord(t.word))
    .map(t => t.stem);
}

/**
 * Весь зміст інструкції одним рядком. Беремо і структуровані поля, і сирий
 * Markdown: у старих інструкціях є лише перші, у нових зміст живе в другому.
 */
export function sectionDuplicateText(section: any): string {
  if (!section) return '';
  const parts: string[] = [];
  const push = (v: unknown) => { if (typeof v === 'string' && v.trim()) parts.push(v); };

  push(section.subtitle);
  push(section.summary);
  (section.keyPoints || []).forEach(push);
  (section.steps || []).forEach((s: any) => { push(s?.title); push(s?.description); push(s?.tip); push(s?.warning); });
  (section.stopRules || []).forEach(push);
  push(section.contentMarkdown);
  push(section.rawMarkdown);
  return parts.join('\n');
}

export function buildFingerprint(source: DuplicateSource): DuplicateFingerprint {
  const titleStems = contentStems(source.title || '');
  const stems = contentStems(source.text || '');

  const termCounts = new Map<string, number>();
  for (const s of stems) termCounts.set(s, (termCounts.get(s) || 0) + 1);

  const shingles = new Set<string>();
  for (let i = 0; i + SHINGLE_SIZE <= stems.length; i += 1) {
    shingles.add(stems.slice(i, i + SHINGLE_SIZE).join(' '));
  }

  return {
    id: source.id,
    titleKey: titleStems.join(' '),
    titleStems: new Set(titleStems),
    termCounts,
    shingles,
    checksum: (source.checksum || '').trim()
  };
}

/** Частота документів для кожної основи — щоб загальні слова важили менше. */
export function buildIdf(fingerprints: DuplicateFingerprint[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const fp of fingerprints) {
    for (const term of fp.termCounts.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  const n = Math.max(fingerprints.length, 1);
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, Math.log(1 + n / count));
  return idf;
}

interface Vector {
  weights: Map<string, number>;
  norm: number;
}

function toVector(fp: DuplicateFingerprint, idf: Map<string, number>): Vector {
  const weights = new Map<string, number>();
  let sum = 0;
  for (const [term, count] of fp.termCounts) {
    // Сублінійна частота: десяте повторення слова не в десять разів важливіше
    const w = (1 + Math.log(count)) * (idf.get(term) ?? Math.log(2));
    weights.set(term, w);
    sum += w * w;
  }
  return { weights, norm: Math.sqrt(sum) };
}

function cosine(a: Vector, b: Vector): number {
  if (a.norm === 0 || b.norm === 0) return 0;
  const [small, large] = a.weights.size <= b.weights.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, w] of small.weights) {
    const other = large.weights.get(term);
    if (other) dot += w * other;
  }
  return dot / (a.norm * b.norm);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Частка меншого тексту, що дослівно (за основами) є в більшому. */
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size < MIN_SHINGLES || b.size < MIN_SHINGLES) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter += 1;
  return inter / small.size;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

function scorePair(a: DuplicateFingerprint, b: DuplicateFingerprint, va: Vector, vb: Vector): DuplicateScores {
  const sameSource = Boolean(a.checksum) && a.checksum === b.checksum;
  const title = a.titleKey && a.titleKey === b.titleKey ? 1 : jaccard(a.titleStems, b.titleStems);
  const content = cosine(va, vb);
  const overlap = containment(a.shingles, b.shingles);

  // Порожній зміст (лише назва) не дає підстав для високої оцінки:
  // інакше дві різні інструкції з назвою «Інструкція» збігалися б на 100%.
  const hasContent = va.norm > 0 && vb.norm > 0;
  const blended = hasContent ? 0.25 * title + 0.75 * content : 0.5 * title;
  const score = sameSource ? 1 : Math.min(1, Math.max(blended, overlap));

  return { score: round(score), title: round(title), content: round(content), overlap: round(overlap), sameSource };
}

export function levelForScore(score: number): DuplicateLevel {
  if (score >= DUPLICATE_THRESHOLDS.exact) return 'exact';
  if (score >= DUPLICATE_THRESHOLDS.high) return 'high';
  return 'possible';
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function explainScores(s: DuplicateScores): string[] {
  const reasons: string[] = [];
  if (s.sameSource) reasons.push('Завантажено з того самого файлу-оригіналу');
  if (s.title >= 1) reasons.push('Однакова назва');
  else if (s.title >= 0.5) reasons.push(`Схожа назва (${pct(s.title)})`);
  if (s.overlap >= 0.5) reasons.push(`Збіг фрагментів тексту: ${pct(s.overlap)}`);
  if (s.content >= 0.5) reasons.push(`Схожий зміст: ${pct(s.content)}`);
  if (reasons.length === 0) reasons.push(`Загальна схожість: ${pct(s.score)}`);
  return reasons;
}

export function clampThreshold(value: unknown, fallback: number = DUPLICATE_THRESHOLDS.possible): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_DUPLICATE_THRESHOLD, Math.max(MIN_DUPLICATE_THRESHOLD, n));
}

export interface FindDuplicatesOptions {
  /** Мінімальна оцінка для показу (типово 0.6). */
  threshold?: number;
  /** Якщо задано — лише пари, де хоча б одна інструкція з цього переліку. */
  focusIds?: string[];
  /** Ключі пар, які адміністратор уже позначив як «не дубль». */
  ignoredPairKeys?: Set<string>;
}

/**
 * Пари дублів, від найсхожіших. Idf рахується по всій базі, тож навіть при
 * перевірці однієї нової інструкції загальні слова компанії не роздувають оцінку.
 */
export function findDuplicatePairs(sources: DuplicateSource[], options: FindDuplicatesOptions = {}): DuplicatePair[] {
  const threshold = clampThreshold(options.threshold);
  const focus = options.focusIds && options.focusIds.length > 0 ? new Set(options.focusIds) : null;
  const ignored = options.ignoredPairKeys;

  const unique = new Map<string, DuplicateSource>();
  for (const s of sources) if (s?.id && !unique.has(s.id)) unique.set(s.id, s);
  const list = [...unique.values()];

  const fingerprints = list.map(buildFingerprint);
  const idf = buildIdf(fingerprints);
  const vectors = fingerprints.map(fp => toVector(fp, idf));

  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < fingerprints.length; i += 1) {
    for (let j = i + 1; j < fingerprints.length; j += 1) {
      const a = fingerprints[i];
      const b = fingerprints[j];
      if (focus && !focus.has(a.id) && !focus.has(b.id)) continue;
      if (ignored && ignored.has(duplicatePairKey(a.id, b.id))) continue;

      const scores = scorePair(a, b, vectors[i], vectors[j]);
      if (scores.score < threshold) continue;

      // Нова інструкція — завжди ліворуч, щоб «що робити з новою» читалося однаково.
      const swap = focus ? !focus.has(a.id) && focus.has(b.id) : false;
      pairs.push({
        a: swap ? b.id : a.id,
        b: swap ? a.id : b.id,
        ...scores,
        level: levelForScore(scores.score),
        reasons: explainScores(scores)
      });
    }
  }

  return pairs.sort((x, y) => y.score - x.score || x.a.localeCompare(y.a));
}

/**
 * Групи дублів: якщо A схожа на B, а B — на C, це одна група з трьох.
 * Адміністратору зручніше вирішувати долю всієї групи разом.
 */
export function groupDuplicatePairs(pairs: DuplicatePair[]): Array<{ ids: string[]; pairs: DuplicatePair[]; maxScore: number }> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) { const next = parent.get(cur)!; parent.set(cur, root); cur = next; }
    return root;
  };
  for (const p of pairs) {
    if (!parent.has(p.a)) parent.set(p.a, p.a);
    if (!parent.has(p.b)) parent.set(p.b, p.b);
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<string, { ids: Set<string>; pairs: DuplicatePair[]; maxScore: number }>();
  for (const p of pairs) {
    const root = find(p.a);
    const g = groups.get(root) || { ids: new Set<string>(), pairs: [], maxScore: 0 };
    g.ids.add(p.a);
    g.ids.add(p.b);
    g.pairs.push(p);
    g.maxScore = Math.max(g.maxScore, p.score);
    groups.set(root, g);
  }

  return [...groups.values()]
    .map(g => ({ ids: [...g.ids], pairs: g.pairs, maxScore: g.maxScore }))
    .sort((x, y) => y.maxScore - x.maxScore || y.ids.length - x.ids.length);
}
