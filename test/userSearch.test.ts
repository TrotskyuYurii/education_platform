import { describe, it, expect } from 'vitest';

import { matchesUserQuery, userOptionLabel } from '../src/utils/userSearch.js';

/**
 * Пошук співробітника у формі призначення: за частиною ПІБ, email або логіна,
 * без огляду на регістр, порядок слів і різновид апострофа.
 */
describe('matchesUserQuery', () => {
  const user = { fullName: "Мар'яненко Петро Васильович", email: 'p.maryanenko@viatec.ua', username: 'pmaryanenko' };

  it('порожній запит пропускає всіх', () => {
    expect(matchesUserQuery(user, '')).toBe(true);
    expect(matchesUserQuery(user, '   ')).toBe(true);
  });

  it('знаходить за частиною прізвища без огляду на регістр', () => {
    expect(matchesUserQuery(user, 'МАР')).toBe(true);
    expect(matchesUserQuery(user, 'петро')).toBe(true);
  });

  it('знаходить за частиною email або логіна', () => {
    expect(matchesUserQuery(user, 'p.mary')).toBe(true);
    expect(matchesUserQuery(user, '@viatec')).toBe(true);
    expect(matchesUserQuery(user, 'pmaryan')).toBe(true);
  });

  it('кілька слів — кожне має знайтися, порядок не важливий', () => {
    expect(matchesUserQuery(user, 'петро мар')).toBe(true);
    expect(matchesUserQuery(user, 'петро іван')).toBe(false);
  });

  it('різні апострофи вважаються однаковими', () => {
    expect(matchesUserQuery(user, 'мар’ян')).toBe(true);
    expect(matchesUserQuery(user, 'марʼян')).toBe(true);
  });

  it('не знаходить відсутнього', () => {
    expect(matchesUserQuery(user, 'коваль')).toBe(false);
  });

  it('працює для користувача без ПІБ', () => {
    expect(matchesUserQuery({ username: 'guest' }, 'gue')).toBe(true);
  });
});

describe('userOptionLabel', () => {
  it('ПІБ з email у дужках', () => {
    expect(userOptionLabel({ fullName: 'Іван Петренко', email: 'i@viatec.ua' })).toBe('Іван Петренко (i@viatec.ua)');
  });

  it('лише логін, якщо ПІБ немає', () => {
    expect(userOptionLabel({ username: 'guest' })).toBe('guest');
  });
});
