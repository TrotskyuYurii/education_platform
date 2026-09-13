import React from 'react';
import { Maximize2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cleanBase64Url } from '../utils/markdownParser';

interface RichTextWithImagesProps {
  content: string;
  className?: string;
  onImageClick?: (url: string, title?: string) => void;
}

interface TextOrImageSegment {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  alt?: string;
}

export const RichTextWithImages: React.FC<RichTextWithImagesProps> = ({
  content,
  className = '',
  onImageClick
}) => {
  if (!content) return null;

  // Split content into text segments and image segments
  const segments: TextOrImageSegment[] = [];

  // Match:
  // 1. ![alt](url)
  // 2. <img src="url" ... />
  // 3. **Зображення:** url
  // 4. Standalone data:image/... url
  const combinedRegex = /(!\[([\s\S]*?)\]\(\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/[^\s)]+)\s*\)|<img\s+[^>]*src=["']\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/[^"']+)["'][^>]*>|\*\*Зображення:\*\*\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/\S+)|(data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]{40,}))/gi;

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
      const srcMatch = fullMatch.match(/src=["']\s*(data:image\/[^;]+;base64,[\s\S]*?|https?:\/\/[^"']+)["']/i);
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

    const cleaned = cleanBase64Url(extractedUrl);
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

  // If no images matched, render with structured formatting
  if (segments.length === 0) {
    return <div className={`space-y-2 ${className}`}>{renderStructuredText(content)}</div>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return (
            <div key={idx} className="leading-relaxed">
              {renderStructuredText(seg.text || '')}
            </div>
          );
        }

        if (seg.type === 'image' && seg.imageUrl) {
          return (
            <div 
              key={idx} 
              className="my-3 rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden group hover:border-blue-400 hover:shadow-md transition cursor-pointer"
              onClick={() => onImageClick && onImageClick(seg.imageUrl!, seg.alt)}
            >
              <div className="relative bg-slate-50 flex items-center justify-center p-2 min-h-[140px] max-h-[420px] overflow-hidden">
                <img
                  src={seg.imageUrl}
                  alt={seg.alt || 'Скріншот'}
                  className="max-h-[400px] w-auto max-w-full object-contain rounded-lg transition group-hover:scale-[1.01]"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback on error
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

/**
 * Helper to render structured markdown text (headings, bullet points, callouts, paragraphs)
 */
function renderStructuredText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' = 'ul';
  let tableRows: string[][] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2 pl-2 text-slate-700">
            {currentList.map((item, i) => (
              <li key={i} className="leading-relaxed">{renderInlineMarkdown(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="space-y-1.5 my-2 pl-1">
            {currentList.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700 text-sm leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>{renderInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        );
      }
      currentList = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const bodyRows = tableRows.slice(1).filter(r => !r.every(cell => /^[-:]+$/.test(cell.trim())));
      elements.push(
        <div key={`tbl-${elements.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold text-slate-700">{renderInlineMarkdown(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-600">{renderInlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Empty line: flush lists and tables
    if (!line) {
      flushList();
      flushTable();
      continue;
    }

    // Markdown Table row: starts and ends with |
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // Headings
    if (line.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${i}`} className="text-sm font-bold text-slate-800 mt-4 mb-1.5 flex items-center gap-1.5">
          {renderInlineMarkdown(line.replace(/^####\s+/, ''))}
        </h4>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-bold text-slate-900 mt-5 mb-2 pb-1 border-b border-slate-100 flex items-center gap-2">
          {renderInlineMarkdown(line.replace(/^###\s+/, ''))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-bold text-slate-900 mt-6 mb-2">
          {renderInlineMarkdown(line.replace(/^##\s+/, ''))}
        </h2>
      );
      continue;
    }

    // Divider
    if (line === '---' || line === '***') {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-4 border-slate-200" />);
      continue;
    }

    // Callouts: Tip or Warning
    if (line.startsWith('💡') || line.toLowerCase().startsWith('підказка:') || line.startsWith('> 💡')) {
      flushList();
      const tipText = line.replace(/^(?:>\s*)?💡\s*(?:Підказка:\s*)?/i, '');
      elements.push(
        <div key={`tip-${i}`} className="my-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 shadow-xs">
          <span className="text-base leading-none shrink-0">💡</span>
          <div className="leading-relaxed font-medium">{renderInlineMarkdown(tipText)}</div>
        </div>
      );
      continue;
    }

    if (line.startsWith('⚠️') || line.toLowerCase().startsWith('увага:') || line.startsWith('> ⚠️')) {
      flushList();
      const warnText = line.replace(/^(?:>\s*)?⚠️\s*(?:Увага:\s*)?/i, '');
      elements.push(
        <div key={`warn-${i}`} className="my-2.5 p-3 rounded-xl bg-rose-50/80 border border-rose-200/80 text-rose-900 text-xs flex items-start gap-2.5 shadow-xs">
          <span className="text-base leading-none shrink-0">⚠️</span>
          <div className="leading-relaxed font-medium">{renderInlineMarkdown(warnText)}</div>
        </div>
      );
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (currentList.length === 0) listType = 'ul';
      currentList.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }

    // Numbered list items
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (currentList.length === 0) listType = 'ol';
      currentList.push(numMatch[2]);
      continue;
    }

    // Standard paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-sm text-slate-700 leading-relaxed my-1.5">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  flushList();
  flushTable();

  return elements;
}

/**
 * Helper to render inline markdown (bold, italic, code, links)
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Split by bold (**text**), code (`code`), or links [text](url)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1.5 py-0.5 bg-slate-100 text-blue-700 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a 
          key={index} 
          href={linkMatch[2]} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}
