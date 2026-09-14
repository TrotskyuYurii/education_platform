import fs from 'fs';
let file = fs.readFileSync('src/components/CourseCatalog.tsx', 'utf8');

// Replace the duplicate tail
const toReplace = `})()}
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 mb-1">Новини</h3>
          <p className="text-xs text-slate-500">Події компанії</p>
        </div>`;

file = file.replace(toReplace, '})()}');
fs.writeFileSync('src/components/CourseCatalog.tsx', file);
