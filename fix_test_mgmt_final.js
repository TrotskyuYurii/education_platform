import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix handleSaveMarkdown back to original body
const handleSaveMarkdownWrongBodyRegex = /body: JSON\.stringify\(\{\s*email: selectedUser\.email,[\s\S]*?password: selectedUser\.newPassword \|\| undefined\s*\}\)/;
content = content.replace(handleSaveMarkdownWrongBodyRegex, 'body: JSON.stringify({ section: newSection, questions: newQuestions })');

// Now, handleUpdateUser is probably gone, let's inject it correctly before handleCreateDepartment
const injectHandleUpdateUser = `
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch(\`/api/admin/users/\${selectedUser._id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedUser.email,
          departments: selectedUser.departments,
          departmentId: selectedUser.departmentId,
          allowedInstructionIds: selectedUser.allowedInstructionIds,
          role: selectedUser.role,
          roleKeys: selectedUser.roleKeys || ['employee'],
          managerId: selectedUser.managerId,
          authMethod: selectedUser.authMethod,
          password: selectedUser.newPassword || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      alert('Помилка оновлення користувача');
    }
  };

  const handleCreateDepartment`;

content = content.replace("const handleCreateDepartment", injectHandleUpdateUser);

fs.writeFileSync(filePath, content);
console.log('Fixed TestManagement.tsx handleSaveMarkdown and handleUpdateUser');
