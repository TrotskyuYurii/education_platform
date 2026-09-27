import {
  normalizeText,
  stripMarkdown,
  tokenize,
  parseQuery,
  termMatchWeight,
  type QueryTerm,
  type TextToken
} from '../../../shared/searchText.js';

/**
 * Пошуковий індекс у пам'яті з ранжуванням «за змістом».
 *
 * Документ складається із заголовка та полів з різною вагою (короткий зміст
 * важить більше за повний текст, контекст — назва інструкції, до якої належить
 * питання, — менше). Оцінка враховує:
 *  - якість збігу слова (точна основа > словоформа > синонім > одруківка);
 *  - рідкість слова в базі (BM25-подібний idf — «повернення» цінніше за «товар»);
 *  - частку слів запиту, що знайшлися;
 *  - точний збіг усієї фрази та близькість знайдених слів одне до одного.
 */

export interface IndexField {
  text: string;
  /** 1 — звичайний текст; >1 — важливіше поле; <1 — лише контекст */
  weight: number;
}

export interface IndexInput<M> {
  title: string;
  fields: IndexField[];
  meta: M;
}

interface BodyToken extends TextToken {
  weight: number;
}

interface IndexedDoc<M> {
  meta: M;
  titleTokens: TextToken[];
  body: string;
  bodyTokens: BodyToken[];
  normTitle: string;
  normBody: string;
  /** основа → найвища вага поля, де вона трапилась, і кількість входжень */
  stems: Map<string, { weight: number; tf: number }>;
}

export interface IndexHit<M> {
  meta: M;
  score: number;
  matchedField: 'title' | 'content';
  snippet: string;
  /** Слова з тексту (як вони там написані), що збіглися із запитом — для підсвічування */
  highlights: string[];
}

const TITLE_WEIGHT = 3;
const SNIPPET_WINDOW = 28;
const SNIPPET_MAX_CHARS = 220;
const FIELD_SEPARATOR = ' · ';

export class SearchIndex<M> {
  private docs: IndexedDoc<M>[] = [];
  private docFreq = new Map<string, number>();

  constructor(inputs: IndexInput<M>[]) {
    for (const input of inputs) this.add(input);
  }

  get size() {
    return this.docs.length;
  }

  private add(input: IndexInput<M>) {
    const title = stripMarkdown(input.title || '');
    const titleTokens = tokenize(title);

    const ranges: { start: number; end: number; weight: number }[] = [];
    let body = '';
    for (const field of input.fields) {
      const text = stripMarkdown(field.text || '');
      if (!text) continue;
      if (body) body += FIELD_SEPARATOR;
      ranges.push({ start: body.length, end: body.length + text.length, weight: field.weight });
      body += text;
    }

    let r = 0;
    const bodyTokens: BodyToken[] = tokenize(body).map(t => {
      while (r < ranges.length - 1 && t.start >= ranges[r].end) r++;
      return { ...t, weight: ranges[r]?.weight ?? 1 };
    });

    const stems = new Map<string, { weight: number; tf: number }>();
    const touch = (stem: string, weight: number) => {
      const entry = stems.get(stem);
      if (entry) {
        entry.tf++;
        if (weight > entry.weight) entry.weight = weight;
      } else {
        stems.set(stem, { weight, tf: 1 });
      }
    };
    titleTokens.forEach(t => touch(t.stem, TITLE_WEIGHT));
    bodyTokens.forEach(t => touch(t.stem, t.weight));

    for (const stem of stems.keys()) {
      this.docFreq.set(stem, (this.docFreq.get(stem) || 0) + 1);
    }

    this.docs.push({
      meta: input.meta,
      titleTokens,
      body,
      bodyTokens,
      normTitle: normalizeText(title),
      normBody: normalizeText(body),
      stems
    });
  }

  private idf(stem: string) {
    const df = this.docFreq.get(stem) || 0;
    return Math.log(1 + (this.docs.length + 1) / (df + 0.5));
  }

  /** Для кожного терміну — які основи зі словника індексу йому відповідають і наскільки. */
  private expandTerms(terms: QueryTerm[]): Map<string, number>[] {
    const expansions = terms.map(() => new Map<string, number>());
    for (const stem of this.docFreq.keys()) {
      terms.forEach((term, i) => {
        const w = termMatchWeight(term, stem);
        if (w > 0) expansions[i].set(stem, w);
      });
    }
    return expansions;
  }

  search(query: string, filter?: (meta: M) => boolean): IndexHit<M>[] {
    const terms = parseQuery(query);
    if (terms.length === 0) return [];

    const expansions = this.expandTerms(terms);
    const phrase = normalizeText(query);
    const hits: IndexHit<M>[] = [];

    for (const doc of this.docs) {
      if (filter && !filter(doc.meta)) continue;

      let relevance = 0;
      let matchedTerms = 0;
      for (const expansion of expansions) {
        let best = 0;
        // Перебираємо менший із двох наборів
        if (expansion.size < doc.stems.size) {
          for (const [stem, quality] of expansion) {
            const entry = doc.stems.get(stem);
            if (entry) best = Math.max(best, quality * entry.weight * (1 + Math.log(entry.tf)) * this.idf(stem));
          }
        } else {
          for (const [stem, entry] of doc.stems) {
            const quality = expansion.get(stem);
            if (quality) best = Math.max(best, quality * entry.weight * (1 + Math.log(entry.tf)) * this.idf(stem));
          }
        }
        if (best > 0) {
          matchedTerms++;
          relevance += best;
        }
      }

      if (matchedTerms === 0) continue;
      const coverage = matchedTerms / terms.length;
      // Для довших запитів мають знайтися хоча б половина значущих слів
      if (terms.length >= 2 && coverage < 0.5) continue;

      let score = relevance * coverage * coverage;

      if (phrase.length >= 3) {
        if (doc.normTitle.includes(phrase)) score += 6;
        else if (doc.normBody.includes(phrase)) score += 3;
      }

      const termOf = (token: TextToken) => {
        for (let i = 0; i < expansions.length; i++) if (expansions[i].has(token.stem)) return i;
        return -1;
      };

      const bodyMatches: { pos: number; term: number }[] = [];
      doc.bodyTokens.forEach((t, pos) => {
        const term = termOf(t);
        if (term !== -1) bodyMatches.push({ pos, term });
      });

      score += proximityBonus(bodyMatches, matchedTerms);

      const titleMatched = doc.titleTokens.filter(t => termOf(t) !== -1);
      const { snippet, snippetTokens } = buildSnippet(doc, bodyMatches);

      const highlights = new Set<string>();
      for (const t of titleMatched) highlights.add(t.word);
      for (const t of snippetTokens) if (termOf(t) !== -1) highlights.add(doc.body.slice(t.start, t.end));

      hits.push({
        meta: doc.meta,
        score: Math.round(score * 10),
        matchedField: titleMatched.length > 0 ? 'title' : 'content',
        snippet,
        highlights: [...highlights].slice(0, 20)
      });
    }

    return hits.sort((a, b) => b.score - a.score);
  }
}

/**
 * Бонус за те, що різні слова запиту стоять поруч: найвужче вікно токенів,
 * яке містить усі знайдені терміни. «Повернення … на картку» в одному реченні
 * важить більше, ніж ці слова на різних сторінках інструкції.
 */
function proximityBonus(matches: { pos: number; term: number }[], matchedTerms: number): number {
  if (matchedTerms < 2 || matches.length < 2) return 0;
  const need = new Set(matches.map(m => m.term)).size;
  if (need < 2) return 0;

  const counts = new Map<number, number>();
  let have = 0;
  let left = 0;
  let bestSpan = Infinity;
  for (let right = 0; right < matches.length; right++) {
    const t = matches[right].term;
    counts.set(t, (counts.get(t) || 0) + 1);
    if (counts.get(t) === 1) have++;
    while (have === need) {
      bestSpan = Math.min(bestSpan, matches[right].pos - matches[left].pos + 1);
      const lt = matches[left].term;
      counts.set(lt, counts.get(lt)! - 1);
      if (counts.get(lt) === 0) have--;
      left++;
    }
  }
  if (!isFinite(bestSpan)) return 0;
  return 4 * Math.min(1, (need + 2) / bestSpan);
}

/**
 * Фрагмент тексту навколо місця, де зібрано найбільше різних слів запиту,
 * а не просто навколо першого входження першого слова.
 */
function buildSnippet(
  doc: IndexedDoc<unknown>,
  matches: { pos: number; term: number }[]
): { snippet: string; snippetTokens: TextToken[] } {
  const { body, bodyTokens } = doc;
  if (!body) return { snippet: '', snippetTokens: [] };

  if (matches.length === 0) {
    const cut = body.length > SNIPPET_MAX_CHARS * 0.7;
    return { snippet: body.slice(0, Math.round(SNIPPET_MAX_CHARS * 0.7)).trim() + (cut ? '...' : ''), snippetTokens: [] };
  }

  let bestStart = matches[0].pos;
  let bestDistinct = 0;
  let bestTotal = 0;
  let right = 0;
  for (let left = 0; left < matches.length; left++) {
    while (right < matches.length && matches[right].pos - matches[left].pos < SNIPPET_WINDOW) right++;
    const window = matches.slice(left, right);
    const distinct = new Set(window.map(m => m.term)).size;
    if (distinct > bestDistinct || (distinct === bestDistinct && window.length > bestTotal)) {
      bestDistinct = distinct;
      bestTotal = window.length;
      bestStart = matches[left].pos;
    }
  }

  // Трохи контексту перед першим збігом
  const from = Math.max(0, bestStart - 6);
  const to = Math.min(bodyTokens.length - 1, from + SNIPPET_WINDOW + 6);
  const startChar = bodyTokens[from].start;
  let endChar = bodyTokens[to].end;
  if (endChar - startChar > SNIPPET_MAX_CHARS) endChar = startChar + SNIPPET_MAX_CHARS;

  const snippetTokens = bodyTokens.slice(from, to + 1).filter(t => t.end <= endChar);
  let snippet = body.slice(startChar, endChar).trim();
  if (startChar > 0) snippet = '...' + snippet;
  if (endChar < body.length) snippet += '...';
  return { snippet, snippetTokens };
}
