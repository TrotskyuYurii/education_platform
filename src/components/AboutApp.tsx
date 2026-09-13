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
  FileText
} from 'lucide-react';

export const AboutApp: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
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
                <h3 className="font-bold text-slate-900 mb-1">Навчальні курси (Каталог)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Доступ до структурованої бази знань, регламентів та посадових інструкцій. Матеріали відфільтровані за відділами та ролями. Користувачі можуть читати теорію та відстежувати свій прогрес вивчення.
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
                <h3 className="font-bold text-slate-900 mb-1">Аналітика та Сертифікати</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Особистий дашборд співробітника для відстеження успішності. Зручно розташований у меню «Обліковий запис». Містить статистику пройдених курсів, історію результатів тестів та зароблені сертифікати.
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
                  Зручне підменю користувача в правому кутку, що об'єднує персональний профіль з електронним підписом, розділ «Аналітика» та можливість безпечного виходу з системи.
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
                <h3 className="font-bold text-slate-900 mb-1">Налаштування (Адміністрування)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Доступно лише керівникам. Дозволяє масово імпортувати та редагувати навчальні матеріали, керувати базою інструкцій, експортувати окремі курси через підменю «Експорт» (у форматах Markdown або PDF для друку) та відстежувати зміни.
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
                <h3 className="font-bold text-slate-900 mb-1">Інструкції з зображеннями</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Матеріали курсів можуть містити скріншоти та інші графічні матеріали для кращого візуального сприйняття. Ілюстрації безшовно інтегруються безпосередньо у кроки інструкцій.
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
