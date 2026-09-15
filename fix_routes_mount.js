import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Add import
content = content.replace(
  /export const apiRouter = Router\(\);/,
  "import { orgRouter } from './modules/org/routes.js';\nexport const apiRouter = Router();"
);

// Mount router
content = content.replace(
  /export const apiRouter = Router\(\);/,
  "export const apiRouter = Router();\n\napiRouter.use('/v2/org', requireAuth, orgRouter);"
);

fs.writeFileSync(filePath, content);
console.log('Mounted orgRouter');
