import fs from 'fs';
let file = fs.readFileSync('src/App.tsx', 'utf8');

if (!file.includes('const dismissNotification =')) {
  const dismissLogic = `
  const dismissNotification = async (notifId: string) => {
    // Optimistically update UI
    setProgress(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => n.id !== notifId)
    }));
    
    // Call API
    try {
      await fetch(\`/api/progress/notifications/\${notifId}/read\`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };
  `;

  file = file.replace(
    '  const handleStartQuiz =',
    dismissLogic + '\n  const handleStartQuiz ='
  );
}

const notifUI = `
      {/* Global Notifications */}
      {progress.notifications && progress.notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
          {progress.notifications.filter(n => !n.read).map(notif => (
            <div key={notif.id} className="bg-rose-50 border-l-4 border-rose-500 rounded-r-lg p-4 shadow-xl flex items-start justify-between gap-3 animate-in slide-in-from-right">
              <div>
                <h4 className="font-bold text-rose-800 text-sm mb-1">Важливе повідомлення</h4>
                <p className="text-xs text-rose-700">{notif.message}</p>
                <div className="text-[10px] text-rose-500 mt-2">{new Date(notif.date).toLocaleString('uk-UA')}</div>
              </div>
              <button 
                onClick={() => dismissNotification(notif.id)}
                className="text-rose-400 hover:text-rose-600 transition p-1"
                title="Закрити"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
`;

if (!file.includes('Global Notifications')) {
  file = file.replace(
    '<Navbar',
    notifUI + '\n      <Navbar'
  );
}

fs.writeFileSync('src/App.tsx', file);
