import fs from 'fs';
let file = fs.readFileSync('src/components/QuizRunner.tsx', 'utf8');

const regexToReplace = /<div className=\{`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border \$\{\s*isPassed \s*\? 'bg-emerald-50 text-emerald-600 border-emerald-200' \s*: 'bg-amber-50 text-amber-600 border-amber-200'\s*\}`\}>\s*\{isPassed \? <Award className="w-10 h-10" \/> : <HelpCircle className="w-10 h-10" \/>\}\s*<\/div>/g;

const targetCourseCheck = `
            {(() => {
              const course = targetCourseId ? courses.find(c => c.id === targetCourseId) : null;
              const hasCert = isPassed && course && course.hasCertificate;
              return hasCert ? (
                <div className="mx-auto mb-6 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-100 to-amber-200 border-4 border-white shadow-xl flex items-center justify-center mb-4 relative animate-in zoom-in duration-500">
                    <Trophy className="w-12 h-12 text-amber-600 drop-shadow-sm" />
                    <div className="absolute -right-2 -top-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 max-w-md">
                    🎉 Вітаємо! Сертифікат за курс «{course.title}» успішно додано до вашого профілю.
                  </div>
                </div>
              ) : (
                <div className={\`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 border \${
                  isPassed 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : 'bg-amber-50 text-amber-600 border-amber-200'
                }\`}>
                  {isPassed ? <Award className="w-10 h-10" /> : <HelpCircle className="w-10 h-10" />}
                </div>
              );
            })()}
`;

file = file.replace(regexToReplace, targetCourseCheck);

// Add Trophy to imports
if (!file.includes('Trophy')) {
  file = file.replace('Award,', 'Award, Trophy,');
  file = file.replace('Award }', 'Award, Trophy }');
}

fs.writeFileSync('src/components/QuizRunner.tsx', file);
