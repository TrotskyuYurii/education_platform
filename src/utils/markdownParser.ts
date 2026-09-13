import { InstructionSection, QuizQuestion, RoleFilter } from '../types';

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
 * Користувач може скопіювати цей промпт разом зі своїм регламентом та отримати готовий .md файл.
 */
export const AI_PROMPT_GUIDE = `ВИКОРИСТОВУЙ ЦЕЙ ПРОМПТ ДЛЯ ІНШИХ МОДЕЛЕЙ ШІ (ChatGPT, Claude, Gemini, DeepSeek):
-------------------------------------------------------------------------
Ти — провідний експерт з корпоративного навчання, регламентів бізнес-процесів та укладання професійних тестів.
Твоє завдання: перенести додану робочу інструкцію/регламент компанії у цей додаток У ТОМУ САМОМУ ВИГЛЯДІ (повний текст, розділи, таблиці, малюнки/скріншоти), забезпечити співробітнику зручне повноцінне читання та ознайомлення, а в кінці вивести контрольні блоки та тестові питання для квіз-опитування.

Формат результату — єдиний самодостатній файл Markdown (.md) суворо за такою структурою:

# Назва інструкції: [Повна назва інструкції або регламенту]
**Підзаголовок:** [Коротке роз'яснення для кого і в яких ситуаціях застосовується]
**Підрозділ:** [Назва підрозділу, наприклад: Відділ роздрібного продажу / Казначейство / Бухгалтерія / Склад]
**Суть:** [1-2 речення з головною суттю регламенту — що потрібно знати в першу чергу]
**Роль:** [Одне зі значень: all | cashier | manager | accountant]
**Першоджерело:** [Номер наказу, регламенту або номер сторінки, наприклад: Стор. 1–4, Регламент №12]
**Час читання:** [Орієнтовний час вивчення, наприклад: 5 хв]

### ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ
[Встав сюди ПОВНИЙ оригінальний текст регламенту без скорочень!
Зберігай усю початкову структуру, заголовки, параграфи, виноски, примітки та описи.
Якщо в тексті є ілюстрації, схеми або скріншоти вікон програми, вбудовуй їх безпосередньо у відповідні місця тексту за допомогою Base64 коду:
![Підпис до зображення](data:image/png;base64,...)
Не замінюй малюнки посиланнями на зовнішні сайти, вони мають бути всередині файлу!]

### ПОКРОКОВИЙ ПОРЯДОК ДІЙ
[Якщо регламент містить послідовність операцій, розпиши їх покроково:]
#### Крок 1: [Коротка назва дії]
[Детальний опис дій співробітника в інтерфейсі програми чи на робочому місці]
![Скріншот до кроку](data:image/png;base64,...)
💡 Підказка: [Корисна порада для прискорення роботи або запобігання помилкам]
⚠️ Увага: [Попередження про критичні нюанси]

#### Крок 2: [Наступна дія]
[Опис кроку 2]

---
В КІНЦІ ОСНОВНОЇ ІНСТРУКЦІЇ ОБОВ'ЯЗКОВО СФОРМУЙ 3 АНАЛІТИЧНІ БЛОКИ ТА СИСТЕМНІ ДІЇ:

### ОСНОВНІ ВИСНОВКИ
- [Ключовий висновок 1 — головне правило, яке працівник повинен запам'ятати]
- [Ключовий висновок 2]
- [Ключовий висновок 3]

### КЛЮЧОВІ ПОЛЯ ТА РЕКВІЗИТИ
- [Обов'язкове поле/реквізит 1: наприклад, «Статус чека — тільки "Пробитий"»]
- [Обов'язкове поле/реквізит 2: наприклад, «Номер первинного фіскального чека»]
- [Обов'язкове поле/реквізит 3: наприклад, «Заява покупця з паспортними даними при сумі > 100 грн»]

### СТОП-СПИСКИ
- [Критична заборона 1: Категорично заборонено видавати готівку, якщо покупка була оплачена карткою!]
- [Критична заборона 2: Заборонено проводити повернення без заяви покупця при сумі понад 100 грн!]
- [Критична заборона 3: Дія, яка тягне за собою збій, штраф чи скаргу клієнта]

### АВТОМАТИЧНІ ДІЇ СИСТЕМИ
- [Дія 1: Що облікова програма (BAS, CRM, ПРРО) проводить автоматично]
- [Дія 2: Автоматичні бухгалтерські, касові чи складські рухи]

### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ
| Ситуація / Умова | Дія співробітника | Відповідальна особа | Термін |
| --- | --- | --- | --- |
| [Умова 1] | [Дія 1] | [Посада] | [Термін] |
| [Умова 2] | [Дія 2] | [Посада] | [Термін] |

---
БЛОК ПИТАНЬ ДЛЯ КВІЗ-ОПИТУ (ТЕСТУВАННЯ):

### ПИТАННЯ: [Текст практичного запитання 1 на основі реальної робочої ситуації?]
**Складність:** [easy | medium | hard]
**Контекст:** [Реальна робоча ситуація клієнта або інцидент, на якому ґрунтується питання]
**Першоджерело:** [Пункт регламенту чи сторінка]
- [ ] [Неправильний варіант відповіді A]
- [x] [ПРАВИЛЬНИЙ варіант відповіді — позначається строго через [x]]
- [ ] [Неправильний варіант відповіді B]
- [ ] [Неправильний варіант відповіді C]
**Пояснення:** [Детальне обґрунтування, чому ця відповідь правильна з посиланням на регламент і логіку системи]

ВИМОГИ ДО ТЕСТОВИХ ПИТАНЬ:
1. Склади від 3 до 6 якісних запитань різної складності (easy, medium, hard).
2. Запитання обов'язково повинні спиратися на текст інструкції, Ключові поля та СТОП-СПИСКИ.
3. Рівно один варіант відповіді має бути позначений як правильний через [x].
4. У відповіді виводь виключно готовий текст Markdown без вступних слів, привітань та сторонніх коментарів.`;

/**
 * Очищує Base64 URL від зайвих пробілів та переносів рядків у середині даних
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

  // 1. Markdown images: ![alt](url) з можливими багаторядковими Base64
  const mdImgRegex = /!\[([\s\S]*?)\]\(\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/[^\s)]+)\s*\)/gi;
  cleaned = cleaned.replace(mdImgRegex, (_, alt, url) => {
    const cleanedUrl = cleanBase64Url(url);
    if (cleanedUrl) {
      images.push({ alt: (alt || '').trim() || 'Скріншот', url: cleanedUrl });
    }
    return '';
  });

  // 2. HTML <img> tags
  const htmlImgRegex = /<img\s+[^>]*src=["']\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/[^"']+)["'][^>]*>/gi;
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
  const tagImgRegex = /\*\*Зображення:\*\*\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/\S+)(?=\s|$|\n)/gi;
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
