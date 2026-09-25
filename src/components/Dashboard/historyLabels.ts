/**
 * Як назвати спробу тесту і до якого підрозділу її віднести.
 *
 * Спільне для таблиці історії, графіка «Середній бал за підрозділами» і вікон
 * деталізації: інакше стовпчик графіка і перелік спроб під ним могли б
 * розійтися через різне правило вибору підрозділу.
 */

export interface HistoryLike {
  sectionId?: string;
  courseId?: string;
  department?: string;
  mode?: string;
}

export function getHistoryTitle(history: HistoryLike, courses: any[] = [], sections: any[] = []): string {
  if (history.mode === 'cases') {
    const c = history.courseId ? courses.find(course => course.id === history.courseId) : undefined;
    return c?.title ? `Практичні кейси: ${c.title}` : 'Практичні кейси';
  }
  if (history.courseId) {
    const c = courses.find(course => course.id === history.courseId);
    if (c?.title) return c.title;
  }
  if (history.sectionId) {
    const s = sections.find(sec => sec.id === history.sectionId);
    if (s?.title) return s.title;
  }
  return history.department ? `Тест (${history.department})` : 'Підсумковий тест';
}

/** Підрозділ, під яким спроба рахується на графіку середнього балу. */
export function resolveHistoryDepartment(history: HistoryLike, courses: any[] = [], sections: any[] = []): string {
  let dep = history.department || 'Загальний';
  if ((!dep || dep === 'Загальний') && history.courseId) {
    const matchingCourse = courses.find(c => c.id === history.courseId);
    if (matchingCourse?.department) {
      dep = matchingCourse.department;
    } else {
      const matchingSection = sections.find(s => s.courseId === history.courseId);
      if (matchingSection?.department) dep = matchingSection.department;
    }
  }
  if ((!dep || dep === 'Загальний') && history.sectionId) {
    const matchingSection = sections.find(s => s.id === history.sectionId);
    if (matchingSection?.department) dep = matchingSection.department;
  }
  return dep;
}

export const historyPercentage = (h: { percentage?: number; score: number; total: number }) =>
  h.percentage !== undefined ? h.percentage : (h.total > 0 ? Math.round((h.score / h.total) * 100) : 0);
