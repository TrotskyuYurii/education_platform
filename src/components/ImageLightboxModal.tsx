import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  Maximize2, 
  Check, 
  Copy,
  Sparkles
} from 'lucide-react';

interface ImageLightboxModalProps {
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  imageUrl,
  title = 'Скріншот інструкції',
  onClose
}) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  // Keyboard navigation: Escape to close, +/- for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(prev + 0.25, 4));
      } else if (e.key === '-' || e.key === '_') {
        setZoom(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      const cleanTitle = (title || 'screenshot')
        .replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_')
        .slice(0, 40);
      // Зображення тепер зберігаються файлами — беремо розширення з посилання
      const extension = imageUrl.match(/\.(png|jpe?g|webp|gif|svg|bmp)(?:\?|$)/i)?.[1] || 'png';
      link.download = `${cleanTitle}.${extension.toLowerCase()}`;
      link.click();
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        // Для файлів копіюємо повне посилання, яким можна поділитися
        const shareUrl = imageUrl.startsWith('data:') || imageUrl.startsWith('http')
          ? imageUrl
          : new URL(imageUrl, window.location.origin).href;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Drag to pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800/80 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate">{title}</h3>
            <p className="text-[11px] text-slate-400">
              Масштаб: {Math.round(zoom * 100)}% {zoom > 1 ? '· Затисніть мишу для переміщення' : ''}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition disabled:opacity-40"
              title="Зменшити (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Скинути (0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition disabled:opacity-40"
              title="Збільшити (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
            title="Завантажити зображення"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopy}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
            title="Скопіювати посилання на зображення"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-rose-400 bg-slate-800 hover:bg-rose-950/40 rounded-xl border border-slate-700 hover:border-rose-700/50 transition ml-2"
            title="Закрити (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Canvas */}
      <div 
        className="grow overflow-hidden relative flex items-center justify-center p-4 sm:p-8"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div 
          className="transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
        >
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border border-slate-800/80 pointer-events-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="py-2.5 px-4 bg-slate-900/60 border-t border-slate-800/60 text-center text-xs text-slate-400 shrink-0">
        Натисніть <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700 font-mono text-[10px]">Esc</kbd> щоб вийти, або використовуйте кнопки зуму для детального вивчення скріншота.
      </div>
    </div>
  );
};
