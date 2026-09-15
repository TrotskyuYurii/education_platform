import React, { useEffect, useState } from 'react';
import { Bell, Lock, Save, Check } from 'lucide-react';

interface NotificationTemplateItem {
  type: string;
  title: string;
  titleTemplate: string;
  bodyTemplate: string;
  defaultChannels: string[];
  isCritical: boolean;
}

export const NotificationTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<NotificationTemplateItem[]>([]);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<NotificationTemplateItem>>({});
  const [savedType, setSavedType] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/v2/notifications/templates');
      const data = await res.json();
      if (res.ok) setTemplates(data.templates || []);
    } catch {}
  };

  useEffect(() => { fetchTemplates(); }, []);

  const startEdit = (tpl: NotificationTemplateItem) => {
    setEditingType(tpl.type);
    setForm({ titleTemplate: tpl.titleTemplate, bodyTemplate: tpl.bodyTemplate, defaultChannels: tpl.defaultChannels });
    setSavedType(null);
  };

  const toggleChannel = (channel: string) => {
    setForm(prev => {
      const channels = prev.defaultChannels || [];
      return {
        ...prev,
        defaultChannels: channels.includes(channel) ? channels.filter(c => c !== channel) : [...channels, channel]
      };
    });
  };

  const handleSave = async (type: string) => {
    try {
      const res = await fetch(`/api/v2/notifications/templates/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setSavedType(type);
        setEditingType(null);
        await fetchTemplates();
      }
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" /> Шаблони сповіщень
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Текст і канали для кожної автоматичної події. Змінні на кшталт <code className="bg-slate-100 px-1 rounded">{'{{courseTitle}}'}</code> підставляються автоматично.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map(tpl => (
          <div key={tpl.type} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{tpl.title}</span>
                <span className="text-[10px] font-mono text-slate-400">{tpl.type}</span>
                {tpl.isCritical && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                    <Lock className="w-3 h-3" /> критичний
                  </span>
                )}
              </div>
              {editingType === tpl.type ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSave(tpl.type)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Save className="w-3.5 h-3.5" /> Зберегти
                  </button>
                  <button
                    onClick={() => setEditingType(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(tpl)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  Редагувати
                </button>
              )}
            </div>

            {editingType === tpl.type ? (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Заголовок</label>
                  <input
                    type="text"
                    value={form.titleTemplate || ''}
                    onChange={e => setForm({ ...form, titleTemplate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Текст повідомлення</label>
                  <textarea
                    value={form.bodyTemplate || ''}
                    onChange={e => setForm({ ...form, bodyTemplate: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.defaultChannels || []).includes('in_app')}
                      onChange={() => toggleChannel('in_app')}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    У застосунку
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.defaultChannels || []).includes('email')}
                      onChange={() => toggleChannel('email')}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Email
                  </label>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{tpl.bodyTemplate}</p>
            )}

            {savedType === tpl.type && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check className="w-3.5 h-3.5" /> Збережено
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
