import fs from 'fs';

let file = fs.readFileSync('src/components/AboutApp.tsx', 'utf8');

const replacement = `<div className="p-5 bg-slate-50 rounded-xl border border-slate-100 flex gap-4">
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
            </div>`;

file = file.replace(
  /(\s*)(<\/div>\s*<\/section>\s*\{\/\* Security & Tech section \*\/})/g,
  `\n            ${replacement}$1$2`
);

fs.writeFileSync('src/components/AboutApp.tsx', file);
