import { InstructionSection, QuizQuestion, RoleFilter } from '../types';
import { isYouTubeUrl } from '../../shared/youtube';

/**
 * Еталонний шаблон Markdown-файлу, що містить усі можливі структурні елементи інструкції та тестів.
 * Цей файл є зразком для інших моделей ШІ (ChatGPT, Claude, Gemini, DeepSeek).
 */
export const TEMPLATE_MD = `# Назва інструкції: Повернення товару від клієнта (Сценарій А: День у день)
**Підзаголовок:** Порядок оформлення повернення в РМК при відкритій касовій зміні
**Підрозділ:** Відділ роздрібного продажу
**Суть:** Головне правило: якщо зміну ще не закрито, повернення проводиться безпосередньо в РМК за тим самим чеком без створення окремих складних документів.
**Роль:** cashier
**Першоджерело:** Регламент Р-04/26, стор. 1–3
**Час читання:** 4 хв

### ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ
Ця інструкція визначає єдиний порядок приймання повернень від роздрібних покупців у торговельних залах мережі.

Повернення непродовольчих товарів належної якості можливе протягом 14 календарних днів з моменту придбання (не враховуючи дня покупки), за умови що товар не був у вжитку, збережено його товарний вигляд, споживчі властивості, пломби, ярлики та оригінальну непошкоджену упаковку.

При проведенні операції касир зобов'язаний ідентифікувати оригінальний фіскальний чек у системі BAS УТ. Подвійне повернення товару за одним і тим самим фіскальним чеком технічно виключене алгоритмами системи.

Форма виплати коштів покупцеві повинна суворо відповідати формі первинної оплати. Зміна форми виплати (наприклад, видача готівки при оплаті банківською карткою) є грубим порушенням фінансової дисципліни.

### ПОКРОКОВИЙ ПОРЯДОК ДІЙ
#### Крок 1: Відкрийте меню повернення в РМК
У робочому місці касира (РМК) натисніть меню: Інше → Повернення. Відкриється вікно з переліком чеків поточної зміни.
![Меню «Інше → Повернення» у робочому місці касира](assets/img-001.png)
💡 Підказка: Ви можете відсканувати штрихкод з фіскального чека покупця для миттєвого пошуку.

#### Крок 2: Оберіть рядки потрібного чека та кількість
Позначте прапорцями товари, які клієнт повертає, та вкажіть точну кількість.
⚠️ Увага: Якщо чек був оплачений карткою або містив акційний набір, програма вимагає повернення всього чека цілком!

#### Крок 3: Перевірте суми та оберіть форму виплати
Натисніть кнопку «Оформити повернення». У вікні розрахунку переконайтеся, що форма виплати відповідає первинній оплаті.

#### Крок 4: Пробийте чек повернення та видайте кошти
Натисніть «Пробити чек». ПРРО надрукує фіскальний чек повернення. Видайте гроші або чек термінала клієнту. Заяву та розрахунковий документ підшийте до касових документів.

### ОСНОВНІ ВИСНОВКИ
- Непродовольчий товар належної якості приймається протягом 14 днів за умови збереження товарного вигляду та упаковки.
- Повертати можна лише чеки зі статусом «Пробитий» поточної касової зміни.
- Позиції, які вже поверталися раніше, автоматично блокуються системою від повторного списання.
- За одну операцію в РМК повертається тільки один чек.
- Форма виплати коштів клієнту має бути строго такою самою, як і форма первинної оплати.

### КЛЮЧОВІ ПОЛЯ ТА РЕКВІЗИТИ
- Статус первинного чека: тільки «Пробитий» у відкритій зміні.
- Номер та фіскальний номер первинного розрахункового документа.
- Форма оплати: «Готівка» або «Безготівковий розрахунок / Еквайринг».
- Заява покупця та розрахунковий документ (при сумі повернення понад 100 грн).
- Акт про видачу коштів із підписом покупця та касира.

### СТОП-СПИСКИ
- Категорично заборонено видавати готівку, якщо клієнт оплачував покупку банківською карткою!
- Заборонено оформлювати повернення без письмової заяви клієнта, якщо сума перевищує 100 грн або товар був у використанні.
- Заборонено змінювати ціни або знижки в сформованому чеку повернення вручну.
- Заборонено проводити повернення після закриття касової зміни через інтерфейс РМК (потрібно оформляти через бухгалтерію).

### АВТОМАТИЧНІ ДІЇ СИСТЕМИ
- Система автоматично повертає товар на залишок складу/магазину.
- Сума готівки в грошовій скриньці ККМ зменшується на суму виплати.
- Повернення автоматично включається у підсумковий «Звіт про роздрібні продажі» при вечірньому закритті зміни.
- При оплаті карткою програма автоматично формує коригування розрахунків з банком-еквайром.

### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ
| Ситуація | Необхідний документ | Хто виконує | Термін виконання |
| --- | --- | --- | --- |
| Повернення в день покупки (зміна відкрита) | Чек РМК + Заява | Касир | Негайно |
| Повернення після закриття зміни | Накладна повернення + ВКО | Менеджер + Бухгалтер | До 3 робочих днів |
| Сума повернення перевищує 100 грн | Акт про видачу коштів | Касир + Клієнт | Під час виплати |

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
 * Текст промпту спільний із серверним аналізом документа — див. shared/instructionPrompt.ts,
 * щоб правила (зокрема заборона Base64 та формат посилань assets/...) не розходилися.
 */
export { buildAiPromptGuide } from '../../shared/instructionPrompt';

/**
 * Нормалізує посилання на зображення.
 *
 * Основний формат платформи — посилання на файл, що лежить у теці документа:
 * відносний `assets/img-001.png` (у .md файлі) або абсолютний
 * `/api/sections/<id>/assets/v1/img-001.png` (у контенті, який рендерить фронтенд).
 * Base64 лишається підтриманим лише для сумісності зі старими інструкціями —
 * під час імпорту сервер виносить такі вставки в окремі файли.
 */
export function cleanBase64Url(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      const header = trimmed.slice(0, commaIdx + 1);
      const payload = trimmed.slice(commaIdx + 1).replace(/\s+/g, '');
      return header + payload;
    }
  }
  return trimmed;
}

/** Будь-яке посилання на зображення: base64, http(s), абсолютний або відносний шлях до файлу. */
const IMAGE_URL_PATTERN = 'data:image\\/[^;]+;base64,[\\s\\S]*?|https?:\\/\\/[^\\s)"\']+|[./A-Za-z0-9_-][^\\s)"\']*\\.(?:png|jpe?g|webp|gif|svg|bmp)';

export interface ExtractedImage {
  alt: string;
  url: string;
}

/**
 * Знаходить та витягує всі зображення (Markdown, HTML, теги, чистий Base64) з тексту
 */
export function extractImagesFromMarkdown(text: string): { cleanedText: string; images: ExtractedImage[] } {
  if (!text) return { cleanedText: '', images: [] };
  const images: ExtractedImage[] = [];
  let cleaned = text;

  // 1. Markdown images: ![alt](url) — файл, http(s) або (для старих інструкцій) Base64
  const mdImgRegex = new RegExp(`!\\[([\\s\\S]*?)\\]\\(\\s*(${IMAGE_URL_PATTERN})\\s*\\)`, 'gi');
  cleaned = cleaned.replace(mdImgRegex, (whole, alt, url) => {
    // ![Назва](посилання на YouTube) — це відео: лишаємо в тексті, де воно стане плеєром
    if (isYouTubeUrl(url)) return whole;
    const cleanedUrl = cleanBase64Url(url);
    if (cleanedUrl) {
      images.push({ alt: (alt || '').trim() || 'Скріншот', url: cleanedUrl });
    }
    return '';
  });

  // 2. HTML <img> tags
  const htmlImgRegex = new RegExp(`<img\\s+[^>]*src=["']\\s*(${IMAGE_URL_PATTERN})["'][^>]*>`, 'gi');
  cleaned = cleaned.replace(htmlImgRegex, (match, src) => {
    const altMatch = match.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1].trim() : 'Скріншот';
    const cleanedUrl = cleanBase64Url(src);
    if (cleanedUrl) {
      images.push({ alt, url: cleanedUrl });
    }
    return '';
  });

  // 3. Тег **Зображення:** ...
  const tagImgRegex = /\*\*Зображення:\*\*\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/\S+|\S+\.(?:png|jpe?g|webp|gif|svg|bmp))(?=\s|$|\n)/gi;
  cleaned = cleaned.replace(tagImgRegex, (_, url) => {
    const cleanedUrl = cleanBase64Url(url);
    if (cleanedUrl) {
      images.push({ alt: 'Скріншот', url: cleanedUrl });
    }
    return '';
  });

  // 4. Окремий Base64 URL без обгортки (якщо користувач просто вставив data:image)
  const rawBase64Regex = /(data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]{40,})/gi;
  cleaned = cleaned.replace(rawBase64Regex, (rawUrl) => {
    const cleanedUrl = cleanBase64Url(rawUrl);
    if (cleanedUrl) {
      images.push({ alt: 'Скріншот', url: cleanedUrl });
    }
    return '';
  });

  return {
    cleanedText: cleaned.trim(),
    images
  };
}

/**
 * Розбирає блоки «### ПИТАННЯ:» з Markdown. Використовується і під час імпорту
 * інструкції, і коли ШІ догенеровує питання до вже наявної інструкції.
 */
export function parseQuestionBlocks(
  md: string,
  meta: { sectionId: string; department: string; role: RoleFilter; pageReference: string; idPrefix: string }
): QuizQuestion[] {
  const { sectionId, department, role, pageReference, idPrefix } = meta;
  const questions: QuizQuestion[] = [];
  const questionBlocks = md.split(/(?=### ПИТАННЯ:\s*)/i).filter(b => /^### ПИТАННЯ:/i.test(b.trim()));

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
        id: `${idPrefix}-${qIdx}`,
        sectionId,
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

  return questions;
}

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

  const sectionImages: string[] = [];

  // 1. Повний оригінальний текст інструкції (ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ / ОРИГІНАЛЬНИЙ ТЕКСТ)
  let contentMarkdown: string | undefined;
  const fullTextMatch = block.match(/### (?:ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ|ТЕКСТ ІНСТРУКЦІЇ|ОСНОВНИЙ ТЕКСТ|ОРИГІНАЛЬНИЙ ТЕКСТ|ЗМІСТ ІНСТРУКЦІЇ)\n([\s\S]*?)(?=(?:### (?:ПОКРОКОВИЙ|ОСНОВНІ ВИСНОВКИ|КЛЮЧОВІ ВИСНОВКИ|КЛЮЧОВІ ПОЛЯ|СТОП-|АВТОМАТИЧНІ|ТАБЛИЦЯ|ПИТАННЯ:)|$))/i);
  if (fullTextMatch) {
    contentMarkdown = fullTextMatch[1].trim();
    // Витягуємо зображення з повного тексту
    const { images: ftImages } = extractImagesFromMarkdown(contentMarkdown);
    ftImages.forEach(img => {
      if (!sectionImages.includes(img.url)) sectionImages.push(img.url);
    });
  }

  // 2. Основні висновки (ОСНОВНІ ВИСНОВКИ / КЛЮЧОВІ ВИСНОВКИ / ТЕКСТ РЕГЛАМЕНТУ)
  const keyPoints: string[] = [];
  const conclusionsMatch = block.match(/### (?:ОСНОВНІ ВИСНОВКИ|КЛЮЧОВІ ВИСНОВКИ|ВИСНОВКИ|КЛЮЧОВІ ВИМОГИ(?: ТА ОБМЕЖЕННЯ)?|ТЕКСТ РЕГЛАМЕНТУ|ВИМОГИ|ОСНОВНІ ПОЛОЖЕННЯ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (conclusionsMatch) {
    const rawKpText = conclusionsMatch[1];
    const { cleanedText: kpCleaned, images: kpImages } = extractImagesFromMarkdown(rawKpText);
    kpImages.forEach(img => {
      if (!sectionImages.includes(img.url)) sectionImages.push(img.url);
    });

    const lines = kpCleaned.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || (l.trim().length > 0 && !l.trim().startsWith('#')));
    lines.forEach(l => {
      const cleanLine = l.replace(/^[-*]\s*/, '').trim();
      if (cleanLine) keyPoints.push(cleanLine);
    });
  }

  // Якщо повний текст не був виділений окремим заголовком, але є нерозмічений вступний текст перед секціями
  if (!contentMarkdown) {
    // Шукаємо вступний текст між метаданими та першим ### заголовком
    const introMatch = block.match(/(?:\*\*Час читання:[^\n]+\n|\*\*Першоджерело:[^\n]+\n)([\s\S]*?)(?=\n### )/i);
    if (introMatch && introMatch[1].trim().length > 20) {
      contentMarkdown = introMatch[1].trim();
      const { images: introImgs } = extractImagesFromMarkdown(contentMarkdown);
      introImgs.forEach(img => {
        if (!sectionImages.includes(img.url)) sectionImages.push(img.url);
      });
    }
  }

  // 3. Ключові поля та реквізити (КЛЮЧОВІ ПОЛЯ ТА РЕКВІЗИТИ / ОБОВ'ЯЗКОВІ ПОЛЯ)
  const keyFields: string[] = [];
  const keyFieldsMatch = block.match(/### (?:КЛЮЧОВІ ПОЛЯ(?: ТА РЕКВІЗИТИ)?|ОБОВ'ЯЗКОВІ ПОЛЯ|РЕКВІЗИТИ|ПОЛЯ ДЛЯ ПЕРЕВІРКИ|ОБОВ'ЯЗКОВІ РЕКВІЗИТИ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (keyFieldsMatch) {
    const lines = keyFieldsMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || (l.trim().length > 0 && !l.trim().startsWith('#')));
    lines.forEach(l => {
      const cleanLine = l.replace(/^[-*]\s*/, '').trim();
      if (cleanLine) keyFields.push(cleanLine);
    });
  }

  // 4. СТОП-СПИСКИ (СТОП-СПИСКИ / СТОП-СПИСОК / СТОП-ПРАВИЛА / ЗАБОРОНЕНО / КАТЕГОРИЧНО ЗАБОРОНЕНО)
  const stopRules: string[] = [];
  const stopMatch = block.match(/### (?:СТОП-СПИСКИ|СТОП-СПИСОК|СТОП-ПРАВИЛА|ЗАБОРОНЕНО|КАТЕГОРИЧНО ЗАБОРОНЕНО)\n([\s\S]*?)(?=(?:###|$))/i);
  if (stopMatch) {
    const lines = stopMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*') || (l.trim().length > 0 && !l.trim().startsWith('#')));
    stopRules.push(...lines.map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean));
  }

  // System Automatic Actions (АВТОМАТИЧНІ ДІЇ СИСТЕМИ / ЩО СИСТЕМА РОБИТЬ САМА)
  const systemAutomaticActions: string[] = [];
  const autoMatch = block.match(/### (?:АВТОМАТИЧНІ ДІЇ СИСТЕМИ|ЩО СИСТЕМА РОБИТЬ САМА|СИСТЕМНІ ДІЇ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (autoMatch) {
    const lines = autoMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    systemAutomaticActions.push(...lines.map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Step-by-step Execution (ПОКРОКОВИЙ ПОРЯДОК ДІЙ / КРОКИ ДІЙ)
  const steps: { 
    number: number; 
    title: string; 
    description: string; 
    tip?: string; 
    warning?: string; 
    imageUrl?: string;
    images?: string[];
  }[] = [];

  const stepsMatch = block.match(/### (?:ПОКРОКОВИЙ ПОРЯДОК ДІЙ|КРОКИ ДІЙ|ПОРЯДОК ДІЙ|ІНСТРУКЦІЯ ПО КРОКАХ)\n([\s\S]*?)(?=(?:###|$))/i);
  if (stepsMatch) {
    const stepsContent = stepsMatch[1];
    // Match #### Крок N: Заголовок
    const stepBlocks = stepsContent.split(/(?=^####\s+Крок\s+\d+:|^####\s+\d+\.)/m).filter(s => s.trim().length > 0);
    
    stepBlocks.forEach((sBlock, idx) => {
      const headerMatch = sBlock.match(/^####\s+(?:Крок\s+)?(\d+)[:.]\s*(.+)$/m);
      const stepNum = headerMatch ? parseInt(headerMatch[1], 10) : idx + 1;
      const stepTitle = headerMatch ? headerMatch[2].trim() : `Крок ${idx + 1}`;

      // Отримуємо вміст кроку без рядка заголовку
      const contentAfterHeader = sBlock.replace(/^####\s+(?:Крок\s+)?\d+[:.]\s*.+$/m, '');

      let tip: string | undefined;
      let warning: string | undefined;

      const tipMatch = contentAfterHeader.match(/(?:^|\n)(?:💡\s*(?:Підказка:\s*)?|\*\*Підказка:\*\*\s*)(.+?)(?=\n|$)/i);
      if (tipMatch) tip = tipMatch[1].trim();

      const warnMatch = contentAfterHeader.match(/(?:^|\n)(?:⚠️\s*(?:Увага:\s*)?|\*\*Увага:\*\*\s*)(.+?)(?=\n|$)/i);
      if (warnMatch) warning = warnMatch[1].trim();

      // Очищуємо підказки та застереження з тексту
      const bodyWithoutTips = contentAfterHeader
        .replace(/(?:^|\n)(?:💡\s*(?:Підказка:\s*)?|\*\*Підказка:\*\*\s*).+?(?=\n|$)/gi, '')
        .replace(/(?:^|\n)(?:⚠️\s*(?:Увага:\s*)?|\*\*Увага:\*\*\s*).+?(?=\n|$)/gi, '');

      // Надійно витягуємо зображення (підтримуються однорядкові та багаторядкові Base64)
      const { cleanedText, images: stepImgs } = extractImagesFromMarkdown(bodyWithoutTips);

      // Формуємо чистий опис кроку без сирих мегабайтних base64 даних
      const stepDescription = cleanedText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join(' ');

      const imgUrls = stepImgs.map(img => img.url);

      steps.push({
        number: stepNum,
        title: stepTitle,
        description: stepDescription,
        tip,
        warning,
        imageUrl: imgUrls[0],
        images: imgUrls.length > 0 ? imgUrls : undefined
      });
    });
  }

  // Також перевіряємо, чи є взагалі зображення у всій інструкції поза кроками
  // (наприклад, загальні скріншоти форми BAS або оглядові схеми)
  const nonQuestionBlock = block.split(/(?=### ПИТАННЯ:\s*)/i)[0] || block;
  const nonStepsContent = nonQuestionBlock.replace(/### (?:ПОКРОКОВИЙ ПОРЯДОК ДІЙ|КРОКИ ДІЙ|ПОРЯДОК ДІЙ|ІНСТРУКЦІЯ ПО КРОКАХ)[\s\S]*?(?=(?:###|$))/i, '');
  const { images: generalImages } = extractImagesFromMarkdown(nonStepsContent);
  generalImages.forEach(img => {
    if (!sectionImages.includes(img.url)) {
      sectionImages.push(img.url);
    }
  });

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
    contentMarkdown,
    keyPoints: keyPoints.length > 0 ? keyPoints : [summary || title],
    keyFields: keyFields.length > 0 ? keyFields : undefined,
    images: sectionImages.length > 0 ? sectionImages : undefined,
    steps: steps.length > 0 ? steps : undefined,
    tableData,
    systemAutomaticActions: systemAutomaticActions.length > 0 ? systemAutomaticActions : undefined,
    stopRules: stopRules.length > 0 ? stopRules : undefined
  };

  const questions = parseQuestionBlocks(block, {
    sectionId: instructionId,
    department,
    role,
    pageReference,
    idPrefix: `q-${Date.now()}-${blockIdx}`
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

    if (sec.contentMarkdown) {
      md += `### ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ\n`;
      md += `${sec.contentMarkdown.trim()}\n\n`;
    } else if (sec.images && sec.images.length > 0) {
      sec.images.forEach((img, idx) => {
        md += `![Ілюстрація ${idx + 1}](${img})\n\n`;
      });
    }

    if (sec.steps && sec.steps.length > 0) {
      md += `### ПОКРОКОВИЙ ПОРЯДОК ДІЙ\n`;
      sec.steps.forEach(step => {
        md += `#### Крок ${step.number}: ${step.title}\n`;
        md += `${step.description}\n`;
        
        const allStepImgs = step.images && step.images.length > 0
          ? step.images
          : (step.imageUrl ? [step.imageUrl] : []);
        
        allStepImgs.forEach((img, i) => {
          md += `![Скріншот ${i + 1}](${img})\n`;
        });

        if (step.tip) md += `💡 Підказка: ${step.tip}\n`;
        if (step.warning) md += `⚠️ Увага: ${step.warning}\n`;
        md += `\n`;
      });
    }

    if (sec.keyPoints && sec.keyPoints.length > 0) {
      md += `### ОСНОВНІ ВИСНОВКИ\n`;
      sec.keyPoints.forEach(kp => (md += `- ${kp}\n`));
      md += `\n`;
    }

    if (sec.keyFields && sec.keyFields.length > 0) {
      md += `### КЛЮЧОВІ ПОЛЯ ТА РЕКВІЗИТИ\n`;
      sec.keyFields.forEach(kf => (md += `- ${kf}\n`));
      md += `\n`;
    }

    if (sec.stopRules && sec.stopRules.length > 0) {
      md += `### СТОП-СПИСКИ\n`;
      sec.stopRules.forEach(sr => (md += `- ${sr}\n`));
      md += `\n`;
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
