import fs from 'fs';

let file = fs.readFileSync('src/App.tsx', 'utf8');

// Find <CourseCatalog
file = file.replace(
  '<CourseCatalog\n            sections={sections}',
  '<CourseCatalog\n            certificates={progress.certificates || []}\n            sections={sections}'
);

fs.writeFileSync('src/App.tsx', file);
