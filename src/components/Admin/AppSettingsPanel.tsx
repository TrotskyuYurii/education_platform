import React, { useState } from 'react';
import { Quote, Loader2 } from 'lucide-react';
import { AppSettingKey } from '../../../shared/appSettings';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { TableNotice } from './AdminTable';

/**
 * Вкладка «Налаштування»: глобальні налаштування додатка, що діють для всіх
 * користувачів. Кожне налаштування — окремий рядок із перемикачем; зміна
 * зберігається одразу, без окремої кнопки «Зберегти».
 */

/** Перемикач-«тумблер» для увімкнення / вимкнення налаштування. */
const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-purple-600' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

interface BooleanSettingDef {
  key: AppSettingKey;
  icon: React.ElementType;
  title: string;
  description: string;
  onLabel: string;
  offLabel: string;
}

const BOOLEAN_SETTINGS: BooleanSettingDef[] = [
  {
    key: 'quizQuotesEnabled',
    icon: Quote,
    title: 'Висловлювання українських діячів у тестах',
    description:
      'Під час проходження тестів і квізів після відповіді іноді з’являється мотиваційне висловлювання (Шевченко, Франко, Леся Українка та інші), а на екрані результату — підсумкова цитата. Вимкніть, щоб тести проходили без них. «Цитата дня» на головній сторінці від цього не залежить.',
    onLabel: 'Показуються',
    offLabel: 'Приховані'
  }
];

export const AppSettingsPanel: React.FC = () => {
  const { settings, loaded, update } = useAppSettings();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('system.settings.manage');
  const [savingKey, setSavingKey] = useState<AppSettingKey | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggle = async (def: BooleanSettingDef, value: boolean) => {
    setSavingKey(def.key);
    setMsg(null);
    try {
      await update({ [def.key]: value });
      setMsg({ type: 'success', text: `«${def.title}»: ${value ? def.onLabel.toLowerCase() : def.offLabel.toLowerCase()}.` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Не вдалося зберегти налаштування' });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-900">Налаштування додатка</h3>
        <p className="text-sm text-slate-500 mt-1">
          Глобальні налаштування діють для всіх користувачів одразу після зміни.
        </p>
      </div>

      {msg && <TableNotice tone={msg.type} text={msg.text} onClose={() => setMsg(null)} />}

      <div className="border border-slate-200 rounded-2xl bg-white divide-y divide-slate-100">
        {BOOLEAN_SETTINGS.map(def => {
          const Icon = def.icon;
          const value = Boolean(settings[def.key]);
          const saving = savingKey === def.key;
          return (
            <div key={def.key} className="flex items-start gap-4 p-4 sm:p-5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="grow min-w-0">
                <div className="font-semibold text-sm text-slate-900">{def.title}</div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{def.description}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {!loaded || saving ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 my-0.5" />
                ) : (
                  <Toggle
                    checked={value}
                    onChange={next => handleToggle(def, next)}
                    disabled={!canEdit}
                    label={def.title}
                  />
                )}
                <span className={`text-[10px] font-bold uppercase ${value ? 'text-purple-700' : 'text-slate-400'}`}>
                  {value ? def.onLabel : def.offLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
