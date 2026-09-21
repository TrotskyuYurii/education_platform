import multer from 'multer';

/**
 * Приймач завантажених файлів для всіх маршрутів API.
 *
 * `defParamCharset: 'utf8'` тут критичний: multer за замовчуванням читає імена
 * файлів у multipart-запиті як latin1, тож «Автоматизація.docx» перетворювалось
 * на «ÐÐ²ÑÐ¾Ð¼Ð°ÑÐ¸Ð·Ð°ÑÑÑ.docx» — і в панелі прогресу, і в назві
 * збереженого оригіналу документа. Браузери надсилають імена в UTF-8.
 */
export const upload = multer({
  dest: 'uploads/',
  defParamCharset: 'utf8'
});
