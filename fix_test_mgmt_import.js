import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = "import { OrganizationSettings } from './Admin/OrganizationSettings';\n" + content;

fs.writeFileSync(filePath, content);
console.log('Added import');
