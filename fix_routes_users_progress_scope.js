import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Also update admin/users-progress scope
const getUsersProgressRegex = /apiRouter\.get\('\/admin\/users-progress', requireAuth, requireAdmin, async \(req, res\) => \{[\s\S]*?res\.json\(\{ users \}\);\n  \} catch \(err\) \{[\s\S]*?\}\n\}\);/;

const newGetUsersProgress = `apiRouter.get('/admin/users-progress', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const filter = await scopeFilter((req as any).user, 'analytics.report.view');
    
    if (filter._id === null) return res.status(403).json({ error: 'Access denied' });

    const users = await User.find(filter).select('-passwordHash');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});`;

content = content.replace(getUsersProgressRegex, newGetUsersProgress);

fs.writeFileSync(filePath, content);
console.log('Fixed users-progress scope');
