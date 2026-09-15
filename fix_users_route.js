import * as fs from 'fs';
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');
const oldUsersRoute = /apiRouter\.get\('\/admin\/users', requireAuth, requireAdmin, async \(req, res\) => \{\s*const users = await User\.find\(\)\.select\('-passwordHash -authCode'\);\s*res\.json\(\{ users \}\);\s*\}\);/;

const newUsersRoute = `
apiRouter.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const filter = await scopeFilter((req as any).user, 'users.profile.view');
    
    // If _id is null, it means no access
    if (filter._id === null) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await User.find(filter).select('-passwordHash -authCode');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});`;

content = content.replace(oldUsersRoute, newUsersRoute);
fs.writeFileSync(filePath, content);
console.log('Fixed GET users API scope.');
