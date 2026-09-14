import fs from 'fs';
let file = fs.readFileSync('src/types.ts', 'utf8');

if (!file.includes('notifications?:')) {
  file = file.replace(
    '  certificates?: Array<{',
    '  notifications?: Array<{\n    id: string;\n    message: string;\n    date: string;\n    read: boolean;\n  }>;\n  certificates?: Array<{'
  );
  fs.writeFileSync('src/types.ts', file);
}
