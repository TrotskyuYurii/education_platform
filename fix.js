import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/handleDeleteInstruction\(inst\)/g, 'handleDeleteInstruction(inst.id)');

fs.writeFileSync(filePath, content);
console.log('Fixed argument types');
