/**
 * Пошук користувача за частиною ПІБ або email / логіна.
 *
 * Запит розбивається на слова, і кожне слово має знайтися хоч десь — тож
 * «петро іван» знайде «Іваненко Петро Васильович», а «ivanenko@» — email.
 * Регістр і апостроф (’ ' ʼ) не мають значення.
 */
export interface SearchableUser {
  fullName?: string;
  email?: string;
  username?: string;
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ').trim();

export const userSearchText = (u: SearchableUser) =>
  normalize([u.fullName, u.email, u.username].filter(Boolean).join(' '));

export function matchesUserQuery(u: SearchableUser, query: string): boolean {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const text = userSearchText(u);
  return words.every(word => text.includes(word));
}

/** Підпис користувача у списку: «ПІБ (email)» або лише логін. */
export const userOptionLabel = (u: SearchableUser) => {
  const login = u.email || u.username || '';
  return u.fullName ? `${u.fullName}${login ? ` (${login})` : ''}` : login;
};
