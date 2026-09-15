import React from 'react';
import { 
  BookOpen, 
  Award, 
  Briefcase, 
  CheckCircle2, 
  Sparkles, 
  Settings2, 
  ShieldCheck, 
  BrainCircuit, 
  FileText, 
  Megaphone, 
  Bell,
  FolderTree,
  GitBranch,
  ArrowLeft,
  Search,
  CalendarClock,
  Sun
} from 'lucide-react';

interface AboutAppProps {
  onBack?: () => void;
}

export const AboutApp: React.FC<AboutAppProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {onBack && (
        <div className="mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад до навчальних матеріалів</span>
          </button>
        </div>
      )}

      <div className="mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
          Про додаток «Навчальний портал»
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Сучасна корпоративна платформа для адаптації, навчання та перевірки знань співробітників компанії.
        </p>
      </div>

      <div className="space-y-8">
        
        {/* Core Functionality section */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-blue-600" />
            Ключові можливості платформи
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Навчальні курси (Каталог та Конструктор)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Доступ до структурованої бази знань, регламентів та посадових інструкцій. Матеріали відфільтровані за відділами та ролями. Користувачі можуть читати теорію та відстежувати свій прогрес вивчення. Для адміністраторів доступний зручний конструктор курсів зі швидким пошуком інструкцій за назвою та підрозділом, лічильниками матеріалів, надійним редагуванням та безпечним видаленням навчальних програм.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Тестування (Квіз)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Перевірка знань за допомогою інтерактивних тестів. Підтримуються різні формати тестування, розбір робочих кейсів та розширена база зі 100 автентичних висловлювань видатних українських діячів (Шевченка, Франка, Сковороди, Лесі Українки, Стуса, Костенко та інших) для мотивації та підтримки під час відповідей.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Симулятор кейсів</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Практичні тренажери, де співробітник опиняється у реальних робочих ситуаціях. Прийняття рішень має наслідки, дозволяючи відпрацьовувати складні діалоги з клієнтами без ризику для компанії.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Модульний Профіль, Аналітика та Сертифікати</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Оновлена модульна підсистема аналітики та навчального прогресу. Дані розділені на незалежні сутності: опрацьовані регламенти, фіксація кожної спроби тестувань чи кейсів, видані сертифікати та електронні листи ознайомлення.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  Особистий дашборд співробітника містить KPI-показники успішності, графіки середнього балу за підрозділами, кругову діаграму прогресу читання матеріалів, блок виданих сертифікатів (з можливістю перегляду та експорту в PDF) та хронологію тестувань. Для керівників та адміністраторів доступний селектор співробітників з миттєвим пошуком, фільтрами за відділами та сертифікатами, а також можливість анулювання сертифікатів з миттєвим сповіщенням працівника. Доступ до аналітичних звітів чітко розмежований відповідно до зон видимості матриці прав RBAC (self, team, department, all).
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <Bell className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Блок «Новини та сповіщення»</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Інтерактивний віджет на головній сторінці порталу, який тримає співробітників у курсі корпоративних подій. У разі анулювання або зміни статусу сертифікату адміністратором блок автоматично перетворюється на термінове сповіщення із детальним описом причини та кнопкою підтвердження ознайомлення («Зрозуміло»). Також віджет попереджає, коли до завершення строку дії сертифіката залишається менше 30 днів.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Обліковий запис та Профіль</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Зручне підменю користувача в правому кутку, що об'єднує підтвердження з електронним підписом, розділ «Профіль» (статистика та сертифікати) та можливість безпечного виходу з системи.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <Settings2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Налаштування (Адміністрування) та ШІ-Генерація</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Доступно лише керівникам. Функції імпорту підтримують два режими: класичне завантаження .md файлу та <strong>пряме ШІ-завантаження документів (.docx, .pdf, .txt)</strong>. У другому випадку система за допомогою штучного інтелекту Gemini сама аналізує вхідний файл, структурує регламент, визначає стоп-списки та генерує тести. Усі операції керування матеріалами й користувачами оснащені надійним захистом.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Гнучка рольова модель (RBAC) та права</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Платформа містить повноцінну систему керування ролями та дозволами. В панелі адміністрування доступна спеціальна вкладка «Ролі та права» для налаштування прав: перегляд та редагування матеріалів, аналітики, користувачів та оргструктури. Права підтримують 4 рівні видимості (скоупи): лише власні дані (self), підлеглі/команда (team), підрозділ (department) або вся компанія (all). Користувачам можна одночасно призначати декілька ролей (наприклад, Керівник + Контент-менеджер), прив'язувати їх до відділів і призначати безпосереднього керівника.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Корпоративна безпека та Email 2FA</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Вхід здійснюється виключно за корпоративною поштою в домені @viatec.ua та паролем. Додатково діє захист через 8-значний одноразовий код підтвердження, що надсилається на пошту співробітника та діє 5 хвилин.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Оригінальні регламенти та аналітичні СТОП-списки</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Повноформатний перенос інструкцій з вихідного файлу в оригінальному вигляді — зі збереженням таблиць, оформлення та ілюстрацій/скріншотів (включаючи закодовані в Base64). Наприкінці кожної інструкції автоматично виводяться сфокусовані блоки: «📌 Основні висновки», «📋 Ключові поля та обов'язкові реквізити» та «🚫 СТОП-СПИСКИ (Категорично заборонено!)».
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Миттєва перевірка знань за інструкцією</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Паралельно з текстом інструкції система формує базу тестових запитань. Натискання кнопки «Перевірити знання з цієї інструкції» наприкінці читання або на бічній панелі одразу запускає цільове тестування саме за цим регламентом для перевірки засвоєння правил, порядку дій та СТОП-списків. Оновлені ШІ-промпти гарантують автоматичне створення узгоджених питань і стоп-правил під час імпорту.
                </p>
              </div>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <FolderTree className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">База знань: Простори, версії та життєвий цикл (Крок 4)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Корпоративна база знань структурована за принципом адаптивних робочих просторів (Knowledge Spaces): загальні корпоративні стандарти, складська логістика, фінанси та бухгалтерія, IT та безпека систем. Оновлений інтерфейс забезпечує збалансовану викладку карток просторів з бейджами підрозділів, кодами просторів, лічильниками регламентів і курсів та зведеною аналітичною панеллю метрик життєвого циклу.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Версіонування та історія ревізій:</strong> Будь-яке оновлення інструкції фіксує новий знімок версії (v1.0, v1.1 тощо) із зазначенням автора, дати та опису змін. В панелі адміністрування («База знань») доступний детальний журнал ревізій, порівняння та миттєвий відкат до будь-якої збереженої версії.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Життєвий цикл регламентів:</strong> Документи проходять статуси «Чернетка» (Draft), «На рецензії» (In Review), «Опубліковано» (Published) та «Архів» (Archived) під контролем рольових прав (RBAC permissions: <code className="text-xs bg-slate-200 px-1 py-0.5 rounded font-mono">knowledge.space.manage</code>, <code className="text-xs bg-slate-200 px-1 py-0.5 rounded font-mono">knowledge.version.manage</code>).
                </p>
              </div>
            </div>

            <div className="p-5 bg-blue-50/60 rounded-xl border border-blue-200/80 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Search className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span>Глобальний пошук: Omnisearch & Command Palette (Крок 5)</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">
                    ⌘K / Ctrl+K
                  </span>
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Швидкий доступ до будь-якого знання компанії з будь-якого екрана за допомогою гарячої комбінації клавіш <kbd className="px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded shadow-2xs text-slate-800">⌘K</kbd> (або <kbd className="px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded shadow-2xs text-slate-800">Ctrl+K</kbd>) та кнопки пошуку у верхній навігаційній панелі.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Крос-сутностний повнотекстовий пошук:</strong> Система миттєво сканує всі типи навчального контенту: регламенти та інструкції, тестові завдання, симулятори кейсів, навчальні курси, а також базу термінів і суворих СТОП-правил компанії (наприклад, «РМК», «картка», «100 грн», «повернення день у день», «коригування ПДВ»).
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Розумні можливості:</strong> Фільтрація за типами сутностей та Просторами знань (Knowledge Spaces), підсвічування знайдених слів у фрагментах тексту, збереження історії останніх запитів користувача, зручна клавіатурна навігація (<kbd className="px-1 py-0.2 text-[10px] font-mono bg-white border border-slate-300 rounded">↑</kbd><kbd className="px-1 py-0.2 text-[10px] font-mono bg-white border border-slate-300 rounded">↓</kbd> та <kbd className="px-1 py-0.2 text-[10px] font-mono bg-white border border-slate-300 rounded">↵ Enter</kbd>) та прямий безшовний перехід одразу до відповідного регламенту чи тесту.
                </p>
              </div>
            </div>

            <div className="p-5 bg-indigo-50/60 rounded-xl border border-indigo-200/80 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <CalendarClock className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span>Рушій призначень та обов'язкового навчання (Крок 7)</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                    Assignment Engine
                  </span>
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Повнофункціональна система адресного призначення курсів та регламентів окремим співробітникам або цілим підрозділам компанії з чітким контролем строків та пріоритетів.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Керування призначеннями (для керівників):</strong> В адмін-панелі («Призначення») керівники можуть створювати індивідуальні або групові завдання на проходження матеріалів, встановлювати дедлайн (термін здачі), рівень пріоритету (🚨 Терміново, 📌 Обов'язково, 💡 Рекомендовано) та залишати персональні вказівки. Зведена аналітика відображає KPI: кількість призначень, успішно завершені, в процесі та прострочені завдання. Доступна фільтрація, відправка ручних нагадувань у сповіщення працівника та скасування призначень.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Особисті завдання співробітника:</strong> У каталозі навчальних матеріалів для працівника відображається інтерактивний віджет «Мої обов'язкові призначення» з таймером зворотного відліку до дедлайну, статусом прогресу та кнопкою швидкого переходу («Розпочати» / «Продовжити»).
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Автоматична синхронізація виконання:</strong> Як тільки працівник дочитує призначену інструкцію або успішно складає тестування за призначеним курсом, система автоматично переводить статус призначення у «Виконано» (completed), фіксує точний час завершення та отриманий бал без необхідності ручного підтвердження адміністратором.
                </p>
              </div>
            </div>

            <div className="p-5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span>Курси-кроки та розширений рушій квізів (Крок 8)</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    Progressive Learning
                  </span>
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Система пропонує розширені можливості контролю навчання, перетворюючи звичайні курси на послідовні навчальні програми зі строгими правилами атестації.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Послідовне проходження (Курси-кроки):</strong> Керівники можуть активувати режим прогресивного вивчення. У цьому режимі кожен наступний урок (інструкція) у курсі автоматично блокується замком (🔒), поки співробітник не підтвердить ознайомлення з попереднім кроком. Це гарантує, що працівники не будуть «перестрибувати» через важливу інформацію і дотримуватимуться методології вивчення матеріалу.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Розширений контроль тестування:</strong> Для кожного курсу тепер можна індивідуально налаштувати суворі параметри перевірки знань: 
                  встановлювати мінімальний прохідний відсоток (напр., 85% або 100%), 
                  обмежувати максимальну кількість спроб здачі (напр., лише 2 спроби для запобігання підбору відповідей), 
                  а також активувати таймер зворотного відліку, який автоматично завершує тест, коли час вичерпується (екстремальний режим перевірки рефлексів касира або оператора). Інтерфейс квізу відображає інтерактивний таймер та залишок дозволених спроб.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Керування курсами та регламентами:</strong> Зручний конструктор курсів дозволяє створювати навчальні траєкторії, вибираючи з повного переліку доступних інструкцій та регламентів із пошуком за назвою. Створені курси можна в будь-який момент редагувати або безпечно видаляти з підтвердженням дії без втрати первинних регламентів.
                </p>
              </div>
            </div>

            <div className="p-5 bg-amber-50/70 rounded-xl border border-amber-200/80 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-xs">
                  <Sun className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span>Головна сторінка «Мій день» (Крок 9)</span>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                    Персональний хаб
                  </span>
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Нова центральна стартова сторінка платформи, яка персоналізує робочий день кожного співробітника та фокусує на першочергових навчальних пріоритетах.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Адаптивне вітання та Цитата дня:</strong> Вітання співробітника за часом доби (ранок, день, вечір) із зазначенням посади та відділу, поєднане з щоденною надихаючою цитатою з розширеної скарбниці української класики (Шевченко, Сковорода, Франко, Леся Українка, Стус, Костенко тощо).
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Зведені показники дня (KPI-картки):</strong> Чотири ключові індикатори: кількість призначених завдань із бейджами терміновості/прострочення, відсоток опрацювання інструкцій, найкращий бал тестувань та стан корпоративного комплаєнсу (чинність електронного підпису).
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Пріоритетні призначення:</strong> Пряма синхронізація із рушієм завдань (<code className="text-xs bg-slate-200 px-1 py-0.5 rounded font-mono">/api/progress-v2/assignments</code>). Завдання відсортовані за дедлайном із таймером зворотного відліку, бейджами терміновості та кнопкою швидкого запуску.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>«Продовжити навчання» та Чек-лист дій:</strong> Картки курсів та інструкцій, розпочатих працівником, із графічною шкалою прогресу для відновлення вивчення в один клік, а також інтерактивний чек-лист базових кроків (підпис листа ознайомлення, тренувальні кейси та тестування).
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Оновлений Інтерфейс (Enterprise Layout)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Повністю перероблений корпоративний дизайн. Головний екран працює як Дашборд із віджетами, а навчальні матеріали відображаються у зручних компактних списках з панеллю фільтрів. Сторінка читання інструкцій тепер має професійний Split-screen вигляд (навігація з прогресом ліворуч, контент праворуч), що дозволяє легко орієнтуватись у великих курсах.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Security & Tech section */}
        <section className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
              Безпека та Архітектура
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Система працює за моделлю клієнт-серверної архітектури з використанням безпечного JWT (JSON Web Token) механізму авторизації. Усі дані, включаючи інструкції, тестові запитання та прогрес співробітників, надійно зберігаються у хмарній базі даних.
            </p>
            <p className="text-slate-300 leading-relaxed mb-4">
              Для забезпечення додаткової безпеки підтримуються гнучкі варіанти авторизації: як стандартний вхід за допомогою пароля, так і безпечний вхід за допомогою одноразового 8-значного коду (OTP), який надсилається на корпоративний email. Крім того, додано можливість перегляду введеного пароля або коду для зручності.
            </p>
            <p className="text-slate-300 leading-relaxed">
              Доступ до функцій розмежовано на рівні ролей: звичайні користувачі бачать матеріали лише свого відділу, тоді як адміністратори можуть управляти всім контентом порталу через спеціальну панель керування.
            </p>
          </div>
          <div className="absolute top-0 right-0 -mr-16 -mt-16 text-slate-800 opacity-50">
            <FileText className="w-64 h-64" />
          </div>
        </section>

      </div>
    </div>
  );
};
