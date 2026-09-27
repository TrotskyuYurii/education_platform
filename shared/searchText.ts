/**
 * Текстова основа пошуку в базі знань.
 *
 * Пошук має знаходити матеріал «за змістом», а не лише за точним збігом рядка:
 *  - словоформи: «повернення» / «поверненні» / «повернути» зводяться до однієї основи;
 *  - запит звичайною мовою: службові слова («як», «що», «для»…) не заважають;
 *  - синоніми: «кошти» знаходить «гроші», «покупець» — «клієнт»;
 *  - одруківки: «павернення» все одно знайде «повернення».
 *
 * Модуль чистий (без БД) і використовується як сервером, так і тестами.
 */

/** Нормалізація: регістр, апострофи (’ ʼ ' ` прибираються), ё→е, зайві пробіли. */
export function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[’ʼ'`]/g, '')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Прибирає розмітку Markdown, щоб у фрагментах і в індексі був лише текст:
 * зображення, посилання (лишається підпис), HTML-теги, службові символи.
 */
export function stripMarkdown(value: string): string {
  return (value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*#`_>|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'і', 'й', 'та', 'а', 'але', 'або', 'чи', 'в', 'у', 'на', 'з', 'із', 'зі', 'до', 'від', 'за', 'по', 'про',
  'при', 'для', 'під', 'над', 'через', 'без', 'як', 'що', 'це', 'цей', 'ця', 'ці', 'той', 'не', 'ні',
  'же', 'ж', 'б', 'би', 'якщо', 'коли', 'де', 'куди', 'чому', 'який', 'яка', 'яке', 'які', 'мені',
  'мене', 'я', 'ми', 'ви', 'він', 'вона', 'воно', 'вони', 'треба', 'потрібно', 'можна', 'мож', 'є', 'бути',
  'так', 'вже', 'ще', 'тільки', 'лише', 'саме', 'його', 'її', 'їх', 'свій', 'своє', 'своя', 'свої',
  // найуживаніші російські службові слова — співробітники часто пишуть запити російською
  'и', 'как', 'что', 'это', 'для', 'в', 'на', 'с', 'со', 'к', 'по', 'о', 'об', 'из', 'от', 'не', 'или',
  'если', 'где', 'нужно', 'надо', 'можно', 'мне', 'я'
]);

export const isStopWord = (word: string) => STOP_WORDS.has(word);

/**
 * Закінчення та суфікси, що відкидаються стемером (від довших до коротших).
 * Це «легкий» стемер: він не претендує на лінгвістичну точність, а лише зводить
 * найуживаніші форми до спільної основи. Решту розбіжностей закриває
 * префіксне порівняння основ у пошуковому індексі.
 */
const SUFFIXES = [
  'ування', 'ювання', 'уванні', 'уванням',
  'ення', 'енні', 'енню', 'енням', 'ання', 'анні', 'анню', 'анням', 'іння', 'інні', 'інням',
  'ості', 'ість', 'істю', 'остю', 'остей',
  'ами', 'ями', 'ові', 'еві', 'єві', 'ого', 'ому', 'ими', 'іми', 'ових', 'овий', 'ова', 'ове',
  'ути', 'ати', 'ити', 'іти', 'яти', 'ють', 'ать', 'ять', 'уть', 'ить', 'іть', 'емо', 'ємо', 'имо',
  'ете', 'єте', 'ите', 'ала', 'ало', 'али', 'ила', 'ило', 'или', 'ено', 'ано', 'ене', 'ена',
  'ій', 'ий', 'ої', 'ою', 'ею', 'єю', 'их', 'іх', 'ах', 'ях', 'ом', 'ем', 'єм', 'ів', 'їв', 'ам', 'ям',
  'ім', 'им', 'ти', 'ть', 'ла', 'ло', 'ли',
  'а', 'я', 'у', 'ю', 'і', 'и', 'о', 'е', 'ь', 'ї', 'є'
].sort((a, b) => b.length - a.length);

const MIN_STEM = 3;

/** Основа слова. Короткі слова, числа та латиниця лишаються без змін. */
export function stemWord(word: string): string {
  let w = word;
  if (w.length <= MIN_STEM + 1 || !/^[\p{Script=Cyrillic}]+$/u.test(w)) return w;

  // Зворотні дієслова: «оформлюється» → «оформлюєть»
  if (w.endsWith('ся') || w.endsWith('сь')) {
    if (w.length - 2 > MIN_STEM) w = w.slice(0, -2);
  }

  for (const suffix of SUFFIXES) {
    if (w.endsWith(suffix) && w.length - suffix.length >= MIN_STEM) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  // Кінцевий м'який знак після відкидання закінчення не несе змісту
  if (w.endsWith('ь') && w.length - 1 >= MIN_STEM) w = w.slice(0, -1);
  return w;
}

export interface TextToken {
  /** Нормалізоване слово (нижній регістр, без апострофів) */
  word: string;
  /** Основа слова для порівняння */
  stem: string;
  /** Позиція у вихідному рядку — для фрагментів і підсвічування */
  start: number;
  end: number;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}’ʼ'`-]*/gu;

/** Розбиває текст на слова зі збереженням позицій у вихідному рядку. */
export function tokenize(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  if (!text) return tokens;
  for (const m of text.matchAll(WORD_RE)) {
    // дефіс лише всередині слова: «будь-який», але не «слово-»
    const raw = m[0].replace(/-+$/, '');
    const word = normalizeText(raw);
    if (!word) continue;
    const start = m.index!;
    tokens.push({ word, stem: stemWord(word), start, end: start + raw.length });
  }
  return tokens;
}

/**
 * Групи близьких за змістом слів (синоніми, розмовні й російські варіанти).
 * Кожне слово групи після стемінгу стає «альтернативною» основою для інших.
 */
const SYNONYM_GROUPS: string[][] = [
  ['повернення', 'повернути', 'відшкодування', 'возврат', 'рефанд'],
  ['гроші', 'кошти', 'готівка', 'деньги'],
  ['картка', 'карта', 'безготівковий', 'термінал'],
  ['пдв', 'податок', 'податковий', 'ндс'],
  ['співробітник', 'працівник', 'персонал', 'сотрудник'],
  ['керівник', 'менеджер', 'начальник', 'руководитель'],
  ['клієнт', 'покупець', 'споживач', 'замовник', 'покупатель'],
  ['товар', 'продукція', 'номенклатура'],
  ['помилка', 'збій', 'проблема', 'ошибка'],
  ['інструкція', 'регламент', 'правило', 'порядок', 'инструкция'],
  ['видалити', 'прибрати', 'скасувати', 'удалить'],
  ['створити', 'додати', 'оформити', 'создать'],
  ['замовлення', 'заказ', 'заявка'],
  ['рахунок', 'інвойс', 'счет'],
  ['накладна', 'видаткова', 'накладная'],
  ['зміна', 'смена'],
  ['знижка', 'скидка', 'акція'],
  ['доставка', 'відправлення', 'відвантаження', 'отгрузка'],
  ['пароль', 'доступ', 'логін', 'вхід']
];

const SYNONYM_INDEX: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    const stems = [...new Set(group.map(w => stemWord(normalizeText(w))))];
    for (const s of stems) {
      const others = stems.filter(o => o !== s);
      map.set(s, [...new Set([...(map.get(s) || []), ...others])]);
    }
  }
  return map;
})();

/** Основи синонімів для основи слова (порожньо, якщо групи немає). */
export function synonymStems(stem: string): string[] {
  const direct = SYNONYM_INDEX.get(stem);
  if (direct) return direct;
  // Основа запиту може бути довшою чи коротшою за словникову («повернен» vs «поверн»)
  for (const [key, list] of SYNONYM_INDEX) {
    if (key.length >= 4 && stem.length >= 4 && (stem.startsWith(key) || key.startsWith(stem))) {
      return list;
    }
  }
  return [];
}

export interface QueryTerm {
  /** Слово як його ввів користувач (нормалізоване) */
  word: string;
  stem: string;
  synonyms: string[];
}

/**
 * Розбирає запит на значущі терміни. Службові слова відкидаються, якщо після
 * цього лишається хоч одне слово; повтори зливаються.
 */
export function parseQuery(query: string): QueryTerm[] {
  const tokens = tokenize(query);
  const meaningful = tokens.filter(t => !isStopWord(t.word));
  const source = meaningful.length > 0 ? meaningful : tokens;
  const seen = new Set<string>();
  const terms: QueryTerm[] = [];
  for (const t of source) {
    if (seen.has(t.stem)) continue;
    seen.add(t.stem);
    terms.push({ word: t.word, stem: t.stem, synonyms: synonymStems(t.stem) });
  }
  return terms;
}

/**
 * Відстань Левенштейна з раннім виходом: повертає `max + 1`, щойно
 * стає зрозуміло, що відстань перевищує `max`.
 */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Якість збігу основи з документа з основою запиту (0 — не збіг). */
export const MATCH_WEIGHT = {
  exact: 1,
  prefix: 0.8,
  synonym: 0.6,
  fuzzy: 0.5
} as const;

/**
 * Наскільки основа з документа відповідає основі з запиту:
 * точний збіг, спільний префікс (різні словоформи/набір «на льоту»),
 * або одруківка (1 символ для слів від 5 літер, 2 — від 8).
 */
export function stemMatchWeight(queryStem: string, docStem: string): number {
  if (queryStem === docStem) return MATCH_WEIGHT.exact;
  if (queryStem.length >= 3 && docStem.startsWith(queryStem)) return MATCH_WEIGHT.prefix;
  if (docStem.length >= 4 && queryStem.startsWith(docStem)) return MATCH_WEIGHT.prefix;
  if (queryStem.length >= 5 && queryStem[0] === docStem[0]) {
    const max = queryStem.length >= 8 ? 2 : 1;
    if (boundedLevenshtein(queryStem, docStem, max) <= max) return MATCH_WEIGHT.fuzzy;
  }
  return 0;
}

/** Найкраща якість збігу терміну запиту з основою документа, з урахуванням синонімів. */
export function termMatchWeight(term: QueryTerm, docStem: string): number {
  let best = stemMatchWeight(term.stem, docStem);
  if (best === MATCH_WEIGHT.exact) return best;
  for (const syn of term.synonyms) {
    if (syn === docStem || (syn.length >= 4 && docStem.startsWith(syn))) {
      best = Math.max(best, MATCH_WEIGHT.synonym);
      break;
    }
  }
  return best;
}
