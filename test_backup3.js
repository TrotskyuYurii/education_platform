import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// I will just add editingCourseId and stuff
const moreMissingStates = `
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDep, setEditingCourseDep] = useState<string>('');
  const [editingInstIsActive, setEditingInstIsActive] = useState<boolean>(true);
  const [deletingInstId, setDeletingInstId] = useState<string | null>(null);
  const [isDeletingInst, setIsDeletingInst] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [isDeletingDep, setIsDeletingDep] = useState(false);
  const [deletingDepId, setDeletingDepId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } catch (err) {}
  };
  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/admin/departments');
      const data = await res.json();
      if (res.ok) setDepartments(data.departments);
    } catch (err) {}
  };
  const handleDeleteInstruction = async (id: string) => { setIsDeletingInst(true); try { await fetch('/api/admin/instructions/' + id, { method: 'DELETE' }); } catch(e){} finally { setIsDeletingInst(false); setDeletingInstId(null); } };

`;

content = content.replace('const [users, setUsers] = useState<any[]>([]);', moreMissingStates + 'const [users, setUsers] = useState<any[]>([]);');

content = content.replace(/const \[setNewCase, setNewCaseSetter\] = useState<any>\(null\);/g, ''); // Fix redeclare block-scoped variable

// Add handleCreateUser
const handleCreateUserFunc = `
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    const cleanEmail = newUser.email.trim().toLowerCase();
    
    if (!cleanEmail.endsWith('@viatec.ua')) {
      setUserMsg({ type: 'error', text: 'Email має бути виключно в домені @viatec.ua' });
      return;
    }

    if (!newUser.password) {
      setUserMsg({ type: 'error', text: 'Пароль є обов\\'язковим полем' });
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: cleanEmail, 
          username: newUser.username, 
          password: newUser.password, 
          role: newUser.role, 
          roleKeys: newUser.roleKeys, 
          departmentId: newUser.departmentId, 
          managerId: newUser.managerId 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setUserMsg({ type: 'success', text: \`Користувача \${cleanEmail} успішно створено!\` });
      setNewUser({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
    }
  };
`;
if (!content.includes('const handleCreateUser =')) {
  content = content.replace('const handleDeleteCase', handleCreateUserFunc + '\\n  const handleDeleteCase');
}

// Fix 'setNewCase' redeclaration line 67 / 80
content = content.replace(/const \[setNewCase, setNewCaseSetter\] = useState<any>\(null\); \/\/ dummy if missing\n/g, '');


fs.writeFileSync(filePath, content);
console.log('Fixed more states');
