import React, { useEffect, useState } from 'react';
import { TrendingUp, EyeOff, Clock, SearchX, Loader2 } from 'lucide-react';
import { ContentData } from './types';

export const ContentReport: React.FC = () => {
  const [data, setData] = useState<ContentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v2/analytics/content')
      .then(async r => {
        if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'Немає доступу'); return; }
        setData(await r.json());
      })
      .catch(() => setError('Помилка мережі'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Завантаження...</div>;
  }
  if (error || !data) {
    return <div className="p-6 text-center text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl">{error || 'Немає даних'}</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-600" /> Найпопулярніші статті
        </h3>
        {data.mostViewed.length === 0 ? (
          <p className="text-sm text-slate-400">Ще немає переглядів</p>
        ) : (
          <ul className="space-y-2">
            {data.mostViewed.map(s => (
              <li key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-700 truncate pr-2">{s.title}</span>
                <span className="shrink-0 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">{s.viewsCount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <EyeOff className="w-4 h-4 text-slate-400" /> Без переглядів
        </h3>
        {data.zeroViewed.length === 0 ? (
          <p className="text-sm text-slate-400">Усі статті хоча б раз переглянуто</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {data.zeroViewed.map(s => (
              <li key={s.id} className="text-sm text-slate-700 py-1.5 border-b border-slate-50 last:border-0 truncate">{s.title}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-500" /> Застарілі (не переглядались рецензентом &gt;{data.staleDays} дн)
        </h3>
        {data.stale.length === 0 ? (
          <p className="text-sm text-slate-400">Усі статті переглянуто нещодавно</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {data.stale.map(s => (
              <li key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-700 truncate pr-2">{s.title}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {s.lastReviewedAt ? new Date(s.lastReviewedAt).toLocaleDateString('uk-UA') : 'Ніколи'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <SearchX className="w-4 h-4 text-rose-500" /> Пошукові запити без результатів
        </h3>
        {data.noResultSearches.length === 0 ? (
          <p className="text-sm text-slate-400">Усі запити хоч щось знаходять</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {data.noResultSearches.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-700 truncate pr-2">«{s.query}»</span>
                <span className="shrink-0 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-xs">{s.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
