import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The replacement was likely slightly malformed and deleted lines. Let's fix missing state:
// Find where user states should be.
const stateRegex = /const \[users, setUsers\] = useState<any\[\]>\(\[\]\);/;
content = content.replace(stateRegex, `const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<any>({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });
  const [userMsg, setUserMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
`);

// Add missing functions if they are gone. Wait, handleCreateUser is missing? Let's check if it exists:
const handleCreateUserRegex = /const handleCreateUser =/;
if (!handleCreateUserRegex.test(content)) {
  const fetchDepsRegex = /const fetchDepartments = async \(\) => \{[\s\S]*?catch \(err\) \{\}\s*\};\s*/;
  content = content.replace(fetchDepsRegex, match => match + `
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
`);
}

fs.writeFileSync(filePath, content);
console.log('Fixed missing states in TestManagement');
