import fs from 'fs';
let file = fs.readFileSync('src/components/CourseCatalog.tsx', 'utf8');
file = file.replace(
  "import {",
  "import {\n  AlertTriangle,"
);
fs.writeFileSync('src/components/CourseCatalog.tsx', file);
