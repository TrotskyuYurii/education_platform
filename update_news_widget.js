import fs from 'fs';

let file = fs.readFileSync('src/components/CourseCatalog.tsx', 'utf8');

const newsWidgetRegex = /\{\/\* Placeholder Widget 2: News\/Announcements \*\/\}.*?<\/div>/s;

const replacementWidget = `{/* Placeholder Widget 2: News/Announcements */}
        {(() => {
          const now = new Date();
          const expiringCert = certificates.find(cert => {
            const expires = new Date(cert.expiresAt);
            const diffDays = (expires.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return diffDays > 0 && diffDays <= 30;
          });

          if (expiringCert) {
            return (
              <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500 opacity-5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-rose-900 text-sm leading-tight mb-1">Термін сертифікату спливає</h3>
                    <p className="text-xs text-rose-700 leading-snug">
                      Сертифікат «{expiringCert.courseTitle}» діє до {new Date(expiringCert.expiresAt).toLocaleDateString('uk-UA')}.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative group">
              <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">В розробці</div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Новини</h3>
              <p className="text-xs text-slate-500">Події компанії</p>
            </div>
          );
        })()}`;

file = file.replace(newsWidgetRegex, replacementWidget);

fs.writeFileSync('src/components/CourseCatalog.tsx', file);
