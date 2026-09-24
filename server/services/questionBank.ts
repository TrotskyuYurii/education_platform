/**
 * Банк тестових питань інструкції: перевірка питань, які адмін зберігає з
 * редактора, та текст інструкції, на основі якого ШІ догенеровує нові.
 */

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export class QuestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionValidationError';
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Приводить питання з редактора до вигляду, придатного для запису: прибирає
 * порожні варіанти, перераховує індекс правильної відповіді й підставляє
 * підрозділ і роль самої інструкції. Кидає помилку з номером питання, щоб
 * адмін одразу бачив, що виправити.
 */
export function normalizeQuestions(
  input: unknown,
  section: { id: string; department?: string; targetRole?: string; pageReference?: string }
): any[] {
  if (!Array.isArray(input)) throw new QuestionValidationError('Очікується перелік питань.');

  const usedIds = new Set<string>();
  const stamp = Date.now();

  return input.map((raw: any, idx) => {
    const n = idx + 1;
    const question = text(raw?.question);
    if (!question) throw new QuestionValidationError(`Питання №${n}: не заповнено текст питання.`);

    const rawOptions: unknown[] = Array.isArray(raw?.options) ? raw.options : [];
    const correctRaw = Number.isInteger(raw?.correctIndex) ? raw.correctIndex : -1;
    const options: string[] = [];
    let correctIndex = -1;
    rawOptions.forEach((opt, optIdx) => {
      const value = text(opt);
      if (!value) return;
      if (optIdx === correctRaw) correctIndex = options.length;
      options.push(value);
    });

    if (options.length < 2) throw new QuestionValidationError(`Питання №${n}: потрібно щонайменше два варіанти відповіді.`);
    if (correctIndex < 0) throw new QuestionValidationError(`Питання №${n}: позначте правильний варіант відповіді.`);
    if (new Set(options.map(o => o.toLowerCase())).size !== options.length) {
      throw new QuestionValidationError(`Питання №${n}: варіанти відповіді не повинні повторюватися.`);
    }

    let id = text(raw?.id);
    if (!id || usedIds.has(id)) id = `q-${stamp}-${idx}-${Math.random().toString(36).slice(2, 8)}`;
    usedIds.add(id);

    const difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : 'medium';

    return {
      id,
      sectionId: section.id,
      department: section.department || '',
      role: section.targetRole || 'all',
      difficulty,
      question,
      contextScenario: text(raw?.contextScenario) || undefined,
      options,
      correctIndex,
      explanation: text(raw?.explanation) || 'Правильна відповідь згідно з положеннями регламенту.',
      sourceDocPage: text(raw?.sourceDocPage) || section.pageReference || ''
    };
  });
}

const bullets = (title: string, items?: string[]) =>
  items && items.length > 0 ? `### ${title}\n${items.map(i => `- ${i}`).join('\n')}` : '';

/**
 * Текст інструкції для моделі. Беремо збережений Markdown документа без
 * блоку питань, а для старих інструкцій без нього — збираємо з полів розділу.
 */
export function buildSectionMarkdownForAi(section: any): string {
  const raw = text(section?.rawMarkdown);
  if (raw) {
    const withoutQuestions = raw.split(/^### ПИТАННЯ:/m)[0];
    return withoutQuestions.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  }

  const parts: string[] = [`# ${section?.title || 'Інструкція'}`];
  if (section?.summary) parts.push(`**Суть:** ${section.summary}`);
  if (section?.contentMarkdown) parts.push(section.contentMarkdown.replace(/!\[[^\]]*\]\([^)]*\)/g, ''));
  if (Array.isArray(section?.steps) && section.steps.length > 0) {
    parts.push('### ПОКРОКОВИЙ ПОРЯДОК ДІЙ\n' + section.steps.map((s: any) => [
      `#### Крок ${s.number}: ${s.title}`,
      s.description,
      s.tip ? `Підказка: ${s.tip}` : '',
      s.warning ? `Увага: ${s.warning}` : ''
    ].filter(Boolean).join('\n')).join('\n\n'));
  }
  parts.push(
    bullets('ОСНОВНІ ВИСНОВКИ', section?.keyPoints),
    bullets('КЛЮЧОВІ ПОЛЯ ТА РЕКВІЗИТИ', section?.keyFields),
    bullets('СТОП-СПИСКИ', section?.stopRules),
    bullets('АВТОМАТИЧНІ ДІЇ СИСТЕМИ', section?.systemAutomaticActions)
  );
  const table = section?.tableData;
  if (table?.headers?.length && table?.rows?.length) {
    parts.push([
      '### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ',
      `| ${table.headers.join(' | ')} |`,
      `| ${table.headers.map(() => '---').join(' | ')} |`,
      ...table.rows.map((r: string[]) => `| ${r.join(' | ')} |`)
    ].join('\n'));
  }
  return parts.filter(Boolean).join('\n\n').trim();
}
