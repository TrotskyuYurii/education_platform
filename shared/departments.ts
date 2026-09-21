/**
 * Правила роботи з довідником підрозділів — спільні для сервера та адмінки.
 *
 * Підрозділи веде людина у розділі «Організаційна структура». Завантаження
 * інструкцій новий підрозділ не створює: ШІ отримує наявний перелік і має
 * обрати з нього, а сервер перед записом ще раз звіряє назву з довідником.
 * Якщо впевненого збігу немає, інструкція йде до системного підрозділу
 * «Всі підрозділи», який видно всім співробітникам.
 */

/**
 * Системний підрозділ: створюється під час ініціалізації бази, слугує
 * загальним кошиком для матеріалів без прив'язки і водночас ознакою «бачить
 * усе» для користувача. Тому його не можна ані перейменувати, ані видалити.
 */
export const DEFAULT_DEPARTMENT = 'Всі підрозділи';

/** Загальні слова, які по-різному пишуть в назвах одного й того ж підрозділу. */
const GENERIC_PREFIXES = ['відділ', 'департамент', 'служба', 'сектор', 'управління', 'група', 'дирекція'];

/** Назва без регістру, лапок і зайвої пунктуації — для порівняння, не для показу. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Те саме, але ще й без загального слова на початку: «Відділ продажів» → «продажів». */
function core(value: string): string {
  const normalized = normalize(value);
  for (const prefix of GENERIC_PREFIXES) {
    if (normalized.startsWith(`${prefix} `)) {
      return normalized.slice(prefix.length + 1);
    }
  }
  return normalized;
}

/** Довжина основи слова, за якою порівнюємо різні відмінки. */
const STEM_LENGTH = 5;

/**
 * Груба основа назви: кожне слово обрізається до перших літер.
 *
 * Модель називає підрозділ у тому відмінку, який просився в реченні
 * («Відділ бухгалтерії» замість «Бухгалтерія», «роздрібного продажу» замість
 * «роздрібний продаж»). Повноцінна морфологія тут зайва: досить порівняти
 * початок кожного слова, бо українські відмінки міняють саме закінчення.
 */
function stem(value: string): string {
  return core(value)
    .split(' ')
    .filter(Boolean)
    .map(word => word.slice(0, STEM_LENGTH))
    .join(' ');
}

export function isDefaultDepartment(name?: string | null): boolean {
  return normalize(name || '') === normalize(DEFAULT_DEPARTMENT);
}

/**
 * Приводить назву підрозділу з інструкції до наявної у довіднику.
 *
 * Повертає назву точно в тому написанні, як вона збережена в довіднику, або
 * `DEFAULT_DEPARTMENT`, якщо збігу немає. Це запобіжник на випадок, коли
 * модель попри інструкції вигадала власну назву або переписала наявну іншими
 * словами («Бухгалтерія» ↔ «Відділ бухгалтерії»).
 */
export function resolveDepartmentName(raw: string | undefined | null, known: string[]): string {
  const candidate = (raw || '').trim();
  if (!candidate || isDefaultDepartment(candidate)) return DEFAULT_DEPARTMENT;

  const normalized = normalize(candidate);
  if (!normalized) return DEFAULT_DEPARTMENT;

  const options = known.filter(name => name && name.trim() && !isDefaultDepartment(name));

  for (const name of options) {
    if (normalize(name) === normalized) return name;
  }

  const candidateCore = core(candidate);
  // Коротка назва («IT», «ЗЕД») збігається з чим завгодно, тому часткові
  // збіги для неї не шукаємо — краще системний підрозділ, ніж чужий.
  if (candidateCore.length < 4) return DEFAULT_DEPARTMENT;

  for (const name of options) {
    if (core(name) === candidateCore) return name;
  }

  const candidateStem = stem(candidate);
  for (const name of options) {
    if (stem(name) === candidateStem) return name;
  }

  if (candidateStem.length < STEM_LENGTH) return DEFAULT_DEPARTMENT;

  // Часткові збіги: «Складська логістика та приймання» ↔ «Складська логістика».
  // З кількох кандидатів беремо найближчий за довжиною.
  let best: { name: string; distance: number } | null = null;
  for (const name of options) {
    const nameStem = stem(name);
    if (nameStem.length < STEM_LENGTH) continue;
    if (!nameStem.includes(candidateStem) && !candidateStem.includes(nameStem)) continue;
    const distance = Math.abs(nameStem.length - candidateStem.length);
    if (!best || distance < best.distance) best = { name, distance };
  }

  return best ? best.name : DEFAULT_DEPARTMENT;
}
