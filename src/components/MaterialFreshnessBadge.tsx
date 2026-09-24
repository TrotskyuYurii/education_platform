import React from 'react';
import { Sparkles, RefreshCw, CalendarDays } from 'lucide-react';
import { FreshnessBadge, MaterialFreshness, formatMaterialDate, FRESH_MATERIAL_DAYS } from '../../shared/materialFreshness';

/** Плашка «Новий» / «Оновлено» поруч із назвою матеріалу. */
export const FreshnessBadgeChip: React.FC<{ badge: FreshnessBadge; size?: 'sm' | 'md' }> = ({ badge, size = 'sm' }) => {
  if (!badge) return null;
  const pad = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';
  return badge === 'new' ? (
    <span
      className={`inline-flex items-center gap-1 ${pad} rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-xs`}
      title={`Додано за останні ${FRESH_MATERIAL_DAYS} днів`}
    >
      <Sparkles className="w-3 h-3" />
      Новий
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 ${pad} rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300`}
      title={`Зміст змінено за останні ${FRESH_MATERIAL_DAYS} днів — варто переглянути`}
    >
      <RefreshCw className="w-3 h-3" />
      Оновлено
    </span>
  );
};

/** «Додано 12.09.2026» або «Оновлено 20.09.2026» — остання подія з матеріалом. */
export const MaterialDateLabel: React.FC<{ freshness: MaterialFreshness; className?: string }> = ({ freshness, className = '' }) => {
  const { addedAt, changedAt } = freshness;
  if (!addedAt && !changedAt) return null;

  const tooltip = [
    addedAt ? `Додано: ${formatMaterialDate(addedAt)}` : null,
    changedAt ? `Останні зміни: ${formatMaterialDate(changedAt)}` : null
  ].filter(Boolean).join(' · ');

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={tooltip}>
      <CalendarDays className="w-3 h-3" />
      {changedAt ? `Оновлено ${formatMaterialDate(changedAt)}` : `Додано ${formatMaterialDate(addedAt!)}`}
    </span>
  );
};
