import React, { useState } from 'react';
import { BookOpen, Check, Copy, FileDown, FileText, Sparkles } from 'lucide-react';
import { TEMPLATE_MD, AI_PROMPT_GUIDE } from '../../utils/markdownParser';

/**
 * Вкладка «Довідка» розділу адміністрування: специфікація розмітки, промпт для
 * моделей ШІ та еталонний файл .md.
 *
 * Винесена з TestManagement з двох причин. По-перше, вона цілком статична і
 * тримає лише два власні прапорці, тож не має приводу перемальовуватись разом
 * з рештою адмінки. По-друге, вона вбудовує в розмітку два великі текстові
 * блоки (TEMPLATE_MD і AI_PROMPT_GUIDE) — окремим модулем вони потрапляють у
 * власний чанк і не важчають головний код адміністрування.
 */
export const AdminHelpTab: React.FC = () => {
  const [helpSubTab, setHelpSubTab] = useState('formatting');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_MD], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_quiz_instructions.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([AI_PROMPT_GUIDE], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai_prompt_instruction_format.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_GUIDE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = AI_PROMPT_GUIDE;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Формат та шаблон для завантаження</h3>
          <p className="text-sm text-slate-500 mt-1">
            Повна специфікація розмітки, промпт для моделей ШІ та еталонний файл .md
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPrompt}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${
              copiedPrompt
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-blue-600" />}
            <span>{copiedPrompt ? 'Скопійовано!' : 'Скопіювати промпт для ШІ'}</span>
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-xs"
          >
            <FileDown className="w-4 h-4" />
            <span>Завантажити шаблон (.md)</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs: Prompt vs Spec vs Template */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setHelpSubTab('prompt')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            helpSubTab === 'prompt'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Промпт для ШІ</span>
        </button>
        <button
          type="button"
          onClick={() => setHelpSubTab('spec')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            helpSubTab === 'spec'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
          <span>Специфікація полів</span>
        </button>
        <button
          type="button"
          onClick={() => setHelpSubTab('template')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            helpSubTab === 'template'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-purple-600" />
          <span>Зразок файлу (.md)</span>
        </button>
      </div>

      {/* Sub-tab 1: AI Prompt Guide */}
      {helpSubTab === 'prompt' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">Як підготувати матеріали через інший ШІ:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Натисніть кнопку <strong>«Скопіювати промпт для ШІ»</strong> нижче або вгорі сторінки.</li>
              <li>Відкрийте <strong>ChatGPT, Claude, Google Gemini або DeepSeek</strong>.</li>
              <li>Вставте скопійований промпт, а після нього прикріпіть або вставте текст вашого вихідного регламенту (з Word, PDF чи наказу).</li>
              <li>Модель ШІ згенерує готовий Markdown-текст. Збережіть його у файл з розширенням <code>.md</code> та імпортуйте у вкладці «Імпорт».</li>
            </ol>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Текст промпту для передачі моделям ШІ:
              </span>
              <button
                onClick={handleDownloadPrompt}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Зберегти як .txt</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner max-h-[480px]">
              {AI_PROMPT_GUIDE}
            </pre>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Field Specification */}
      {helpSubTab === 'spec' && (
        <div className="space-y-6 text-sm text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                1. Метадані інструкції
              </h4>
              <ul className="text-xs space-y-1.5 font-mono text-slate-600">
                <li><code># Назва інструкції: [Назва]</code> — головний заголовок</li>
                <li><code>**Підзаголовок:** [Короткий опис]</code> — тема розділу</li>
                <li><code>**Підрозділ:** [Назва підрозділу]</code> — фільтрація у каталозі</li>
                <li><code>**Суть:** [1-2 речення]</code> — ключовий висновок</li>
                <li><code>**Роль:** all | cashier | manager | accountant</code></li>
                <li><code>**Першоджерело:** [Стор. 1-3, Наказ №4]</code></li>
                <li><code>**Час читання:** [хв, наприклад: 4 хв]</code></li>
              </ul>
            </div>
            
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                2. Зміст та покрокові дії
              </h4>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li><code>### ТЕКСТ РЕГЛАМЕНТУ</code> — ключові вимоги маркованим списком (<code>- пункт</code>).</li>
                <li><code>### ПОКРОКОВИЙ ПОРЯДОК ДІЙ</code> — кроки з заголовками <code>#### Крок 1: Дія</code>, детальним описом, порадами (<code>💡 Підказка:</code>) та застереженнями (<code>⚠️ Увага:</code>).</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-600"></span>
                3. Додавання зображень
              </h4>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li>Зображення зберігаються <b>окремими файлами</b> у теці інструкції (поруч з оригіналом PDF та .md файлом), а Markdown лише посилається на них.</li>
                <li>Формат посилання у тілі кроку (під <code>#### Крок X</code>):<br/> <code>![Опис скріншота](assets/img-001.png)</code></li>
                <li>При автоматичному аналізі PDF платформа сама витягує скріншоти у теку <code>assets/</code> та передає їх перелік моделі ШІ.</li>
                <li>Готуючи .md вручну, називайте файли послідовно (<code>img-001.png</code>, <code>img-002.png</code>) і прикріплюйте їх разом з оригіналом документа.</li>
                <li>Вставки <code>Base64</code> та зовнішні посилання підтримуються для сумісності: під час імпорту система сама перенесе такі зображення у файли.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                4. Таблиці та автоматичні дії
              </h4>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li><code>### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ</code> — звичайна Markdown таблиця (<code>| Колонка 1 | Колонка 2 |</code>).</li>
                <li><code>### АВТОМАТИЧНІ ДІЇ СИСТЕМИ</code> — список дій (<code>- дія</code>), які програма (BAS, CRM) виконує автоматично.</li>
                <li><code>### СТОП-ПРАВИЛА</code> — список критичних заборон (<code>- правило</code>), відображається у червоній рамці уваги.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white md:col-span-2">
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                5. Тестові питання
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ul className="text-xs space-y-1.5 text-slate-600">
                  <li><code>### ПИТАННЯ: [Текст питання?]</code></li>
                  <li><code>**Складність:** easy | medium | hard</code></li>
                  <li><code>**Контекст:** [Робоча ситуація/кейс]</code></li>
                  <li><code>**Першоджерело:** [Посилання на регламент]</code></li>
                </ul>
                <ul className="text-xs space-y-1.5 text-slate-600">
                  <li><code>- [x] Правильна відповідь</code> (рівно одна позначка <code>[x]</code>)</li>
                  <li><code>- [ ] Неправильна відповідь</code></li>
                  <li><code>**Пояснення:** [Чому саме так]</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Template File Preview */}
      {helpSubTab === 'template' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Повний еталонний приклад файлу .md:
            </span>
            <button
              onClick={handleDownloadTemplate}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Завантажити цей приклад (.md)</span>
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner max-h-[500px]">
            {TEMPLATE_MD}
          </pre>
        </div>
      )}
    </div>
  );
};
