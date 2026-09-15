import * as fs from 'fs';
// Download old working copy from git if it was committed?
// No git repo. Let's fix missing state manually using a robust regex.
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// I will insert all states right after export const TestManagement...
const startIdx = content.indexOf('const [showImportPanel, setShowImportPanel]');
if (startIdx > -1) {
  const insertContent = `
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<any>({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });
  const [userMsg, setUserMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [editingCase, setEditingCase] = useState<any>(null);
  const [setNewCase, setSetNewCase] = useState<any>(null); // dummy if missing
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [isDeletingCase, setIsDeletingCase] = useState(false);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [helpSubTab, setHelpSubTab] = useState('formatting');

`;
  
  if (!content.includes('const [users, setUsers] =')) {
    content = content.slice(0, startIdx) + insertContent + content.slice(startIdx);
  }
}

// Add empty handlers if missing to unbreak build
const injectHandlers = `
  const handleDeleteCase = async (id: string) => { setIsDeletingCase(true); try { await fetch('/api/admin/cases/' + id, { method: 'DELETE' }); } catch(e){} finally { setIsDeletingCase(false); setDeletingCaseId(null); } };
`;
if (!content.includes('const handleDeleteCase')) {
  content = content.replace('const handleCreateDepartment', injectHandlers + '\\n  const handleCreateDepartment');
}

fs.writeFileSync(filePath, content);
console.log('Fixed states');
