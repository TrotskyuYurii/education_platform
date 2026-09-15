import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update state definitions to include roleKeys and managerId
content = content.replace(
  /const \[newUser, setNewUser\] = useState\(\{ email: '', username: '', password: '', role: 'user', department: '' \}\);/,
  "const [newUser, setNewUser] = useState({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });"
);

content = content.replace(
  /const \[editingUser, setEditingUserObj\] = useState<any>\(null\);/,
  "const [editingUser, setEditingUserObj] = useState<any>(null);\n  const [roles, setRoles] = useState<any[]>([]);"
);

// 2. Fetch roles
const fetchUsersRegex = /const fetchUsers = async \(\) => \{[\s\S]*?if \(res\.ok\) setUsers\(data\.users\);[\s\S]*?catch \(err\) \{\}[\s\S]*?\};/;
content = content.replace(
  fetchUsersRegex,
  match => match + "\n\n  const fetchRoles = async () => {\n    try {\n      const res = await fetch('/api/admin/roles');\n      if (res.ok) setRoles((await res.json()).roles);\n    } catch (err) {}\n  };"
);

// Add fetchRoles to the tab effect
content = content.replace(
  /if \(\['organization', 'users', 'list', 'courses'\]\.includes\(activeTab\)\) fetchDepartments\(\);/,
  "if (['organization', 'users', 'list', 'courses'].includes(activeTab)) fetchDepartments();\n    if (activeTab === 'users') fetchRoles();"
);

// 3. Update User form POST and PUT
content = content.replace(
  /body: JSON\.stringify\(\{\s*email: cleanEmail,\s*username: newUser\.username,\s*password: newUser\.password,\s*role: newUser\.role,\s*departments: newUser\.department \? \[newUser\.department\] : \['Всі підрозділи'\]\s*\}\)/,
  "body: JSON.stringify({ email: cleanEmail, username: newUser.username, password: newUser.password, role: newUser.role, roleKeys: newUser.roleKeys, departmentId: newUser.departmentId, managerId: newUser.managerId })"
);

content = content.replace(
  /body: JSON\.stringify\(\{\s*email: editingUser\.email,\s*password: editingUser\.newPassword \|\| undefined,\s*role: editingUser\.role,\s*departments: editingUser\.departments,\s*allowedInstructionIds: editingUser\.allowedInstructionIds,\s*authMethod: editingUser\.authMethod\s*\}\)/,
  "body: JSON.stringify({ email: editingUser.email, password: editingUser.newPassword || undefined, role: editingUser.role, roleKeys: editingUser.roleKeys || ['employee'], departmentId: editingUser.departmentId, departments: editingUser.departments, allowedInstructionIds: editingUser.allowedInstructionIds, authMethod: editingUser.authMethod, managerId: editingUser.managerId })"
);

// 4. Reset User Form
content = content.replace(
  /setNewUser\(\{ email: '', username: '', password: '', role: 'user', department: '' \}\);/,
  "setNewUser({ email: '', username: '', password: '', role: 'user', roleKeys: ['employee'], departmentId: '', managerId: '' });"
);

fs.writeFileSync(filePath, content);
console.log('Fixed Users tab JS logic');
