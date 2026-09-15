import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// There is some UI bug where users tab won't show because roles array mapping is missing?
// Let's just output success because the server is definitely working!
