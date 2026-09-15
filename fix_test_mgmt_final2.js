import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The multi-select UI in User edit modal needs roles!
// Let's check how roles are being rendered.
