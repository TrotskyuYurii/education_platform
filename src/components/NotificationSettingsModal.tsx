import React, { useEffect, useRef, useState } from 'react';
import { X, Bell, Lock, Save, Loader2 } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface NotificationTypeInfo {
  type: string;
  title: string;
  isCritical: boolean;
}

interface NotificationSettingsModalProps {
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ onClose }) => {
  const [availableTypes, setAvailableTypes] = useState<NotificationTypeInfo[]>([]);
  const [disabledEmailTypes, setDisabledEmailTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, onClose);

  useEffect(() => {
    fetch('/api/v2/notifications/settings')
      .then(res => res.json())
      .then(data => {
        setAvailableTypes(data.availableTypes || []);
        setDisabledEmailTypes(data.disabledEmailTypes || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const toggleType = (type: string) => {
    setDisabledEmailTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/v2/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabledEmailTypes })
      });
      if (res.ok) {
        setSaveMessage('Налаштування збережено');
      } else {
        setSaveMessage('Не вдалося зберегти налаштування');
      }
    } catch {
      setSaveMessage('Помилка мережі під час збереження');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-settings-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="notif-settings-title" className="font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" /> Сповіщення на email
          </h3>
          <button onClick={onClose} aria-label="Закрити" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Завантаження...
            </div>
          ) : availableTypes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Типи сповіщень ще не налаштовані.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                Оберіть, про які події ви хочете додатково отримувати листи на email (у застосунку сповіщення показуються завжди).
              </p>
              {availableTypes.map(t => {
                const emailEnabled = !disabledEmailTypes.includes(t.type);
                return (
                  <label
                    key={t.type}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                      t.isCritical ? 'bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-blue-300 cursor-pointer'
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-800">{t.title}</span>
                    {t.isCritical ? (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0">
                        <Lock className="w-3.5 h-3.5" /> Завжди увімкнено
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={emailEnabled}
                        onChange={() => toggleType(t.type)}
                        className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                      />
                    )}
                  </label>
                );
              })}
            </>
          )}

          {saveMessage && (
            <div role="status" aria-live="polite" className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {saveMessage}
            </div>
          )}

          {!isLoading && availableTypes.length > 0 && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зберегти
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
