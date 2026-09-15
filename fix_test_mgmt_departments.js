import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Also update initial state and nav clicks if 'departments' was hardcoded
content = content.replace(/setActiveTab\('departments'\)/g, "setActiveTab('organization')");
content = content.replace(/'departments'/g, "'organization'");

fs.writeFileSync(filePath, content);
console.log('Fixed hardcoded departments');
