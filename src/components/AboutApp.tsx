import React from 'react';
import { 
  Shuffle,
  Users,
  CalendarDays,
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
  Sun,
  Rocket,
  Clock,
  ZoomIn,
  Layers,
  Eye,
  Building2,
  Footprints
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
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Позначки «Новий» і «Оновлено» та дата матеріалу</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  У розділі «Навчальні матеріали» біля кожного курсу та інструкції видно, коли його <strong>додано</strong> або коли востаннє <strong>змінено зміст</strong> (наприклад, «Оновлено 20.09.2026»); наведіть курсор на дату, щоб побачити обидві.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>«Новий»</strong> — матеріал з'явився за останні 14 днів, а ви його ще не вивчили. <strong>«Оновлено»</strong> — за останні 14 днів вийшла нова редакція, опубліковано чернетку або змінено зміст; ця позначка видна й тим, хто матеріал уже прочитав, щоб вони переглянули зміни. Курс вважається оновленим також тоді, коли змінився склад курсу або будь-яка його інструкція. Службові дії — перенесення в теку, вимкнення, правка тестових питань — дату не змінюють.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  Кнопка <strong>«Нові та оновлені»</strong> на бічній панелі каталогу показує лише такі матеріали, а лічильник на ній підказує, скільки їх зараз. Ті самі позначки та дата є й у шапці відкритої інструкції та в переліку інструкцій курсу.
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
                  Доступно лише керівникам. Функції імпорту підтримують два режими: класичне завантаження .md файлу та <strong>пряме ШІ-завантаження документів (.docx, .pdf, .txt)</strong>. У другому випадку можна вибрати одразу кілька документів, і система за допомогою штучного інтелекту Claude сама аналізує кожен файл, структурує регламент, визначає стоп-списки та генерує тести. Усі операції керування матеріалами й користувачами оснащені надійним захистом.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Однакове створення матеріалів.</strong> Курси створюються так само, як кейси та призначення: над списком стоїть кнопка <strong>«Створити курс»</strong>, яка відкриває форму окремим вікном. Раніше форма створення була постійно розгорнута над переліком і відсувала самі курси далеко вниз — тепер перелік видно одразу, а вікно з формою відкривається лише тоді, коли воно потрібне. Це та сама форма, що й при редагуванні: назва, підрозділ, сертифікат і термін його дії, вибір інструкцій з пошуком та фільтром за підрозділом, практичні кейси, послідовне проходження й умови тесту (мінімальний бал, ліміт часу, максимум спроб, кількість питань у спробі). Додався й перемикач <strong>«Курс активний»</strong> — курс можна підготувати заздалегідь і вимкненим, а показати співробітникам пізніше. Помилки збереження виводяться просто у вікні, тож введене не втрачається.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Широкий робочий простір панелі.</strong> Розділ адміністрування використовує всю ширину екрана, тому таблиці призначень, списки користувачів та переліки матеріалів більше не тісняться у вузькій колонці й не потребують горизонтального прокручування. Бічне меню розділів «Матеріали» та «Організація» винесено в окрему панель, яка залишається на місці під час прокручування довгих списків, — перемкнутися на іншу вкладку можна будь-коли, не повертаючись на початок сторінки. Показники, фільтри та форми автоматично перебудовуються під розмір вікна: на широких моніторах вони розкладаються у більшу кількість колонок, а на ноутбуці, планшеті чи телефоні згортаються у зручний вертикальний вигляд. Верхнє меню порталу підсвічує поточний розділ однаково для всіх вкладок — синьою плашкою з білим написом, — тож видно, де ви перебуваєте, незалежно від того, чим відкрили розділ: мишею, клавіатурою чи з іншої сторінки.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Підрозділи: єдиний довідник замість випадкових назв</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Перелік підрозділів ведеться в одному місці — «Адміністрування → Організаційна структура → Підрозділи». Раніше ШІ під час розбору документа сам придумував назву підрозділу для кожної інструкції, і в додатку поступово з'являлися відділи, яких немає в компанії, а один і той самий підрозділ дублювався в кількох написаннях. Тепер завантаження інструкції нових підрозділів <strong>не створює</strong>.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Як тепер обирається підрозділ.</strong> ШІ отримує ваш список підрозділів разом із документом, читає зміст інструкції та обирає той підрозділ, чиї співробітники виконують описані дії. Якщо впевненого збігу немає — інструкція потрапляє до підрозділу <strong>«Всі підрозділи»</strong> і залишається доступною всім, доки ви не перенесете її вручну. Перед збереженням додаток ще раз звіряє назву з довідником: навіть якщо модель напише «Відділ бухгалтерії» замість «Бухгалтерія», матеріал стане на правильне місце, а зовсім невідома назва — до «Всіх підрозділів». Куди саме потрапила кожна інструкція, видно одразу в панелі прогресу ШІ-обробки, а при завантаженні готового .md — у повідомленні про результат.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>«Всі підрозділи» — системний запис.</strong> Він позначений у таблиці міткою «Системний», його не можна перейменувати чи видалити: саме на ньому тримається доступ «бачить усі матеріали» та прив'язка інструкцій без конкретного відділу. Кнопки редагування й видалення для цього рядка приховані, а якщо змінити його спробує щось інше — додаток покаже зрозуміле пояснення замість мовчазної відмови.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Eye className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Швидкий перегляд матеріалу з адміністрування</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  У списках «Інструкції», «Курси» та «Кейси» кожен рядок має кнопку <strong>«Перегляд»</strong>. Вона відкриває матеріал просто поверх списку, тож більше не потрібно виходити з адміністрування до навчальних розділів і потім шукати своє місце в переліку заново. Вікно закривається кнопкою «Закрити», клавішею Esc або кліком поза ним — і ви залишаєтесь там, де були.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Що видно у вікні.</strong> Для інструкції — повний текст зі скріншотами (зображення відкриваються на весь екран), підрозділ, версія, статус, час на вивчення, ключові тези, покрокові дії, таблиці, стоп-правила, а також усі тестові питання із <strong>позначеними правильними відповідями та поясненнями</strong>. Для курсу — умови фінального тесту (прохідний бал, ліміт часу, кількість спроб), перелік усіх інструкцій курсу та прив'язані практичні кейси. Для кейса — опис ситуації, репліка клієнта й усі варіанти дій із зазначенням правильного, зворотним зв'язком та підставою.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Переходи між матеріалами.</strong> З перегляду курсу можна одним кліком відкрити будь-яку його інструкцію чи кейс, а з кейса — інструкцію, до якої він прив'язаний. Повернутися назад допомагає стрілка у верхньому лівому куті вікна. Це саме перегляд для перевірки: тест чи симуляція не запускаються, а прогрес співробітників не змінюється.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <FolderTree className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Теки: матеріали в адмініструванні можна розкладати по папках</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Списки «Інструкції», «Курси» та «Кейси» раніше були одним суцільним переліком: коли матеріалів набирається кількасот, знайти потрібний можна хіба що пошуком, а згрупувати споріднені — ніяк. Тепер у кожному з цих розділів є <strong>теки</strong>, які ви заводите самі й вкладаєте одна в одну (до п'яти рівнів). Кнопка <strong>«Нова тека»</strong> створює теку на верхньому рівні, а значок теки зі знаком «+» у самій теці — вкладену в неї.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Як розкладати матеріали.</strong> Візьміть рядок за смужку-ручку зліва й перетягніть на потрібну теку. Якщо зручніше без миші — поряд з ручкою є значок теки, який відкриває список усіх тек із зазначенням вкладеності: оберіть потрібну, і матеріал переїде туди. Так само перетягуванням переносяться й самі теки разом з усім вмістом. Матеріали, які ще нікуди не розкладені, збираються внизу в блоці <strong>«Поза теками»</strong> — перетягніть рядок туди, щоб прибрати його з теки.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Зручність у роботі.</strong> Теку можна згорнути чи розгорнути кліком, а кнопка «Розгорнути все» / «Згорнути все» керує всім деревом одразу; додаток запам'ятовує, які теки у вас були відкриті. Біля назви теки стоїть лічильник — скільки матеріалів усередині разом з вкладеними теками. Поле пошуку над деревом шукає і за назвою матеріалу, і за назвою теки: знайдене показується прямо в теках, де воно лежить, тож одразу видно, де саме шукати далі.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Безпечно для матеріалів.</strong> Видалення теки <strong>ніколи не видаляє матеріали</strong>: тека зникає, а її вміст — і матеріали, і вкладені теки — піднімається на рівень вище. Теки бачать лише адміністратори: на підрозділи, простори знань, права доступу та на те, що бачить співробітник у навчальних розділах, вони не впливають. Кожен тип матеріалів має власне дерево тек, тож курси й кейси не змішуються в одній папці.
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
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Користувачі — у вигляді таблиці</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  В «Адмініструванні» → «Користувачі» співробітники показані таблицею на всю ширину екрана: ПІБ і email, підрозділ, посада, керівник, ролі, спосіб входу, статус і дата додавання. Так зручно працювати навіть із сотнями й тисячами людей.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Пошук і фільтри:</strong> пошук одразу за ПІБ, email, посадою, керівником чи роллю, а також фільтри за підрозділом (зокрема «Без підрозділу»), роллю та статусом (активні / вимкнені). Над таблицею видно, скільки користувачів знайдено і скільки з них активні. Клік по заголовку колонки сортує за нею, повторний клік — у зворотному порядку. Таблиця поділена на сторінки по 25, 50 або 100 рядків.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Створення та редагування:</strong> кнопка «Створити користувача» над таблицею і клік по рядку відкривають форму окремим вікном — з тими самими полями, що й раніше (ролі, підрозділ, керівник, посада, локація, дата найму, спосіб входу, пароль, доступ до підрозділів та інструкцій). Помилки збереження показуються просто у вікні, тож введене не втрачається.
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
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Автоматичний вихід при бездіяльності</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Якщо порталом не користуються 30 хвилин поспіль, система автоматично завершує сесію — залишений без нагляду комп'ютер не стане відкритим доступом до корпоративних матеріалів. За хвилину до виходу з'являється попередження з таймером: кнопка «Залишитись у системі» продовжує роботу без втрати відкритої сторінки, кнопка «Вийти зараз» завершує сесію одразу. Відлік спільний для всіх відкритих вкладок порталу й обнуляється від будь-якої вашої дії — натискання, введення тексту чи прокручування, тож під час активної роботи вікно не з'являється. Після автоматичного виходу екран входу пояснює причину, і достатньо просто увійти знову.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Footprints className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Журнал дій користувачів</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Портал веде окремий журнал того, як ним користуються: хто і коли увійшов або вийшов (зокрема автоматично через бездіяльність), невдалі спроби входу, переходи між розділами, відкриті навчальні матеріали, пройдені тести й кейси та підписані ознайомлення. Для кожної події видно точний час, браузер і IP-адресу. Переглядати журнал можуть лише користувачі з роллю «Адміністратор» — у меню «Адміністрування» → «Журнал дій»; іншим ролям цей доступ не видається. Події зручно відбирати за періодом (сьогодні, 7 чи 30 днів або власні дати), за конкретним співробітником, за типом дії чи пошуком; клік по імені одразу показує історію лише цієї людини. Кнопка «Вивантажити в Excel» зберігає у файл усі події за обраний період із тими самими фільтрами — з датою й часом, іменем та email співробітника, подією, розділом, описом, IP-адресою та браузером; у файлі одразу ввімкнені фільтри колонок. Старі записи видаляються автоматично.
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
                  Повноформатний перенос інструкцій з вихідного файлу в оригінальному вигляді — зі збереженням таблиць, оформлення та ілюстрацій/скріншотів (скріншоти зберігаються окремими файлами у базі поруч з оригіналом документа, тож вони однакові на всіх серверах і не зникають при оновленні системи). Скріншоти витягуються як із <strong>PDF</strong>, так і з <strong>документів Word (.docx)</strong>, і ставляться саме в тих кроках, де вони стоять в оригіналі. Після імпорту система показує, скільки скріншотів знайдено в документі та скільки з них потрапило в текст інструкції. Наприкінці кожної інструкції автоматично виводяться сфокусовані блоки: «📌 Основні висновки», «📋 Ключові поля та обов'язкові реквізити» та «🚫 СТОП-СПИСКИ (Категорично заборонено!)».
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Пакетна ШІ-обробка документів у фоні</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  У режимі «ШІ-Генерація» тепер можна вибрати не один документ, а цілу пачку — до 25 файлів (.pdf, .docx, .txt) за раз. Система бере їх у роботу самостійно й обробляє по черзі, тому чекати на екрані завантаження не потрібно: одразу після вибору файлів можна перейти в будь-який інший розділ, читати інструкції, проходити тести чи працювати з призначеннями.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Панель прогресу</strong> залишається в нижньому лівому куті екрана на всіх сторінках і показує відсоток готовності, скільки документів уже оброблено із загальної кількості та назву файлу, який опрацьовується просто зараз. Її можна згорнути до невеликої позначки, а якщо розгорнути список файлів — видно результат по кожному: назву створеної інструкції, кількість згенерованих питань і скільки скріншотів потрапило в текст. Готові інструкції з'являються в базі знань одразу, не чекаючи завершення всієї пачки.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Надійність.</strong> Якщо один документ не вдалося розпізнати, обробка решти не зупиняється — проблемний файл позначається поясненням помилки, а всі інші доходять до кінця. Обробку решти файлів можна зупинити кнопкою «Зупинити», а завершену картку — прибрати з екрана.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <ZoomIn className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Перегляд скріншотів на весь екран</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Під час читання інструкції будь-яке зображення можна відкрити у великому вигляді — достатньо натиснути на нього. Скріншот розгортається на весь екран поверх сторінки, де доступні: збільшення та зменшення масштабу (до 400%), переміщення збільшеного зображення мишею, скидання масштабу, завантаження картинки на комп'ютер і копіювання посилання на неї. Закрити перегляд можна кнопкою «✕», клавішею <strong>Esc</strong> або кліком по темному тлу. Для зручності працюють гарячі клавіші: <strong>+</strong> / <strong>−</strong> для масштабу та <strong>0</strong> для повернення до початкового розміру.
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
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Shuffle className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Великий банк питань і щоразу новий тест</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Під час завантаження інструкції ШІ складає не кілька, а <strong>великий банк із 20–30 питань</strong>, що охоплює весь документ: кожен розділ і крок, ключові поля, стоп-списки та автоматичні дії системи, з різною складністю.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Кожна спроба — інша.</strong> Співробітник отримує не весь банк, а невелику випадкову добірку (типово 10 питань). Спершу потрапляють питання, яких людина ще не бачила, добірка рівномірно охоплює всі інструкції курсу та рівні складності, а порядок питань і варіантів відповіді щоразу перемішується. Тож повторне проходження не зводиться до запам'ятовування «третя відповідь — правильна». Перед стартом видно, скільки питань буде в спробі та з якого банку їх добирають.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Редагування питань.</strong> В «Адмініструванні» → «Інструкції» біля кожної інструкції є кнопка <strong>«Питання»</strong> з їхньою кількістю. Вона відкриває редактор банку, де можна змінити текст питання, робочу ситуацію, варіанти відповіді й позначку правильного, пояснення, складність і першоджерело, додати нове питання чи видалити зайве — не чіпаючи тексту самої інструкції. Є пошук і фільтр за складністю, а незаповнені питання підсвічуються ще до збереження.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Догенерація ШІ.</strong> Для інструкцій, завантажених раніше з невеликою кількістю питань, кнопка <strong>«Догенерувати ШІ»</strong> складає 5, 10 або 20 нових питань за текстом інструкції, не повторюючи наявних. Нові питання позначаються як «Нове» і потрапляють у тест лише після того, як ви їх переглянете й натиснете «Зберегти питання».
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

            <div className="p-5 bg-purple-50/60 rounded-xl border border-purple-200/80 flex gap-4 md:col-span-2">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-xs">
                  <Rocket className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <span>Онбординг співробітників</span>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                    Адаптація новачків
                  </span>
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Покроковий маршрут входження людини в компанію: що прочитати, з ким познайомитись, які доступи отримати і в які строки. Замість розрізнених нагадувань новачок бачить один зрозумілий план, а компанія — де саме люди застрягають.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Візуальний редактор схеми:</strong> онбординг збирається на полотні як блок-схема. Кроки перетягуються з палітри, з'єднуються стрілками — і саме стрілки задають порядок: наступний крок відкривається лише тоді, коли всі попередні закриті. Доступні типи кроків: інструкція, курс, тестування, практичний кейс, задача (наприклад «видати ноутбук»), зустріч, електронний підпис, зовнішнє посилання та опитування. Кнопка «Вирівняти» автоматично впорядковує схему зліва направо, а перед публікацією система перевіряє її на замкнені кола та незаповнені кроки.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Каталог онбордінгів:</strong> усі схеми зібрані в одному місці з пошуком, статусами (чернетка / опубліковано / архів) та живою статистикою — скільки людей зараз проходять цей онбординг і скільки вже завершили. Схему можна скопіювати як основу для нової, перевести в архів або видалити.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Призначення:</strong> онбординг ставиться конкретній людині, кільком співробітникам одразу, цілому підрозділу або всім на певній посаді. Ключовий параметр — дата виходу: строки всіх кроків рахуються від неї, тому «на третій день» і «через два тижні» лишаються правильними незалежно від того, коли людина фактично почала. Якщо дату виходу довелося змінити, усі дедлайни перераховуються автоматично.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Етапи адаптації:</strong> кроки групуються у звичні етапи — підготовка до виходу (preboarding), перший день, перший тиждень, 30 / 60 / 90 днів. Співробітник бачить маршрут саме в такому вигляді, а не одним довгим списком.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Наставник та відповідальні за крок:</strong> на онбординг можна призначити наставника (buddy), а окремі кроки закріпити за керівником, HR або IT. Такий крок з'являється в задачах відповідального, а не у списку новачка — людина не чекає на те, що від неї не залежить, і одразу бачить, хто саме має це зробити.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Сповіщення в блоці «Новини»:</strong> призначення онбордінгу, відкриття нового кроку, наближення та порушення строку, поява задачі для наставника і завершення адаптації потрапляють у звичний блок новин і сповіщень, а також в email за налаштуваннями користувача. Про прострочення керівник дізнається окремим сповіщенням.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Автоматичне зарахування кроків:</strong> якщо крок посилається на інструкцію або курс, він закривається сам, щойно людина прочитала матеріал чи склала тест — те саме не доводиться відмічати двічі. Так само крок з електронним підписом закривається після підтвердження ознайомлення.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Автозапуск для нових співробітників:</strong> правила виду «новачок на посаді X у підрозділі Y» ставлять потрібний онбординг автоматично в момент створення облікового запису — HR не треба пам'ятати про це вручну. Якщо підходить кілька правил, спрацьовує те, у якого вищий пріоритет.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Опитування-фідбек:</strong> на 7, 30 і 90 день система просить новачка оцінити адаптацію — загальне враження, зрозумілість задач, підтримку команди та готовність рекомендувати компанію. HR бачить зведення за кожним контрольним днем і коментарі людей.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">
                  <strong>Контроль для керівника та HR:</strong> звіт показує прогрес кожного новачка, прострочення, середній час адаптації та окремий блок «де найчастіше застрягають» — кроки, строк яких минув у найбільшої кількості людей. Звідти можна відкрити маршрут конкретного співробітника, пропустити крок, що втратив сенс, або повернути помилково закритий у роботу.
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
                  активувати таймер зворотного відліку, який автоматично завершує тест, коли час вичерпується (екстремальний режим перевірки рефлексів касира або оператора), а також задати <strong>кількість питань в одній спробі</strong> — стільки питань випадково добирається з банку інструкцій курсу на кожне проходження. Інтерфейс квізу відображає інтерактивний таймер та залишок дозволених спроб.
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
