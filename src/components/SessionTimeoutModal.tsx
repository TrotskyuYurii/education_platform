import React, { useRef } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface SessionTimeoutModalProps {
  /** Скільки секунд лишилось до автоматичного виходу. */
  secondsLeft: number;
  /** Загальний час простою (хв) — щоб пояснити людині, чому вікно з'явилось. */
  idleMinutes: number;
  onStay: () => void;
  onLogout: () => void;
}

const formatSeconds = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Попередження перед автоматичним виходом через бездіяльність. Свідомо вимагає
 * явного «Залишитись» — рух миші сесію не продовжує, інакше попередження не мало
 * б сенсу біля залишеного без нагляду комп'ютера.
 */
export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  secondsLeft,
  idleMinutes,
  onStay,
  onLogout
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onStay);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-desc"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <h3 id="session-timeout-title" className="font-bold text-slate-900">
              Сесія завершується
            </h3>
            <p id="session-timeout-desc" className="text-sm text-slate-600 mt-1">
              Ви не користувались порталом понад {idleMinutes} хв. З міркувань безпеки вхід
              буде завершено автоматично.
            </p>
          </div>
        </div>

        <div className="px-5 pb-1">
          <div
            className="text-center py-3 rounded-xl bg-slate-50 border border-slate-200"
            aria-live="polite"
          >
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {formatSeconds(Math.max(0, secondsLeft))}
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">до автоматичного виходу</span>
          </div>
        </div>

        <div className="p-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Вийти зараз
          </button>
          <button
            onClick={onStay}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
          >
            Залишитись у системі
          </button>
        </div>
      </div>
    </div>
  );
};
