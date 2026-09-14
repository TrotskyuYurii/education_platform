import fs from 'fs';
let file = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

if (!file.includes('Trash2,')) {
  file = file.replace(
    'import {',
    'import {\n  Trash2,'
  );
  fs.writeFileSync('src/components/Dashboard.tsx', file);
}
