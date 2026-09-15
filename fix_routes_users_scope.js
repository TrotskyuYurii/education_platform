import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /apiRouter\.get\('\/admin\/users', requireAuth, requireAdmin, async \(req, res\) => \{[\s\S]*?res\.json\(\{ users \}\);\n  \} catch \(err\) \{[\s\S]*?\}\n\}\);/;

const newGetUsers = `apiRouter.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const filter = await scopeFilter((req as any).user, 'users.profile.view');
    
    // If _id is null, it means no access
    if (filter._id === null) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await User.find(filter).select('-passwordHash');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});`;

content = content.replace(regex, newGetUsers);
fs.writeFileSync(filePath, content);
console.log('Fixed users view scope');
