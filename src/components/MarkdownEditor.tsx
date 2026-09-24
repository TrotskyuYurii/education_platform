import React, { useRef, useState } from 'react';
import { Bold, Italic, List, Heading, Image as ImageIcon, Save, X, Youtube } from 'lucide-react';
import { parseYouTubeUrl } from '../../shared/youtube';

interface MarkdownEditorProps {
  initialValue: string;
  /** Документ, у теку якого зберігаються завантажені зображення */
  instructionId?: string;
  onSave: (md: string) => void;
  onCancel: () => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ initialValue, instructionId, onSave, onCancel }) => {
  const [content, setContent] = useState(initialValue);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Форма вставки відео YouTube під панеллю інструментів
  const [videoFormOpen, setVideoFormOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);

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

  /**
   * Зображення зберігається окремим файлом у теці документа, а в текст потрапляє
   * лише посилання на нього. Base64 у Markdown більше не вставляємо: він роздуває
   * документ у базі та не дає працювати з картинками як зі звичайними файлами.
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setUploadError(null);

    if (!instructionId) {
      setUploadError('Спочатку збережіть інструкцію — зображення зберігаються у її теці.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/admin/instructions/${instructionId}/assets`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося зберегти зображення');

      const caption = file.name.replace(/\.[^/.]+$/, '') || 'Скріншот';
      insertText(`\n![${caption}](${data.url})\n`);
    } catch (err: any) {
      setUploadError(err.message || 'Не вдалося зберегти зображення');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Відео вставляється окремим рядком-посиланням Markdown: у переглядачі такий
   * рядок стає вбудованим плеєром, а в самому .md лишається звичайним посиланням.
   */
  const handleInsertVideo = () => {
    const video = parseYouTubeUrl(videoUrl);
    if (!video) {
      setVideoError('Це не схоже на посилання на відео YouTube. Скопіюйте адресу відео з браузера або кнопки «Поділитися».');
      return;
    }
    const title = videoTitle.trim().replace(/[\[\]]/g, '') || 'Відео';
    insertText(`\n[${title}](${videoUrl.trim()})\n`);
    setVideoFormOpen(false);
    setVideoUrl('');
    setVideoTitle('');
    setVideoError(null);
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
              disabled={isUploading}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded transition flex items-center gap-1.5 font-medium text-xs disabled:opacity-50"
              title="Додати зображення (зберігається файлом у теці документа)"
            >
              <ImageIcon className="w-4 h-4" />
              {isUploading ? 'Завантаження…' : 'Додати зображення'}
            </button>
            <button
              onClick={() => { setVideoFormOpen(v => !v); setVideoError(null); }}
              className={`p-2 rounded transition flex items-center gap-1.5 font-medium text-xs ${videoFormOpen ? 'bg-rose-100 text-rose-700' : 'text-rose-600 hover:bg-rose-50'}`}
              title="Вставити відео YouTube — у інструкції воно показується вбудованим плеєром"
            >
              <Youtube className="w-4 h-4" />
              Відео YouTube
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

        {videoFormOpen && (
          <div className="px-4 py-3 bg-rose-50/60 border-b border-rose-100 flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={videoUrl}
              onChange={e => { setVideoUrl(e.target.value); setVideoError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInsertVideo(); } }}
              placeholder="https://www.youtube.com/watch?v=… або https://youtu.be/…"
              className="grow min-w-[260px] px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-200 bg-white"
              autoFocus
            />
            <input
              type="text"
              value={videoTitle}
              onChange={e => setVideoTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInsertVideo(); } }}
              placeholder="Підпис до відео (необов'язково)"
              className="w-64 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-200 bg-white"
            />
            <button
              onClick={handleInsertVideo}
              disabled={!videoUrl.trim()}
              className="px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-40"
            >
              Вставити
            </button>
            <p className="w-full text-[11px] text-slate-500">
              Відео вставиться в місце курсора окремим рядком. Щоб почати з певної хвилини, скопіюйте посилання «з позначкою часу» (наприклад, …?t=90).
            </p>
            {videoError && <p className="w-full text-xs font-semibold text-rose-700">{videoError}</p>}
          </div>
        )}

        {uploadError && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-700">
            {uploadError}
          </div>
        )}

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
