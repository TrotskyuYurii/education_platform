import fs from 'fs';
let file = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

file = file.replace(
  '<div className="leading-tight">Аналітика</div>',
  '<div className="leading-tight">Профіль / Аналітика</div>'
);

file = file.replace(
  '<div className="text-[11px] text-slate-400 font-normal">Прогрес навчання та статистика</div>',
  '<div className="text-[11px] text-slate-400 font-normal">Прогрес, статистика та сертифікати</div>'
);

file = file.replace(
  '<div className="leading-tight">Мій профіль</div>',
  '<div className="leading-tight">Підтвердження</div>'
);

fs.writeFileSync('src/components/Navbar.tsx', file);
