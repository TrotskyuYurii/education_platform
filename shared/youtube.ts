/**
 * Розпізнавання посилань на відео YouTube в тексті інструкцій.
 *
 * Підтримуються всі звичні форми посилань: youtube.com/watch?v=…, youtu.be/…,
 * /embed/…, /shorts/…, /live/…, мобільна версія та youtube-nocookie.com, а
 * також позначка часу старту (t=90, t=1m30s, start=90).
 */

export interface YouTubeVideo {
  id: string;
  /** З якої секунди починати відтворення. */
  start?: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

/** «90», «90s», «1m30s», «1h2m3s» → секунди. */
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+s?$/.test(trimmed)) return parseInt(trimmed, 10) || undefined;
  const m = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const total = (parseInt(m[1] || '0', 10) * 3600) + (parseInt(m[2] || '0', 10) * 60) + parseInt(m[3] || '0', 10);
  return total || undefined;
}

/** Повертає ідентифікатор відео або null, якщо посилання не веде на відео YouTube. */
export function parseYouTubeUrl(raw: string | null | undefined): YouTubeVideo | null {
  if (!raw) return null;
  let text = raw.trim().replace(/^<|>$/g, '');
  if (!/^https?:\/\//i.test(text)) {
    if (/^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(text)) text = `https://${text}`;
    else return null;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let id: string | null = null;
  if (host.endsWith('youtu.be')) {
    id = url.pathname.split('/')[1] || null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    if (m) id = m[1];
  }
  if (!id || !VIDEO_ID.test(id)) return null;

  const start = parseStart(url.searchParams.get('t') || url.searchParams.get('start'));
  return start ? { id, start } : { id };
}

export const isYouTubeUrl = (raw: string | null | undefined) => parseYouTubeUrl(raw) !== null;

/** Адреса вбудованого плеєра. Домен без cookie: YouTube не стежить за переглядом, поки людина не натисне «грати». */
export function youTubeEmbedUrl(video: YouTubeVideo, options: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
  if (video.start) params.set('start', String(video.start));
  if (options.autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${video.id}?${params.toString()}`;
}

/** Звичайне посилання на перегляд відео на YouTube. */
export function youTubeWatchUrl(video: YouTubeVideo): string {
  return `https://www.youtube.com/watch?v=${video.id}${video.start ? `&t=${video.start}s` : ''}`;
}

/** Обкладинка відео для попереднього перегляду до натискання «грати». */
export function youTubeThumbnailUrl(video: YouTubeVideo): string {
  return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

/**
 * Рядок тексту, який цілком складається з посилання на відео, — такий рядок
 * показується як вбудований плеєр. Підтримуються:
 *   https://youtu.be/…            (голе посилання, зокрема в <…>)
 *   [Назва відео](https://…)       (посилання Markdown)
 *   ![Назва відео](https://…)      (синтаксис зображення з адресою відео)
 *   <iframe src="https://www.youtube.com/embed/…"></iframe>
 */
export function parseVideoLine(line: string): { video: YouTubeVideo; title?: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const md = trimmed.match(/^!?\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/);
  if (md) {
    const video = parseYouTubeUrl(md[2]);
    return video ? { video, title: md[1].trim() || undefined } : null;
  }

  const iframe = trimmed.match(/^<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*(?:<\/iframe>)?$/i);
  if (iframe) {
    const video = parseYouTubeUrl(iframe[1]);
    const title = trimmed.match(/\btitle=["']([^"']+)["']/i)?.[1];
    return video ? { video, title } : null;
  }

  if (/^<?https?:\/\/\S+>?$/i.test(trimmed) || /^(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+$/i.test(trimmed)) {
    const video = parseYouTubeUrl(trimmed);
    return video ? { video } : null;
  }
  return null;
}
