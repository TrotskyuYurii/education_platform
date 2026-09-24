/**
 * Повідомлення сервера про переходи між розділами для журналу дій.
 *
 * Fire-and-forget: журнал — побічний ефект, тож збій запиту ніколи не має
 * заважати людині працювати. `keepalive` дає запиту дожити, навіть якщо
 * сторінку закривають одразу після переходу. Входи, виходи, відкриття
 * матеріалів і тести записує сам сервер — звідси шлемо лише навігацію.
 */

let lastPage: string | null = null;

export const trackNavigation = (page: string, title?: string) => {
  // Повторний рендер з тією самою вкладкою — не новий перехід.
  if (page === lastPage) return;
  lastPage = page;
  try {
    void fetch('/api/v2/activity/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'NAVIGATE', page, title }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // ігноруємо: журнал не критичний
  }
};

/** Після виходу наступний вхід має записати свій перший розділ заново. */
export const resetNavigationTracking = () => {
  lastPage = null;
};
