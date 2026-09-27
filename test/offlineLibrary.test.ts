import { describe, it, expect } from 'vitest';

import {
  emptyLibrary,
  addToLibrary,
  removeFromLibrary,
  refreshLibrary,
  applyReadOps,
  collectImageUrls,
  isSavedInLibrary,
  LibraryContent
} from '../src/utils/offlineLibrary.js';

const section = (id: string, extra: Record<string, any> = {}) => ({
  id,
  department: 'Продажі',
  title: `Інструкція ${id}`,
  subtitle: '',
  targetRole: 'all' as const,
  pageReference: '',
  readTimeMin: 5,
  summary: '',
  keyPoints: [],
  ...extra
});

const content: LibraryContent = {
  sections: [
    section('s1', { spaceId: 'sp1' }),
    section('s2'),
    section('s3'),
    section('s4', { isActive: false })
  ],
  courses: [
    { id: 'c1', title: 'Курс 1', instructionIds: ['s1', 's2', 's4'], spaceId: 'sp2' },
    { id: 'c2', title: 'Курс 2', instructionIds: ['s2', 's3'] }
  ],
  spaces: [
    { id: 'sp1', name: 'Простір 1' },
    { id: 'sp2', name: 'Простір 2' },
    { id: 'sp3', name: 'Зайвий' }
  ]
};

describe('офлайн-бібліотека', () => {
  it('курс зберігається разом з активними інструкціями та просторами', () => {
    const lib = addToLibrary(emptyLibrary('u1'), content, 'course', 'c1', '2026-01-01T00:00:00Z');
    expect(lib.savedCourseIds).toEqual(['c1']);
    expect(lib.sections.map(s => s.id).sort()).toEqual(['s1', 's2']);
    expect(lib.spaces.map(s => s.id).sort()).toEqual(['sp1', 'sp2']);
    expect(lib.savedAt.c1).toBe('2026-01-01T00:00:00Z');
    expect(isSavedInLibrary(lib, 'c1')).toBe(true);
  });

  it('видалення курсу не зачіпає інструкцію, спільну з іншим збереженим курсом', () => {
    let lib = addToLibrary(emptyLibrary('u1'), content, 'course', 'c1');
    lib = addToLibrary(lib, content, 'course', 'c2');
    lib = removeFromLibrary(lib, 'c1');
    expect(lib.savedCourseIds).toEqual(['c2']);
    expect(lib.sections.map(s => s.id).sort()).toEqual(['s2', 's3']);
    expect(lib.spaces).toEqual([]);
    expect(lib.savedAt.c1).toBeUndefined();
  });

  it('окрема інструкція зберігається й прибирається незалежно від курсів', () => {
    let lib = addToLibrary(emptyLibrary('u1'), content, 'section', 's3');
    expect(lib.sections.map(s => s.id)).toEqual(['s3']);
    lib = removeFromLibrary(lib, 's3');
    expect(lib.sections).toEqual([]);
    expect(lib.savedSectionIds).toEqual([]);
  });

  it('додавання не губить уже збережене, навіть якщо його немає в поточних даних', () => {
    const lib = addToLibrary(emptyLibrary('u1'), content, 'course', 'c1');
    const partial: LibraryContent = { sections: [section('s3')], courses: [], spaces: [] };
    const next = addToLibrary(lib, partial, 'section', 's3');
    expect(next.savedCourseIds).toEqual(['c1']);
    expect(next.sections.map(s => s.id).sort()).toEqual(['s1', 's2', 's3']);
  });

  it('звірка з сервером оновлює текст і прибирає матеріали, до яких більше немає доступу', () => {
    let lib = addToLibrary(emptyLibrary('u1'), content, 'course', 'c1');
    lib = addToLibrary(lib, content, 'section', 's3');
    const fresh: LibraryContent = {
      sections: [section('s1', { title: 'Нова редакція' }), section('s2')],
      courses: [{ id: 'c1', title: 'Курс 1', instructionIds: ['s1', 's2'] }],
      spaces: []
    };
    const next = refreshLibrary(lib, fresh, '2026-02-01T00:00:00Z');
    expect(next.sections.find(s => s.id === 's1')?.title).toBe('Нова редакція');
    expect(next.savedSectionIds).toEqual([]);
    expect(next.syncedAt).toBe('2026-02-01T00:00:00Z');
  });
});

describe('applyReadOps', () => {
  it('накладає офлайн-позначки поверх серверного прогресу в порядку їх появи', () => {
    const result = applyReadOps(['a', 'b'], [
      { sectionId: 'c', read: true, at: '1' },
      { sectionId: 'a', read: false, at: '2' },
      { sectionId: 'c', read: false, at: '3' },
      { sectionId: 'c', read: true, at: '4' }
    ]);
    expect(result.sort()).toEqual(['b', 'c']);
  });
});

describe('collectImageUrls', () => {
  it('знаходить файли документа й зовнішні зображення, пропускаючи data:-URL', () => {
    const urls = collectImageUrls([
      section('s1', {
        contentMarkdown: 'Текст ![крок](/api/sections/s1/assets/v1/img-001.png) і ![b](https://cdn.example.com/a.png) ![c](data:image/png;base64,AAAA)',
        contentHtml: '<img src="/api/sections/s1/assets/v1/img-002.png" alt="">',
        images: ['/api/sections/s1/assets/v1/img-003.png'],
        steps: [{ number: 1, title: '', description: '', imageUrl: 'https://cdn.example.com/b.png' }]
      })
    ]);
    expect(urls.sort()).toEqual([
      '/api/sections/s1/assets/v1/img-001.png',
      '/api/sections/s1/assets/v1/img-002.png',
      '/api/sections/s1/assets/v1/img-003.png',
      'https://cdn.example.com/a.png',
      'https://cdn.example.com/b.png'
    ]);
  });
});
