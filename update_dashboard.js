import fs from 'fs';
let file = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Add Trash2 to lucide-react imports
if (!file.includes('Trash2')) {
  file = file.replace(
    'Award, \n  RotateCcw, \n  Search, \n  Building2,',
    'Award, \n  RotateCcw, \n  Search, \n  Building2,\n  Trash2,'
  );
  if (!file.includes('Trash2')) {
    file = file.replace(
      'import { \n  CheckCircle2,',
      'import { \n  Trash2,\n  CheckCircle2,'
    );
  }
}

// Add handleDeleteCertificate function
const deleteFunc = `
  const handleDeleteCertificate = async (courseId: string) => {
    if (!isAdmin || !selectedUserId) return;
    if (!confirm('Ви впевнені, що хочете анулювати цей сертифікат? Співробітник отримає сповіщення про це.')) return;

    try {
      const res = await fetch(\`/api/admin/progress/\${selectedUserId}/certificate/\${courseId}\`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Refresh target user's progress
        fetchSelectedUserProgress(selectedUserId);
      } else {
        alert('Помилка при видаленні сертифікату');
      }
    } catch (err) {
      console.error(err);
      alert('Помилка при видаленні сертифікату');
    }
  };
`;

if (!file.includes('handleDeleteCertificate')) {
  file = file.replace(
    '// Fetch selected user\'s detailed progress when selectedUserId changes',
    deleteFunc + '\n  // Fetch selected user\'s detailed progress when selectedUserId changes'
  );
}

// Update the certificate buttons
const newButtons = `
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedCertificate(cert)}
                          className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                        >
                          Переглянути сертифікат
                        </button>
                        {isAdmin && selectedUserId && (
                          <button
                            onClick={() => handleDeleteCertificate(cert.courseId)}
                            className="p-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-100 transition"
                            title="Анулювати сертифікат"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
`;

file = file.replace(
  /<button \s*onClick=\{\(\) => setSelectedCertificate\(cert\)\}\s*className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"\s*>\s*Переглянути сертифікат\s*<\/button>/g,
  newButtons
);

fs.writeFileSync('src/components/Dashboard.tsx', file);
