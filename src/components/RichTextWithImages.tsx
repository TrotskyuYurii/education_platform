import React from 'react';
import { ImageIcon, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RichTextWithImagesProps {
  contentHtml?: string;
  contentMarkdown?: string;
  images?: string[];
  className?: string;
  onImageClick?: (url: string, alt: string) => void;
}

/**
 * Приводить посилання на зображення до вигляду, придатного для <img src>.
 * Штатний формат — файл у теці документа (`/api/sections/<id>/assets/v1/img-001.png`);
 * Base64 підтримуємо лише для інструкцій, імпортованих до переходу на файлове зберігання.
 */
const normalizeImageUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.startsWith('http')) return trimmed;
  // Файл документа: абсолютний шлях API або відносний assets/...
  if (/^\/[^\s]+$/.test(trimmed) || /^(?:\.\/)?assets\/[^\s]+$/i.test(trimmed)) {
    return trimmed.replace(/^\.\//, '');
  }
  // If it's a raw base64 string without data prefix, try to guess
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 50) {
    // If it starts with /9j/, it's likely JPEG
    if (trimmed.startsWith('/9j/')) return `data:image/jpeg;base64,${trimmed}`;
    // default to png
    return `data:image/png;base64,${trimmed}`;
  }
  return null;
};

export const RichTextWithImages: React.FC<RichTextWithImagesProps> = ({ 
  contentHtml, 
  contentMarkdown, 
  className = "",
  onImageClick 
}) => {
  const content = contentMarkdown || contentHtml || '';
  
  if (!content) return null;

  // We need to parse out images and text segments so we can render images properly
  const segments: { type: 'text' | 'image', text?: string, imageUrl?: string, alt?: string }[] = [];
  
  // Advanced regex to catch images inside Markdown or HTML tags
  // 1. ![alt](/api/sections/.../img-001.png | assets/img-001.png | https://... | data:image/...)
  // 2. <img src="url" ... />
  // 3. **Зображення:** url
  // 4. Standalone data:image/... url (успадковані інструкції з Base64)
  const IMAGE_URL = 'data:image\\/[^;]+;base64,[\\s\\S]*?|https?:\\/\\/[^\\s)"\']+|[./A-Za-z0-9_-][^\\s)"\']*\\.(?:png|jpe?g|webp|gif|svg|bmp)';
  const combinedRegex = new RegExp(
    `(!\\[([\\s\\S]*?)\\]\\(\\s*(${IMAGE_URL})\\s*\\)` +
    `|<img\\s+[^>]*src=["']\\s*(${IMAGE_URL})["'][^>]*>` +
    `|\\*\\*Зображення:\\*\\*\\s*(${IMAGE_URL})` +
    `|(data:image\\/(?:png|jpeg|jpg|webp|gif|svg\\+xml);base64,[A-Za-z0-9+/=\\s]{40,}))`,
    'gi'
  );
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    
    if (matchIndex > lastIndex) {
      const textBefore = content.substring(lastIndex, matchIndex);
      if (textBefore.trim()) {
        segments.push({ type: 'text', text: textBefore });
      }
    }

    const fullMatch = match[0];
    let extractedUrl = '';
    let extractedAlt = 'Скріншот інструкції';

    if (fullMatch.startsWith('![')) {
      // Markdown: ![alt](url)
      extractedAlt = match[2] ? match[2].trim() : 'Скріншот';
      extractedUrl = match[3] ? match[3].trim() : '';
    } else if (fullMatch.toLowerCase().startsWith('<img')) {
      // HTML <img src="..." alt="..." />
      const srcMatch = fullMatch.match(new RegExp(`src=["']\\s*(${IMAGE_URL})["']`, 'i'));
      extractedUrl = srcMatch ? srcMatch[1].trim() : '';
      const altMatch = fullMatch.match(/alt=["']([^"']*)["']/i);
      if (altMatch) extractedAlt = altMatch[1].trim();
    } else if (fullMatch.startsWith('**Зображення:**')) {
      extractedUrl = match[4] ? match[4].trim() : '';
      extractedAlt = 'Скріншот';
    } else if (match[5]) {
      // Standalone base64
      extractedUrl = match[5].trim();
      extractedAlt = 'Скріншот';
    }

    const cleaned = normalizeImageUrl(extractedUrl);
    if (cleaned) {
      segments.push({
        type: 'image',
        imageUrl: cleaned,
        alt: extractedAlt
      });
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex);
    if (remainingText.trim()) {
      segments.push({ type: 'text', text: remainingText });
    }
  }

  // If no images matched, render with standard Markdown
  if (segments.length === 0) {
    return (
      <div className={`markdown-body ${className}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return (
            <div key={idx} className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {seg.text || ''}
              </ReactMarkdown>
            </div>
          );
        }

        if (seg.type === 'image' && seg.imageUrl) {
          return (
            <div 
              key={idx} 
              className="my-6 rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden group hover:border-blue-400 hover:shadow-md transition cursor-pointer"
              onClick={() => onImageClick && onImageClick(seg.imageUrl!, seg.alt || '')}
            >
              <div className="relative bg-slate-50 flex items-center justify-center p-2 min-h-[140px] max-h-[420px] overflow-hidden">
                <img
                  src={seg.imageUrl}
                  alt={seg.alt || 'Скріншот'}
                  className="max-h-[400px] w-auto max-w-full object-contain rounded-lg transition group-hover:scale-[1.01]"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex items-center gap-2 text-rose-500 py-4 px-3 text-xs">
                          <span>⚠️ Не вдалося завантажити зображення</span>
                        </div>
                      `;
                    }
                  }}
                />
                
                {/* Hover overlay with zoom hint */}
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Натисніть для збільшення
                  </span>
                </div>
              </div>
              
              {seg.alt && seg.alt !== 'Зображення' && seg.alt !== 'Скріншот' && (
                <div className="px-3.5 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium truncate">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{seg.alt}</span>
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 shrink-0 ml-2">
                    <Maximize2 className="w-3 h-3" />
                    Перегляд
                  </span>
                </div>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
