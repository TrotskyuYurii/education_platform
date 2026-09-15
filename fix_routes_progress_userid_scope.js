import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

const getProgressUserIdRegex = /apiRouter\.get\('\/admin\/progress\/:userId', requireAuth, requireAdmin, async \(req, res\) => \{[\s\S]*?res\.json\(\{ user: targetUser, progress \}\);\n  \} catch \(err\) \{[\s\S]*?\}\n\}\);/;

const newGetProgressUserId = `apiRouter.get('/admin/progress/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Authorization check
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const filter = await scopeFilter((req as any).user, 'analytics.report.view');
    
    if (filter._id === null) return res.status(403).json({ error: 'Access denied' });
    
    // Ensure the requested user matches the filter (e.g. if scope is 'team', userId must be in their team)
    const accessFilter = { ...filter, _id: userId };
    
    // Workaround for $or logic in team scope combined with specific user: 
    // we just check if the user is in the filtered list of ALL users they can see
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
    } else {
      const currentSections = await Section.find({} as any, { id: 1 } as any);
      const validSectionIds = new Set(currentSections.map(s => s.id));
      const rawIds: string[] = progress.readSectionIds || [];
      const cleanIds = rawIds.filter((id: string) => validSectionIds.has(id));
      if (cleanIds.length !== rawIds.length) {
        progress.readSectionIds = cleanIds;
        await progress.save();
      }
    }

    res.json({ user: targetUser, progress });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});`;

content = content.replace(getProgressUserIdRegex, newGetProgressUserId);
fs.writeFileSync(filePath, content);
console.log('Fixed progress/:userId scope');
