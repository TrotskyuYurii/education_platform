import * as fs from 'fs';
const filePath = 'server/modules/core/permissions.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Debug print the scope filter to see if it makes sense
console.log(content);
