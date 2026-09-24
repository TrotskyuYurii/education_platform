import { describe, it, expect } from 'vitest';

import { parseYouTubeUrl, parseVideoLine, youTubeEmbedUrl } from '../shared/youtube.js';

describe('parseYouTubeUrl', () => {
  it('розпізнає всі звичні форми посилань', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?feature=share&v=${id}`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/live/${id}`,
      `youtu.be/${id}`
    ]) {
      expect(parseYouTubeUrl(url)?.id, url).toBe(id);
    }
  });

  it('читає час старту', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=90')?.start).toBe(90);
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')?.start).toBe(90);
    expect(parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?start=15')?.start).toBe(15);
  });

  it('не приймає інші сайти та посилання без відео', () => {
    expect(parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/channel/UC123')).toBeNull();
    expect(parseYouTubeUrl('https://notyoutube.com/dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=short')).toBeNull();
  });
});

describe('parseVideoLine', () => {
  it('рядок-посилання стає відео, з назвою з Markdown', () => {
    expect(parseVideoLine('https://youtu.be/dQw4w9WgXcQ')?.video.id).toBe('dQw4w9WgXcQ');
    expect(parseVideoLine('[Як оформити повернення](https://youtu.be/dQw4w9WgXcQ)')?.title).toBe('Як оформити повернення');
    expect(parseVideoLine('![Відео](https://www.youtube.com/watch?v=dQw4w9WgXcQ)')?.video.id).toBe('dQw4w9WgXcQ');
    expect(parseVideoLine('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Урок"></iframe>')?.title).toBe('Урок');
  });

  it('посилання посеред речення вбудованим відео не стає', () => {
    expect(parseVideoLine('Дивіться відео https://youtu.be/dQw4w9WgXcQ перед роботою')).toBeNull();
    expect(parseVideoLine('[Сайт](https://example.com)')).toBeNull();
  });
});

describe('youTubeEmbedUrl', () => {
  it('використовує домен без cookie і передає час старту', () => {
    const url = youTubeEmbedUrl({ id: 'dQw4w9WgXcQ', start: 90 }, { autoplay: true });
    expect(url).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(url).toContain('start=90');
    expect(url).toContain('autoplay=1');
  });
});
