import React, { useRef, useState } from 'react';
import { Bold, Italic, List, Heading, Image as ImageIcon, Save, X } from 'lucide-react';

interface MarkdownEditorProps {
  initialValue: string;
  onSave: (md: string) => void;
  onCancel: () => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ initialValue, onSave, onCancel }) => {
  const [content, setContent] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);

    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);

    // Restore cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      // Вставляємо зображення у форматі спеціального тегу для парсера
      insertText(`\n**Зображення:** ${base64}\n`);
    };
    reader.readAsDataURL(file);
    
    // Скидаємо input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header / Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => insertText('**', '**')} className="p-2 text-slate-600 hover:bg-slate-200 rounded transition" title="Жирний">
              <Bold className="w-4 h-4" />
            </button>
            <button onClick={() => insertText('*', '*')} className="p-2 text-slate-600 hover:bg-slate-200 rounded transition" title="Курсив">
              <Italic className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-300 mx-1"></div>
            <button onClick={() => insertText('### ')} className="p-2 text-slate-600 hover:bg-slate-200 rounded transition" title="Заголовок H3">
              <Heading className="w-4 h-4" />
            </button>
            <button onClick={() => insertText('- ')} className="p-2 text-slate-600 hover:bg-slate-200 rounded transition" title="Список">
              <List className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-300 mx-1"></div>
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="p-2 text-blue-600 hover:bg-blue-100 rounded transition flex items-center gap-1.5 font-medium text-xs"
              title="Вставити зображення (буде конвертовано у Base64)"
            >
              <ImageIcon className="w-4 h-4" />
              Додати зображення
            </button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Скасувати
            </button>
            <button 
              onClick={() => onSave(content)}
              className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Зберегти зміни
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-4 bg-slate-100/50">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full resize-none outline-none p-4 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 font-mono text-sm leading-relaxed text-slate-800 shadow-sm"
            placeholder="Введіть Markdown текст..."
          />
        </div>
      </div>
    </div>
  );
};
