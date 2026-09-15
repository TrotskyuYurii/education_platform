import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const updateRegex = /body: JSON\.stringify\(\{[\s\S]*?password: selectedUser\.newPassword \|\| undefined[\s\S]*?\}\)/;

content = content.replace(updateRegex, `body: JSON.stringify({
          email: selectedUser.email,
          departments: selectedUser.departments,
          departmentId: selectedUser.departmentId,
          allowedInstructionIds: selectedUser.allowedInstructionIds,
          role: selectedUser.role,
          roleKeys: selectedUser.roleKeys || ['employee'],
          managerId: selectedUser.managerId,
          authMethod: selectedUser.authMethod,
          password: selectedUser.newPassword || undefined
        })`);

fs.writeFileSync(filePath, content);
console.log('Fixed handleUpdateUser payload');
