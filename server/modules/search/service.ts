import { Section, Question, Case, Course, KnowledgeSpace } from '../../models.js';
import { SearchIndex, type IndexHit, type IndexInput } from './searchIndex.js';

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
  /** Слова з тексту, що збіглися із запитом (з урахуванням словоформ і синонімів) */
  highlights?: string[];
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

/** Метадані документа в індексі — з них будується відповідь API */
type HitMeta = Omit<SearchHit, 'snippet' | 'matchedField' | 'score' | 'highlights'> & {
  /** Поправка до оцінки за типом: курси та глосарій корисніші як точка входу */
  boost: number;
  /** Сталий опис замість фрагмента тексту (курс, термін глосарію) */
  fixedSnippet?: string;
};

const INDEX_TTL_MS = 30_000;

let cached: { index: SearchIndex<HitMeta>; builtAt: number } | null = null;
let building: Promise<SearchIndex<HitMeta>> | null = null;

/**
 * Скинути кеш індексу — наступний пошук перечитає базу.
 * Без виклику кеш і так оновлюється щонайменше раз на INDEX_TTL_MS.
 */
export function invalidateSearchIndex() {
  cached = null;
}

async function buildIndex(): Promise<SearchIndex<HitMeta>> {
  // Лише поля, потрібні для пошуку: HTML, файли, скріншоти тощо не тягнемо з БД
  const [spaces, sections, questions, cases, courses] = await Promise.all([
    KnowledgeSpace.find({}).select('id name').lean(),
    Section.find({ isActive: { $ne: false } })
      .select('id title subtitle summary contentMarkdown keyPoints stopRules steps.title steps.description steps.tip steps.warning tableData.rows spaceId department courseId version status')
      .lean(),
    Question.find({}).select('id question contextScenario explanation options department sectionId courseId').lean(),
    Case.find({ isActive: { $ne: false } }).select('id title scenario options.text options.feedback sectionId').lean(),
    Course.find({ isActive: { $ne: false } }).select('id title department instructionIds caseIds spaceId version status').lean()
  ]);

  const spaceMap = new Map<string, string>();
  (spaces as any[]).forEach(s => spaceMap.set(s.id, s.name));
  const spaceName = (id?: string) => spaceMap.get(id || 'space-general') || 'Загальний простір';

  // Контекст: назва інструкції, до якої належить питання чи кейс, —
  // щоб запит за темою знаходив і пов'язані з нею тести та кейси.
  const sectionTitles = new Map<string, string>();
  (sections as any[]).forEach(s => sectionTitles.set(s.id, s.title || ''));

  const inputs: IndexInput<HitMeta>[] = [];

  for (const sec of sections as any[]) {
    inputs.push({
      title: sec.title || '',
      fields: [
        { text: sec.subtitle || '', weight: 2 },
        { text: sec.summary || '', weight: 1.5 },
        { text: [...(sec.keyPoints || []), ...(sec.stopRules || [])].join('. '), weight: 1.5 },
        {
          text: (sec.steps || [])
            .map((st: any) => [st.title, st.description, st.tip, st.warning].filter(Boolean).join('. '))
            .join('. '),
          weight: 1
        },
        { text: sec.contentMarkdown || '', weight: 1 },
        { text: (sec.tableData?.rows || []).flat().join(' '), weight: 0.8 }
      ],
      meta: {
        id: sec.id,
        type: 'instruction',
        title: sec.title || 'Регламент',
        subtitle: sec.subtitle || sec.department,
        spaceId: sec.spaceId || 'space-general',
        spaceName: spaceName(sec.spaceId),
        department: sec.department,
        courseId: sec.courseId,
        sectionId: sec.id,
        version: sec.version || '1.0',
        status: sec.status || 'published',
        boost: 0
      }
    });
  }

  for (const q of questions as any[]) {
    inputs.push({
      title: q.question || '',
      fields: [
        { text: q.explanation || '', weight: 1.2 },
        { text: q.contextScenario || '', weight: 1 },
        { text: (q.options || []).join('. '), weight: 0.8 },
        { text: sectionTitles.get(q.sectionId) || '', weight: 0.4 }
      ],
      meta: {
        id: q.id,
        type: 'question',
        title: q.question || 'Тестове питання',
        subtitle: `Тестування • ${q.department || 'Загальний'}`,
        department: q.department,
        sectionId: q.sectionId,
        courseId: q.courseId,
        boost: -5 // інструкції трохи вище за тестові питання
      }
    });
  }

  for (const c of cases as any[]) {
    inputs.push({
      title: c.title || '',
      fields: [
        { text: c.scenario || '', weight: 1.2 },
        { text: (c.options || []).map((o: any) => `${o.text || ''} ${o.feedback || ''}`).join('. '), weight: 0.8 },
        { text: sectionTitles.get(c.sectionId) || '', weight: 0.4 }
      ],
      meta: {
        id: c.id,
        type: 'case',
        title: c.title || 'Практичний кейс',
        subtitle: 'Симулятор реальних ситуацій',
        sectionId: c.sectionId,
        boost: -5
      }
    });
  }

  for (const crs of courses as any[]) {
    inputs.push({
      title: crs.title || '',
      fields: [
        { text: crs.department || '', weight: 1 },
        // Курс знаходиться і за темами інструкцій, з яких він складається
        { text: (crs.instructionIds || []).map((id: string) => sectionTitles.get(id) || '').join('. '), weight: 0.5 }
      ],
      meta: {
        id: crs.id,
        type: 'course',
        title: crs.title || 'Навчальний курс',
        subtitle: `Програма навчання • ${crs.department || 'Загальний'}`,
        spaceId: crs.spaceId || 'space-general',
        spaceName: spaceName(crs.spaceId),
        department: crs.department,
        courseId: crs.id,
        version: crs.version || '1.0',
        status: crs.status || 'published',
        boost: 10, // курси — зручна точка входу
        fixedSnippet: `Курс включає ${crs.instructionIds?.length || 0} регламентів та ${crs.caseIds?.length || 0} практичних завдань.`
      }
    });
  }

  for (const g of GLOSSARY_ITEMS) {
    inputs.push({
      title: g.term,
      fields: [
        { text: g.definition, weight: 1.5 },
        { text: g.category, weight: 1 }
      ],
      meta: {
        id: g.id,
        type: 'glossary',
        title: g.term,
        subtitle: `${g.category} • База термінів та регламентів`,
        spaceId: g.spaceId,
        spaceName: spaceName(g.spaceId),
        sectionId: g.sectionId,
        boost: 20, // терміни та СТОП-правила дуже корисні
        fixedSnippet: g.definition
      }
    });
  }

  return new SearchIndex(inputs);
}

async function getIndex(): Promise<SearchIndex<HitMeta>> {
  if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) return cached.index;
  if (!building) {
    building = buildIndex()
      .then(index => {
        cached = { index, builtAt: Date.now() };
        return index;
      })
      .finally(() => {
        building = null;
      });
  }
  return building;
}

const EMPTY_COUNTS = { all: 0, instruction: 0, question: 0, case: 0, course: 0, glossary: 0 };

/** Перетворює результати індексу на відповідь API. Винесено окремо для тестів. */
export function toSearchHits(hits: IndexHit<HitMeta>[]): SearchHit[] {
  return hits
    .map(({ meta, score, matchedField, snippet, highlights }) => {
      const { boost, fixedSnippet, ...rest } = meta;
      return { ...rest, snippet: fixedSnippet || snippet, matchedField, highlights, score: score + boost };
    })
    .sort((a, b) => b.score - a.score);
}

export class SearchService {
  /**
   * Пошук по всіх типах контенту: інструкції, питання, кейси, курси, глосарій.
   * Індекс кешується в пам'яті, тож запит не перечитує всю базу щоразу.
   */
  static async search(options: SearchOptions) {
    const { q, spaceId, type = 'all', limit = 30 } = options;
    const cleanQuery = (q || '').trim();
    if (!cleanQuery) {
      return { query: '', total: 0, counts: { ...EMPTY_COUNTS }, results: [] };
    }

    const index = await getIndex();
    const bySpace = spaceId && spaceId !== 'all';

    const results = toSearchHits(
      index.search(cleanQuery, meta => {
        if (!bySpace) return true;
        // Питання та кейси не прив'язані до простору — як і раніше, за ним не фільтруються
        if (meta.type === 'question' || meta.type === 'case') return true;
        return meta.spaceId === spaceId;
      })
    );

    // Лічильники рахуються без фільтра типу — вкладки показують, скільки знайдено в кожній
    const counts = { ...EMPTY_COUNTS, all: results.length };
    for (const r of results) counts[r.type]++;

    const filtered = type === 'all' ? results : results.filter(r => r.type === type);

    return {
      query: cleanQuery,
      total: filtered.length,
      counts,
      results: filtered.slice(0, limit)
    };
  }
}
