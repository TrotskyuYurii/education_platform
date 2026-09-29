// Виконується образом mongo лише один раз — при першій ініціалізації порожнього
// каталогу даних. Застосунок працює під окремим користувачем з правами тільки
// на свою базу; root лишається для бекапів і адміністрування.
const dbName = process.env.MONGO_DB;
const user = process.env.MONGO_APP_USER;
const pwd = process.env.MONGO_APP_PASSWORD;

if (!dbName || !user || !pwd) {
  throw new Error('MONGO_DB, MONGO_APP_USER and MONGO_APP_PASSWORD must be set');
}

db.getSiblingDB(dbName).createUser({
  user,
  pwd,
  roles: [{ role: 'readWrite', db: dbName }],
});
print(`Created application user "${user}" for database "${dbName}"`);
