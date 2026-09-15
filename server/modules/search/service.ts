import { Section, Question, Case, Course, KnowledgeSpace } from '../../models.js';

export interface SearchOptions {
  q: string;
  spaceId?: string;
  type?: 'all' | 'instruction' | 'question' | 'case' | 'course' | 'glossary';
  limit?: number;
}

export interface SearchHit {
  id: string;
  type: 'instruction' | 'question' | 'case' | 'course' | 'glossary';
  title: string;
  subtitle?: string;
  snippet: string;
  matchedField?: string;
  spaceId?: string;
  spaceName?: string;
  department?: string;
  courseId?: string;
  sectionId?: string;
  version?: string;
  status?: string;
  score: number;
}

const GLOSSARY_ITEMS = [
  {
    id: 'glossary-rmk',
    term: 'РМК (Робоче місце касира)',
    definition: 'Спеціалізований касовий інтерфейс програми для оформлення роздрібних продажів та повернень день у день (під час відкритої зміни).',
    category: 'Терміни',
    sectionId: 'scenario-a',
    spaceId: 'space-general'
  },
  {
    id: 'glossary-act-100',
    term: 'Акт про видачу коштів (понад 100 грн)',
    definition: 'Суворо обов’язковий фіскальний документ при поверненні коштів клієнту на суму більше 100 грн, що підписується комісією та покупцем.',
    category: 'СТОП-правила',
    sectionId: 'accounting-and-docs',
    spaceId: 'space-finance'
  },
  {
    id: 'glossary-scenario-a',
    term: 'Сценарій А (Повернення день у день)',
    definition: 'Повернення товару клієнтом у день покупки, поки касова зміна ще не закрита. Оформлюється безпосередньо в РМК без складних коригувань.',
    category: 'Сценарії',
    sectionId: 'scenario-a',
    spaceId: 'space-general'
  },
  {
    id: 'glossary-scenario-b',
    term: 'Сценарій Б (Закрита касова зміна)',
    definition: 'Повернення товару, придбаного в попередні дні (зміну вже закрито, гроші здано у виторг). Вимагає документу «Повернення товарів від клієнта» та РКО.',
    category: 'Сценарії',
    sectionId: 'scenario-b',
    spaceId: 'space-general'
  },
  {
    id: 'glossary-pdv',
    term: 'Коригування ПДВ та розрахунок коригування',
    definition: 'Бухгалтерська операція реєстрації розрахунку коригування до податкової накладної при поверненні товару юридичними або фізичними особами.',
    category: 'Бухгалтерія',
    sectionId: 'accounting-and-docs',
    spaceId: 'space-finance'
  },
  {
    id: 'glossary-stop-same-card',
    term: 'СТОП-правило: Повернення строго на ту саму картку',
    definition: 'Заборонено виплачувати готівку за товар, оплачений банківською карткою! Кошти повертаються виключно через банківський термінал на ту саму картку.',
    category: 'СТОП-правила',
    sectionId: 'stop-rules-and-errors',
    spaceId: 'space-general'
  },
  {
    id: 'glossary-14-days',
    term: 'Термін повернення 14 днів',
    definition: 'Згідно із ЗУ «Про захист прав споживачів», повернення непродовольчого товару належної якості можливе протягом 14 календарних днів без дня покупки.',
    category: 'Вимоги закону',
    sectionId: 'intro-and-rules',
    spaceId: 'space-general'
  }
];

function extractSnippet(text: string, queryTokens: string[], maxLength: number = 140): string {
  if (!text) return '';
  const clean = text.replace(/[*#`_\[\]()>-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const lowerText = clean.toLowerCase();
  let bestPos = -1;

  for (const token of queryTokens) {
    const pos = lowerText.indexOf(token.toLowerCase());
    if (pos !== -1) {
      bestPos = pos;
      break;
    }
  }

  if (bestPos === -1) {
    return clean.slice(0, maxLength) + (clean.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, bestPos - 40);
  const end = Math.min(clean.length, bestPos + 100);
  let snippet = clean.slice(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < clean.length) snippet = snippet + '...';

  return snippet;
}

function calculateScore(
  title: string,
  content: string,
  queryLower: string,
  queryTokens: string[]
): { score: number; matchedField: string } {
  let score = 0;
  let matchedField = 'content';
  const titleLower = (title || '').toLowerCase();
  const contentLower = (content || '').toLowerCase();

  // 1. Exact query match in title
  if (titleLower.includes(queryLower)) {
    score += 150;
    matchedField = 'title';
  } else if (titleLower.startsWith(queryLower)) {
    score += 120;
    matchedField = 'title';
  }

  // 2. Exact query match in content
  if (contentLower.includes(queryLower)) {
    score += 70;
    if (matchedField !== 'title') matchedField = 'content';
  }

  // 3. Token-by-token matching
  let matchedTokensCount = 0;
  for (const token of queryTokens) {
    if (token.length < 2) continue;
    if (titleLower.includes(token)) {
      score += 40;
      matchedTokensCount++;
    } else if (contentLower.includes(token)) {
      score += 15;
      matchedTokensCount++;
    }
  }

  // Bonus if all tokens match
  if (queryTokens.length > 1 && matchedTokensCount >= queryTokens.length) {
    score += 50;
  }

  return { score, matchedField };
}

export class SearchService {
  /**
   * Execute multi-entity global search
   */
  static async search(options: SearchOptions) {
    const { q, spaceId, type = 'all', limit = 30 } = options;
    const cleanQuery = (q || '').trim();
    if (!cleanQuery) {
      return {
        query: '',
        total: 0,
        counts: { all: 0, instruction: 0, question: 0, case: 0, course: 0, glossary: 0 },
        results: []
      };
    }

    const queryLower = cleanQuery.toLowerCase();
    const queryTokens = queryLower
      .split(/\s+/)
      .map(t => t.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(t => t.length > 1);

    if (queryTokens.length === 0) {
      queryTokens.push(queryLower);
    }

    // Preload Spaces map for name resolution
    const spaces = await KnowledgeSpace.find({}).lean();
    const spaceMap = new Map<string, string>();
    spaces.forEach((s: any) => spaceMap.set(s.id, s.name));

    const hits: SearchHit[] = [];

    // 1. Search Instructions (Sections)
    if (type === 'all' || type === 'instruction') {
      const sectionQuery: any = { isActive: { $ne: false } };
      if (spaceId && spaceId !== 'all') {
        sectionQuery.spaceId = spaceId;
      }

      const sections = await Section.find(sectionQuery).lean();
      for (const sec of sections as any[]) {
        const fullContent = [
          sec.subtitle || '',
          sec.summary || '',
          sec.contentMarkdown || '',
          ...(sec.keyPoints || []),
          ...(sec.stopRules || []),
          ...(sec.steps?.map((st: any) => `${st.title} ${st.description}`) || []),
          ...(sec.tableData?.rows?.flat() || [])
        ].join(' ');

        const { score, matchedField } = calculateScore(sec.title || '', fullContent, queryLower, queryTokens);
        if (score > 0) {
          hits.push({
            id: sec.id,
            type: 'instruction',
            title: sec.title || 'Регламент',
            subtitle: sec.subtitle || sec.department,
            snippet: extractSnippet(matchedField === 'title' ? (sec.summary || fullContent) : fullContent, queryTokens),
            matchedField,
            spaceId: sec.spaceId || 'space-general',
            spaceName: spaceMap.get(sec.spaceId || 'space-general') || 'Загальний простір',
            department: sec.department,
            courseId: sec.courseId,
            sectionId: sec.id,
            version: sec.version || '1.0',
            status: sec.status || 'published',
            score
          });
        }
      }
    }

    // 2. Search Questions
    if (type === 'all' || type === 'question') {
      const questionQuery: any = {};
      const questions = await Question.find(questionQuery).lean();

      for (const qItem of questions as any[]) {
        const fullContent = [
          qItem.contextScenario || '',
          qItem.explanation || '',
          ...(qItem.options || [])
        ].join(' ');

        const { score, matchedField } = calculateScore(qItem.question || '', fullContent, queryLower, queryTokens);
        if (score > 0) {
          hits.push({
            id: qItem.id,
            type: 'question',
            title: qItem.question || 'Тестове питання',
            subtitle: `Тестування • ${qItem.department || 'Загальний'}`,
            snippet: extractSnippet(qItem.explanation || fullContent, queryTokens),
            matchedField,
            department: qItem.department,
            sectionId: qItem.sectionId,
            courseId: qItem.courseId,
            score: score - 5 // slight prioritization for instructions
          });
        }
      }
    }

    // 3. Search Practical Cases
    if (type === 'all' || type === 'case') {
      const caseQuery: any = { isActive: { $ne: false } };
      const cases = await Case.find(caseQuery).lean();

      for (const cItem of cases as any[]) {
        const fullContent = [
          cItem.scenario || '',
          ...(cItem.options?.map((o: any) => `${o.text} ${o.feedback || ''}`) || [])
        ].join(' ');

        const { score, matchedField } = calculateScore(cItem.title || '', fullContent, queryLower, queryTokens);
        if (score > 0) {
          hits.push({
            id: cItem.id,
            type: 'case',
            title: cItem.title || 'Практичний кейс',
            subtitle: 'Симулятор реальних ситуацій',
            snippet: extractSnippet(cItem.scenario || fullContent, queryTokens),
            matchedField,
            sectionId: cItem.sectionId,
            score: score - 5
          });
        }
      }
    }

    // 4. Search Courses
    if (type === 'all' || type === 'course') {
      const courseQuery: any = { isActive: { $ne: false } };
      if (spaceId && spaceId !== 'all') {
        courseQuery.spaceId = spaceId;
      }
      const courses = await Course.find(courseQuery).lean();

      for (const crs of courses as any[]) {
        const fullContent = `${crs.title} ${crs.department || ''}`;
        const { score, matchedField } = calculateScore(crs.title || '', fullContent, queryLower, queryTokens);
        if (score > 0) {
          hits.push({
            id: crs.id,
            type: 'course',
            title: crs.title || 'Навчальний курс',
            subtitle: `Програма навчання • ${crs.department || 'Загальний'}`,
            snippet: `Курс включає ${crs.instructionIds?.length || 0} регламентів та ${crs.caseIds?.length || 0} практичних завдань.`,
            matchedField,
            spaceId: crs.spaceId || 'space-general',
            spaceName: spaceMap.get(crs.spaceId || 'space-general') || 'Загальний простір',
            department: crs.department,
            courseId: crs.id,
            version: crs.version || '1.0',
            status: crs.status || 'published',
            score: score + 10 // courses are prominent
          });
        }
      }
    }

    // 5. Search Glossary & STOP rules
    if (type === 'all' || type === 'glossary') {
      for (const termItem of GLOSSARY_ITEMS) {
        if (spaceId && spaceId !== 'all' && termItem.spaceId !== spaceId) {
          continue;
        }

        const fullContent = `${termItem.term} ${termItem.definition} ${termItem.category}`;
        const { score, matchedField } = calculateScore(termItem.term, fullContent, queryLower, queryTokens);

        if (score > 0) {
          hits.push({
            id: termItem.id,
            type: 'glossary',
            title: termItem.term,
            subtitle: `${termItem.category} • База термінів та регламентів`,
            snippet: termItem.definition,
            matchedField,
            spaceId: termItem.spaceId,
            spaceName: spaceMap.get(termItem.spaceId) || 'Загальний простір',
            sectionId: termItem.sectionId,
            score: score + 20 // glossary and stop rules are very helpful
          });
        }
      }
    }

    // Sort by relevance score descending
    hits.sort((a, b) => b.score - a.score);

    // Calculate counts by type
    const counts = {
      all: hits.length,
      instruction: hits.filter(h => h.type === 'instruction').length,
      question: hits.filter(h => h.type === 'question').length,
      case: hits.filter(h => h.type === 'case').length,
      course: hits.filter(h => h.type === 'course').length,
      glossary: hits.filter(h => h.type === 'glossary').length
    };

    const paginatedResults = hits.slice(0, limit);

    return {
      query: cleanQuery,
      total: hits.length,
      counts,
      results: paginatedResults
    };
  }
}
