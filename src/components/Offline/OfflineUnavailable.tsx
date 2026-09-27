import React from 'react';
import { WifiOff, Award, BookOpen } from 'lucide-react';

interface OfflineUnavailableProps {
  /** testing — тест чи кейси; network — розділ, якому потрібні дані з сервера. */
  kind: 'testing' | 'network';
  /** Тест було розпочато до втрати зв'язку — відповіді збережені, можна продовжити пізніше. */
  paused?: boolean;
  onOpenLibrary: () => void;
}

/** Заглушка розділу, який без мережі не працює. */
export const OfflineUnavailable: React.FC<OfflineUnavailableProps> = ({ kind, paused, onOpenLibrary }) => {
  const isTesting = kind === 'testing';
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
          {isTesting ? <Award className="w-7 h-7" /> : <WifiOff className="w-7 h-7" />}
        </div>
        <h2 className="text-lg font-extrabold text-slate-900 mb-2">
          {isTesting ? 'Тестування недоступне офлайн' : 'Розділ потребує підключення'}
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          {isTesting
            ? paused
              ? 'З\'єднання зникло під час проходження. Ваші відповіді збережені на екрані — тест продовжиться, щойно зв\'язок відновиться.'
              : 'Тести й кейси зараховуються лише з підключенням до інтернету, щоб результати були чесними й одразу потрапляли в систему. Поки що можна повторити збережені матеріали.'
            : 'Цей розділ показує актуальні дані з сервера, тож без інтернету він недоступний. Збережені на пристрої матеріали можна вивчати й зараз.'}
        </p>
        <button
          onClick={onOpenLibrary}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm"
        >
          <BookOpen className="w-4 h-4" />
          До збережених матеріалів
        </button>
      </div>
    </div>
  );
};
