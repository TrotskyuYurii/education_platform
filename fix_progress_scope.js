import * as fs from 'fs';
const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /apiRouter\.get\('\/admin\/progress\/:userId', requireAuth, requireAdmin, async \(req, res\) => \{[\s\S]*?res\.json\(\{ user: targetUser, progress \}\);\n  \} catch \(err\) \{[\s\S]*?\}\n\}\);/;

const newRoute = `apiRouter.get('/admin/progress/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const filter = await scopeFilter((req as any).user, 'analytics.report.view');
    
    if (filter._id === null) return res.status(403).json({ error: 'Access denied' });

    const allowedUsers = await User.find(filter).select('_id');
    const isAllowed = allowedUsers.some(u => u._id.toString() === userId);
    
    if (!isAllowed) {
       return res.status(403).json({ error: 'Access denied: User not in your scope' });
    }

    const targetUser = await User.findOne({ _id: userId } as any).select('-passwordHash -authCode');
    if (!targetUser) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }

    let progress = await Progress.findOne({ userId: targetUser._id } as any);
    if (!progress) {
      progress = {
        userId: targetUser._id,
        readSectionIds: [],
        testScores: [],
        certificates: [],
        employeeInfo: null
      } as any;
    }

    res.json({ user: targetUser, progress });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});`;

content = content.replace(regex, newRoute);
fs.writeFileSync(filePath, content);
console.log('Fixed GET progress/:userId API scope.');
