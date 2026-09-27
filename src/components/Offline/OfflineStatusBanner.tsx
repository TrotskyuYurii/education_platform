import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Смуга стану з'єднання вгорі екрана. Без мережі нагадує, що доступні лише
 * збережені матеріали, а тестування вимкнене; після повернення зв'язку коротко
 * повідомляє, що прогрес синхронізовано.
 */
export const OfflineStatusBanner: React.FC<{ hasSession?: boolean }> = ({ hasSession = true }) => {
  const isOnline = useOnlineStatus();
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(!isOnline);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowRestored(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setShowRestored(true);
    const t = setTimeout(() => setShowRestored(false), 4000);
    return () => clearTimeout(t);
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div role="status" aria-live="polite" className="bg-amber-500 text-white print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs sm:text-sm font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            <strong className="font-bold">Офлайн-режим.</strong>{' '}
            {hasSession
              ? 'Доступні лише збережені на пристрої матеріали. Тестування та кейси недоступні до відновлення зв\'язку.'
              : 'Для входу в систему потрібне підключення до інтернету.'}
          </span>
        </div>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div role="status" aria-live="polite" className="bg-emerald-600 text-white print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs sm:text-sm font-medium">
          <Wifi className="w-4 h-4 shrink-0" />
          <span>
            {hasSession
              ? 'З\'єднання відновлено. Прогрес, зроблений офлайн, синхронізовано.'
              : 'З\'єднання відновлено — можна входити в систему.'}
          </span>
        </div>
      </div>
    );
  }

  return null;
};
