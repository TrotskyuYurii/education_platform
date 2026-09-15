import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Add mount after requireAdmin
content = content.replace(
  /const requireAdmin = \(req: any, res: any, next: any\) => \{[\s\S]*?next\(\);\n\};/,
  match => match + "\n\n// --- Mount V2 Routers ---\napiRouter.use('/v2/org', requireAuth, orgRouter);"
);

fs.writeFileSync(filePath, content);
console.log('Fixed orgRouter mount properly');
