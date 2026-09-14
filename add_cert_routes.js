import fs from 'fs';
let file = fs.readFileSync('server/routes.ts', 'utf8');

const routesToAdd = `
// Admin: Delete a user's certificate
apiRouter.delete('/admin/progress/:userId/certificate/:courseId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    let progress = await Progress.findOne({ userId } as any);
    if (!progress) {
      return res.status(404).json({ error: 'Прогрес не знайдено' });
    }

    const certIndex = progress.certificates.findIndex((c: any) => c.courseId === courseId);
    if (certIndex === -1) {
      return res.status(404).json({ error: 'Сертифікат не знайдено' });
    }

    const cert = progress.certificates[certIndex];
    progress.certificates.splice(certIndex, 1);

    // Add notification
    progress.notifications.push({
      id: Math.random().toString(36).substring(7),
      message: \`Ваш сертифікат за курс «\${cert.courseTitle}» був анульований адміністратором.\`,
      date: new Date(),
      read: false
    });

    await progress.save();
    res.json({ success: true, progress });
  } catch (err) {
    console.error('Failed to delete certificate', err);
    res.status(500).json({ error: 'Не вдалося видалити сертифікат' });
  }
});

// User: Mark notification as read
apiRouter.post('/progress/notifications/:id/read', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    let progress = await Progress.findOne({ userId: req.user._id } as any);
    if (progress) {
      const notif = progress.notifications.find((n: any) => n.id === id);
      if (notif) {
        notif.read = true;
        await progress.save();
      }
      res.json({ success: true, progress });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});
`;

if (!file.includes('/admin/progress/:userId/certificate/:courseId')) {
  file = file.replace(
    "// Admin: Get full progress for a specific user",
    routesToAdd + "\n\n// Admin: Get full progress for a specific user"
  );
  fs.writeFileSync('server/routes.ts', file);
}
