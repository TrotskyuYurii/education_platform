import { InstructionSection, QuizQuestion, RoleFilter } from '../types';

/**
 * Еталонний шаблон Markdown-файлу, що містить усі можливі структурні елементи інструкції та тестів.
 * Цей файл є зразком для інших моделей ШІ (ChatGPT, Claude, Gemini).
 */
export const TEMPLATE_MD = `# Назва інструкції: Повернення товару від клієнта (Сценарій А: День у день)
**Підзаголовок:** Порядок оформлення повернення в РМК при відкритій касовій зміні
**Підрозділ:** Відділ роздрібного продажу
**Суть:** Головне правило: якщо зміну ще не закрито, повернення проводиться безпосередньо в РМК за тим самим чеком без створення окремих складних документів.
**Роль:** cashier
**Першоджерело:** Регламент Р-04/26, стор. 1–3
**Час читання:** 4 хв

### ТЕКСТ РЕГЛАМЕНТУ
- Непродовольчий товар належної якості приймається протягом 14 днів за умови збереження товарного вигляду та упаковки.
- Повертати можна лише чеки зі статусом «Пробитий» поточної касової зміни.
- Позиції, які вже поверталися раніше, автоматично зникають зі списку (подвійне повернення технічно неможливе).
- За одну операцію повертається тільки один чек.
- Форма виплати коштів клієнту має бути строго такою самою, як і форма первинної оплати (готівка — з каси, безготівка — через термінал на ту саму картку).

### ПОКРОКОВИЙ ПОРЯДОК ДІЙ
#### Крок 1: Відкрийте меню повернення в РМК
У робочому місці касира (РМК) натисніть меню: Інше → Повернення. Відкриється вікно з переліком чеків поточної зміни.
💡 Підказка: Ви можете відсканувати штрихкод з фіскального чека покупця для миттєвого пошуку.

#### Крок 2: Оберіть рядки потрібного чека та кількість
Позначте прапорцями товари, які клієнт повертає, та вкажіть точну кількість.
⚠️ Увага: Якщо чек був оплачений карткою або містив акційний набір, програма вимагає повернення всього чека цілком!

#### Крок 3: Перевірте суми та оберіть форму виплати
Натисніть кнопку «Оформити повернення». У вікні розрахунку переконайтеся, що форма виплати відповідає первинній оплаті.

#### Крок 4: Пробийте чек повернення та видайте кошти
Натисніть «Пробити чек». ПРРО надрукує фіскальний чек повернення. Видайте гроші або чек термінала клієнту. Заяву та розрахунковий документ підшийте до касових документів.

### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ
| Ситуація | Необхідний документ | Хто виконує | Термін виконання |
| --- | --- | --- | --- |
| Повернення в день покупки (зміна відкрита) | Чек РМК + Заява | Касир | Негайно |
| Повернення після закриття зміни | Накладна повернення + ВКО | Менеджер + Бухгалтер | До 3 робочих днів |
| Сума повернення перевищує 100 грн | Акт про видачу коштів | Касир + Клієнт | Під час виплати |

### АВТОМАТИЧНІ ДІЇ СИСТЕМИ
- Система автоматично повертає товар на залишок складу/магазину.
- Сума готівки в грошовій скриньці ККМ зменшується на суму виплати.
- Повернення автоматично включається у підсумковий «Звіт про роздрібні продажі» при вечірньому закритті зміни.
- При оплаті карткою програма автоматично формує коригування розрахунків з банком-еквайром.

### СТОП-ПРАВИЛА
- Категорично заборонено видавати готівку, якщо клієнт оплачував покупку банківською карткою!
- Заборонено оформлювати повернення без письмової заяви клієнта, якщо сума перевищує 100 грн або товар був у використанні.
- Заборонено змінювати ціни або знижки в сформованому чеку повернення вручну.

### ПИТАННЯ: Яку форму виплати коштів зобов'язаний застосувати касир, якщо клієнт купував товар карткою?
**Складність:** easy
**Контекст:** Клієнт просить видати повернення готівкою, оскільки він залишив банківську картку вдома.
**Першоджерело:** Стор. 2, Розділ «Вимоги фіскальної дисципліни»
- [ ] Видати готівкою за умови пред'явлення паспорта
- [x] Строго поверненням на ту саму банківську картку через термінал
- [ ] Видати готівкою за погодженням з адміністратором
- [ ] Запропонувати подарунковий сертифікат на еквівалентну суму
**Пояснення:** Законодавство та регламент суворо забороняють змінювати форму виплати: безготівкова оплата повертається виключно на банківську картку через еквайринговий термінал.

### ПИТАННЯ: Що автоматично робить програма BAS УТ при пробитті чека повернення день у день?
**Складність:** medium
**Контекст:** Касир закрив чек повернення і турбується, чи потрібно вручну створювати прибуткову накладну на склад.
**Першоджерело:** Стор. 3, Розділ «Автоматичні рухи системи»
- [ ] Потрібно створити окремий документ «Прибутковий касовий ордер»
- [ ] Потрібно додатково повідомити комірника для ручного оприбуткування
- [x] Автоматично повертає товар на залишок магазину та враховує операцію у вечірньому Z-звіті
- [ ] Відправляє запит на погодження головному бухгалтеру
**Пояснення:** У РМК при пробитті чека повернення система автоматично повертає товарні залишки на баланс магазину і коригує касові підсумки.

### ПИТАННЯ: У якому випадку касир зобов'язаний скласти «Акт про видачу коштів»?
**Складність:** hard
**Контекст:** Оформлення повернення бракованого інструменту вартістю 450 грн.
**Першоджерело:** Регламент Р-04/26, п. 2.4
- [ ] Лише якщо повертається підакцизний товар
- [ ] Лише за прямою вимогою покупця
- [x] Якщо сума коштів, що повертаються клієнту, перевищує 100 грн
- [ ] У будь-якому випадку незалежно від суми чека
**Пояснення:** Згідно з п. 9.4 Порядку застосування РРО/ПРРО, якщо сума видачі коштів перевищує 100 гривень, касир зобов'язаний скласти акт про видачу коштів із підписом покупця.
`;

/**
 * Готовий промпт-інструкція для будь-якої іншої моделі ШІ (ChatGPT, Claude, Gemini, DeepSeek тощо).
 * Користувач може скопіювати цей промпт разом зі своїм регламентом та отримати готовий .md файл.
 */
export const AI_PROMPT_GUIDE = `ВИКОРИСТОВУЙ ЦЕЙ ПРОМПТ ДЛЯ ІНШИХ МОДЕЛЕЙ ШІ (ChatGPT, Claude, Gemini):
-------------------------------------------------------------------------
Ти — провідний експерт з корпоративного навчання, регламентів бізнес-процесів та укладання професійних тестів.
Твоє завдання: взяти доданий текст робочої інструкції/регламенту компанії та перетворити його на структурований Markdown (.md) файл суворо за нижченаведеною специфікацією.

Файл повинен містити дві обов'язкові частини:
1. Повний інтерактивний текст інструкції з усіма блоками (текст, таблиці, зображення).
2. Блок тестових питань для перевірки знань співробітників за цією інструкцією.

ПРАВИЛА ТА СТРУКТУРА СИНТАКСИСУ:
- Зберігай усі скріншоти та картинки з оригінального тексту! Вбудовуй зображення безпосередньо у Markdown файл у форматі Base64 код, використовуючи стандартний синтаксис: \`![Опис зображення](data:image/png;base64,...)\`. Не створюй посилань на зовнішні ресурси, результат має бути одним самодостатнім .md файлом.

# Назва інструкції: [Чітка назва регламенту чи процесу]
**Підзаголовок:** [Коротке роз'яснення для кого і коли застосовується]
**Підрозділ:** [Один із підрозділів, наприклад: Казначейство / Відділ роздрібного продажу / Бухгалтерія / Склад]
**Суть:** [1-2 речення з головною суттю регламенту — що потрібно знати в першу чергу]
**Роль:** [Одне зі значень: all | cashier | manager | accountant]
**Першоджерело:** [Номер наказу, регламенту або номер сторінки, наприклад: Стор. 1–4, Регламент №12]
**Час читання:** [Орієнтовний час вивчення, наприклад: 3 хв]

### ТЕКСТ РЕГЛАМЕНТУ
- [Ключовий пункт правил 1 (оформлюється через тире - )]
- [Ключовий пункт правил 2]
- [Ключовий пункт правил 3]

### ПОКРОКОВИЙ ПОРЯДОК ДІЙ
#### Крок 1: [Коротка дія]
[Детальний опис дій співробітника в інтерфейсі програми чи на робочому місці]
![Опис зображення](data:image/png;base64,...) [Якщо у вихідній інструкції є скріншот для цього кроку, обов'язково встав його сюди у форматі Base64 коду. Не використовуй текстові плейсхолдери чи зовнішні посилання]
💡 Підказка: [Корисна порада для прискорення роботи або запобігання помилкам]
⚠️ Увага: [Попередження про критичні нюанси (необов'язково)]

#### Крок 2: [Наступна дія]
[Опис кроку 2]

### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ
| Ситуація / Умова | Дія співробітника | Відповідальна особа | Термін |
| --- | --- | --- | --- |
| [Умова 1] | [Дія 1] | [Посада] | [Термін] |
| [Умова 2] | [Дія 2] | [Посада] | [Термін] |

### АВТОМАТИЧНІ ДІЇ СИСТЕМИ
- [Що облікова програма (BAS, CRM, ПРРО) проводить автоматично без участі людини]
- [Автоматичні бухгалтерські або складські рухи]

### СТОП-ПРАВИЛА
- [Критична дія 1, яку КАТЕГОРИЧНО заборонено робити (тягне за собою штраф або збій)]
- [Критична дія 2, яку категорично заборонено робити]

### ПИТАННЯ: [Текст практичного запитання 1?]
**Складність:** [easy | medium | hard]
**Контекст:** [Реальна робоча ситуація клієнта або інцидент, на якому ґрунтується питання]
**Першоджерело:** [Пункт регламенту чи сторінка]
- [ ] [Неправильний варіант відповіді A]
- [x] [ПРАВИЛЬНИЙ варіант відповіді — позначається саме [x]]
- [ ] [Неправильний варіант відповіді B]
- [ ] [Неправильний варіант відповіді C]
**Пояснення:** [Детальне обґрунтування, чому ця відповідь правильна з посиланням на регламент і логіку системи]

ВИМОГИ ДО ПИТАНЬ:
- Склади мінімум 3–5 якісних запитань різної складності (easy, medium, hard).
- Питання мають бути практичними (ситуаційними кейсами), а не просто копіпастом сухого тексту.
- Рівно один варіант відповіді має бути позначений як правильний через [x].
- У відповіді виводь виключно готовий текст Markdown без преамбул, привітань та сторонніх коментарів.`;

/**
 * Допоміжна функція парсингу одного блоку інструкції
 */
function parseSingleInstructionBlock(
  block: string,
  blockIdx: number
): { section: InstructionSection; questions: QuizQuestion[] } {
  let title = `Інструкція ${blockIdx + 1}`;
  let subtitle = 'Регламент та вимоги';
  let department = 'Всі підрозділи';
  let summary = '';
  let role: RoleFilter = 'all';
  let pageReference = 'Стор. 1';
  let readTimeMin = 3;

  // Title
  const titleMatch = block.match(/^# Назва (?:інструкції|курсу):\s*(.+)$/m);
  if (titleMatch) title = titleMatch[1].trim();

  // Subtitle
  const subMatch = block.match(/^\*\*Підзаголовок:\*\*\s*(.+)$/m);
  if (subMatch) subtitle = subMatch[1].trim();

  // Department
  const deptMatch = block.match(/^\*\*Підрозділ(?: курсу)?:\*\*\s*(.+)$/m);
  if (deptMatch) department = deptMatch[1].trim();

  // Summary
  const summaryMatch = block.match(/^\*\*Суть:\*\*\s*(.+)$/m);
  if (summaryMatch) summary = summaryMatch[1].trim();

  // Role
  const roleMatch = block.match(/^\*\*Роль:\*\*\s*(all|cashier|manager|accountant)/m);
  if (roleMatch) role = roleMatch[1].trim() as RoleFilter;

  // Page Reference / Source
  const pageMatch = block.match(/^\*\*(?:Першоджерело|Сторінка|Посилання):\*\*\s*(.+)$/m);
  if (pageMatch) pageReference = pageMatch[1].trim();

  // Read Time
  const timeMatch = block.match(/^\*\*Час читання:\*\*\s*(\d+)/m);
  if (timeMatch) {
    readTimeMin = parseInt(timeMatch[1], 10) || 3;
  }

  // Key Points (ТЕКСТ РЕГЛАМЕНТУ / КЛЮЧОВІ ВИМОГИ)
  const keyPoints: string[] = [];
  const textRegMatch = block.match(/### (?:ТЕКСТ РЕГЛАМЕНТУ|КЛЮЧОВІ ВИМОГИ(?: ТА ОБМЕЖЕННЯ)?|ВИМОГИ|ОСНОВНІ ПОЛОЖЕННЯ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (textRegMatch) {
    const lines = textRegMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    keyPoints.push(...lines.map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Stop Rules (СТОП-ПРАВИЛА / СТОП-СПИСОК / ЗАБОРОНЕНО)
  const stopRules: string[] = [];
  const stopMatch = block.match(/### (?:СТОП-ПРАВИЛА|СТОП-СПИСОК|ЗАБОРОНЕНО)\n([\s\S]*?)(?=(?:###|$))/i);
  if (stopMatch) {
    const lines = stopMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    stopRules.push(...lines.map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // System Automatic Actions (АВТОМАТИЧНІ ДІЇ СИСТЕМИ / ЩО СИСТЕМА РОБИТЬ САМА)
  const systemAutomaticActions: string[] = [];
  const autoMatch = block.match(/### (?:АВТОМАТИЧНІ ДІЇ СИСТЕМИ|ЩО СИСТЕМА РОБИТЬ САМА|СИСТЕМНІ ДІЇ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (autoMatch) {
    const lines = autoMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    systemAutomaticActions.push(...lines.map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Step-by-step Execution (ПОКРОКОВИЙ ПОРЯДОК ДІЙ / КРОКИ ДІЙ)
  const steps: { number: number; title: string; description: string; tip?: string; warning?: string; imageUrl?: string }[] = [];
  const stepsMatch = block.match(/### (?:ПОКРОКОВИЙ ПОРЯДОК ДІЙ|КРОКИ ДІЙ|ПОРЯДОК ДІЙ|ІНСТРУКЦІЯ ПО КРОКАХ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (stepsMatch) {
    const stepsContent = stepsMatch[1];
    // Match #### Крок N: Заголовок
    const stepBlocks = stepsContent.split(/(?=^####\s+Крок\s+\d+:|^####\s+\d+\.)/m).filter(s => s.trim().length > 0);
    
    stepBlocks.forEach((sBlock, idx) => {
      const headerMatch = sBlock.match(/^####\s+(?:Крок\s+)?(\d+)[:.]\s*(.+)$/m);
      const stepNum = headerMatch ? parseInt(headerMatch[1], 10) : idx + 1;
      const stepTitle = headerMatch ? headerMatch[2].trim() : `Крок ${idx + 1}`;

      // Extract body lines (exclude header, tips, warnings)
      const lines = sBlock.split('\n');
      const descLines: string[] = [];
      let tip: string | undefined;
      let warning: string | undefined;
      let imageUrl: string | undefined;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('💡') || /^\*\*Підказка:\*\*/i.test(line)) {
          tip = line.replace(/^💡\s*(?:Підказка:\s*)?/, '').replace(/^\*\*Підказка:\*\*\s*/i, '').trim();
        } else if (line.startsWith('⚠️') || /^\*\*Увага:\*\*/i.test(line)) {
          warning = line.replace(/^⚠️\s*(?:Увага:\s*)?/, '').replace(/^\*\*Увага:\*\*\s*/i, '').trim();
        } else if (line.match(/^\*\*Зображення:\*\*\s*(.+)/i)) {
          imageUrl = line.match(/^\*\*Зображення:\*\*\s*(.+)/i)![1].trim();
        } else if (line.match(/^!\[.*?\]\((.*?)\)/)) {
          imageUrl = line.match(/^!\[.*?\]\((.*?)\)/)![1].trim();
        } else {
          descLines.push(line);
        }
      }

      steps.push({
        number: stepNum,
        title: stepTitle,
        description: descLines.join(' '),
        tip,
        warning,
        imageUrl
      });
    });
  }

  // Table Data (ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ / ТАБЛИЦЯ)
  let tableData: { headers: string[]; rows: string[][] } | undefined;
  const tableMatch = block.match(/### (?:ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ(?: ТА ВІДПОВІДАЛЬНОСТІ)?|ТАБЛИЦЯ|МАТРИЦЯ ВІДПОВІДАЛЬНОСТІ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (tableMatch) {
    const tableLines = tableMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('|') && l.endsWith('|'));

    if (tableLines.length >= 2) {
      const headers = tableLines[0]
        .split('|')
        .slice(1, -1)
        .map(h => h.trim());

      const rows: string[][] = [];
      // Skip header line (0) and separator line (1, e.g. |---|---|)
      for (let r = 2; r < tableLines.length; r++) {
        const rowLine = tableLines[r];
        // Ensure it's not another separator line
        if (/^\s*\|?\s*[-:]+[-| :]*\|?\s*$/.test(rowLine)) continue;

        const cells = rowLine
          .split('|')
          .slice(1, -1)
          .map(c => c.trim());
        if (cells.length > 0) rows.push(cells);
      }

      if (headers.length > 0 && rows.length > 0) {
        tableData = { headers, rows };
      }
    }
  }

  // Fallback calculation for read time if not explicit
  if (!timeMatch && keyPoints.length > 0) {
    const totalChars = (summary + ' ' + keyPoints.join(' ') + ' ' + steps.map(s => s.description).join(' ')).length;
    readTimeMin = Math.max(1, Math.ceil(totalChars / 400));
  }

  const instructionId = `inst-${Date.now()}-${blockIdx}`;

  const section: InstructionSection = {
    id: instructionId,
    department,
    title,
    subtitle,
    targetRole: role,
    pageReference,
    readTimeMin,
    summary: summary || title,
    keyPoints: keyPoints.length > 0 ? keyPoints : [summary || title],
    steps: steps.length > 0 ? steps : undefined,
    tableData,
    systemAutomaticActions: systemAutomaticActions.length > 0 ? systemAutomaticActions : undefined,
    stopRules: stopRules.length > 0 ? stopRules : undefined
  };

  // Questions
  const questions: QuizQuestion[] = [];
  const questionBlocks = block.split(/(?=### ПИТАННЯ:\s*)/i).filter(b => /^### ПИТАННЯ:/i.test(b.trim()));

  questionBlocks.forEach((qBlock, qIdx) => {
    const qLines = qBlock.split('\n');
    const headerLine = qLines[0] || '';
    const questionText = headerLine.replace(/^### ПИТАННЯ:\s*/i, '').trim();
    if (!questionText) return;

    let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    const diffMatch = qBlock.match(/\*\*Складність:\*\*\s*(easy|medium|hard)/i);
    if (diffMatch) difficulty = diffMatch[1].toLowerCase() as any;

    let context: string | undefined;
    const ctxMatch = qBlock.match(/\*\*Контекст:\*\*\s*(.+)/i);
    if (ctxMatch) context = ctxMatch[1].trim();

    let sourceDocPage = pageReference;
    const srcMatch = qBlock.match(/\*\*(?:Першоджерело|Сторінка):\*\*\s*(.+)/i);
    if (srcMatch) sourceDocPage = srcMatch[1].trim();

    let explanation = '';
    const expMatch = qBlock.match(/\*\*Пояснення:\*\*\s*(.+)/i);
    if (expMatch) explanation = expMatch[1].trim();

    const options: string[] = [];
    let correctIndex = 0;

    const optLines = qBlock.split('\n').filter(l => l.trim().match(/^- \[[ xX]\]/));
    optLines.forEach((optLine, oIdx) => {
      const isCorrect = /^- \[[xX]\]/.test(optLine.trim());
      if (isCorrect) correctIndex = oIdx;
      options.push(optLine.replace(/^- \[[ xX]\]\s*/, '').trim());
    });

    if (options.length > 0) {
      questions.push({
        id: `q-${Date.now()}-${blockIdx}-${qIdx}`,
        sectionId: instructionId,
        department,
        role,
        difficulty,
        question: questionText,
        contextScenario: context,
        options,
        correctIndex,
        explanation: explanation || 'Правильна відповідь згідно з положеннями регламенту.',
        sourceDocPage
      });
    }
  });

  return { section, questions };
}

/**
 * Головний парсер Markdown для імпорту інструкцій та тестів
 */
export const parseMarkdown = (md: string): { sections: InstructionSection[]; questions: QuizQuestion[] } => {
  const sections: InstructionSection[] = [];
  const questions: QuizQuestion[] = [];

  // Підтримка імпорту файлів, що містять як одну, так і декілька інструкцій (# Назва інструкції:)
  const rawBlocks = md.split(/(?=^# Назва (?:інструкції|курсу):)/m).filter(b => b.trim().length > 0);

  if (rawBlocks.length === 0) {
    // Якщо заголовок відсутній, обробляємо весь текст як один блок
    const res = parseSingleInstructionBlock(md, 0);
    sections.push(res.section);
    questions.push(...res.questions);
  } else {
    rawBlocks.forEach((block, idx) => {
      const res = parseSingleInstructionBlock(block, idx);
      sections.push(res.section);
      questions.push(...res.questions);
    });
  }

  return { sections, questions };
};

/**
 * Експорт поточної бази інструкцій та питань у повноцінний Markdown формат
 */
export const exportToMarkdown = (title: string, sections: InstructionSection[], questions: QuizQuestion[]): string => {
  if (sections.length === 0) return '';

  const blocks: string[] = [];

  sections.forEach((sec) => {
    let md = `# Назва інструкції: ${sec.title}\n`;
    if (sec.subtitle) md += `**Підзаголовок:** ${sec.subtitle}\n`;
    md += `**Підрозділ:** ${sec.department || 'Загальний'}\n`;
    md += `**Суть:** ${sec.summary || sec.title}\n`;
    md += `**Роль:** ${sec.targetRole || 'all'}\n`;
    if (sec.pageReference) md += `**Першоджерело:** ${sec.pageReference}\n`;
    if (sec.readTimeMin) md += `**Час читання:** ${sec.readTimeMin} хв\n\n`;

    if (sec.keyPoints && sec.keyPoints.length > 0) {
      md += `### ТЕКСТ РЕГЛАМЕНТУ\n`;
      sec.keyPoints.forEach(kp => (md += `- ${kp}\n`));
      md += `\n`;
    }

    if (sec.steps && sec.steps.length > 0) {
      md += `### ПОКРОКОВИЙ ПОРЯДОК ДІЙ\n`;
      sec.steps.forEach(step => {
        md += `#### Крок ${step.number}: ${step.title}\n`;
        md += `${step.description}\n`;
        if (step.tip) md += `💡 Підказка: ${step.tip}\n`;
        if (step.warning) md += `⚠️ Увага: ${step.warning}\n`;
        md += `\n`;
      });
    }

    if (sec.tableData && sec.tableData.headers && sec.tableData.rows) {
      md += `### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ\n`;
      md += `| ${sec.tableData.headers.join(' | ')} |\n`;
      md += `| ${sec.tableData.headers.map(() => '---').join(' | ')} |\n`;
      sec.tableData.rows.forEach(row => {
        md += `| ${row.join(' | ')} |\n`;
      });
      md += `\n`;
    }

    if (sec.systemAutomaticActions && sec.systemAutomaticActions.length > 0) {
      md += `### АВТОМАТИЧНІ ДІЇ СИСТЕМИ\n`;
      sec.systemAutomaticActions.forEach(act => (md += `- ${act}\n`));
      md += `\n`;
    }

    if (sec.stopRules && sec.stopRules.length > 0) {
      md += `### СТОП-ПРАВИЛА\n`;
      sec.stopRules.forEach(sr => (md += `- ${sr}\n`));
      md += `\n`;
    }

    const secQuestions = questions.filter(q => q.sectionId === sec.id);
    secQuestions.forEach(q => {
      md += `### ПИТАННЯ: ${q.question}\n`;
      md += `**Складність:** ${q.difficulty}\n`;
      if (q.contextScenario) md += `**Контекст:** ${q.contextScenario}\n`;
      if (q.sourceDocPage) md += `**Першоджерело:** ${q.sourceDocPage}\n`;

      q.options.forEach((opt, idx) => {
        const isCorrect = idx === q.correctIndex;
        md += `- [${isCorrect ? 'x' : ' '}] ${opt}\n`;
      });
      md += `**Пояснення:** ${q.explanation}\n\n`;
    });

    blocks.push(md.trim());
  });

  return blocks.join('\n\n---\n\n') + '\n';
};
