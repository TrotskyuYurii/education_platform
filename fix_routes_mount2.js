import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Remove previous mount
content = content.replace("apiRouter.use('/v2/org', requireAuth, orgRouter);\n", "");

// Add mount after requireAuth
content = content.replace(
  /const requireAdmin = .*?next\(\);\n  \} catch \(err\) \{\n    res\.status\(401\)\.json\(\{ error: 'Unauthorized' \}\);\n  \}\n\};/s,
  match => match + "\n\n// --- Mount V2 Routers ---\napiRouter.use('/v2/org', requireAuth, orgRouter);"
);

fs.writeFileSync(filePath, content);
console.log('Fixed orgRouter mount');
