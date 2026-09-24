import React, { useState } from 'react';
import { Play, ExternalLink, Youtube } from 'lucide-react';
import { YouTubeVideo, youTubeEmbedUrl, youTubeThumbnailUrl, youTubeWatchUrl } from '../../shared/youtube';

/**
 * Відео YouTube усередині інструкції.
 *
 * Спочатку показується лише обкладинка з кнопкою відтворення, а сам плеєр
 * вантажиться після натискання: інструкція з кількома відео не тягне одразу
 * кілька важких плеєрів, а YouTube нічого не дізнається про читача, поки той
 * сам не запустить відео.
 */
export const YouTubeEmbed: React.FC<{ video: YouTubeVideo; title?: string }> = ({ video, title }) => {
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const label = title || 'Відео до інструкції';

  return (
    <figure className="not-prose my-6 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="relative aspect-video bg-slate-900">
        {playing ? (
          <iframe
            src={youTubeEmbedUrl(video, { autoplay: true })}
            title={label}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 w-full h-full flex items-center justify-center"
            aria-label={`Відтворити відео: ${label}`}
          >
            {!thumbFailed && (
              <img
                src={youTubeThumbnailUrl(video)}
                alt=""
                loading="lazy"
                onError={() => setThumbFailed(true)}
                className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
              />
            )}
            <span className="relative w-16 h-16 rounded-full bg-rose-600 group-hover:bg-rose-700 group-hover:scale-105 text-white flex items-center justify-center shadow-xl transition">
              <Play className="w-7 h-7 ml-1 fill-current" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="px-3.5 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5 font-medium min-w-0">
          <Youtube className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <a
          href={youTubeWatchUrl(video)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0"
        >
          Відкрити на YouTube
          <ExternalLink className="w-3 h-3" />
        </a>
      </figcaption>
    </figure>
  );
};
