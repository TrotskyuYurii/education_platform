import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/Argument of type '\{ id: string; title: string;/g, ""); // Let's find it.
