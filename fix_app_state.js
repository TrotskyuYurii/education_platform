import fs from 'fs';
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
  '    quizHistory: [],',
  '    quizHistory: [],\n    certificates: [],\n    notifications: [],'
);

fs.writeFileSync('src/App.tsx', file);
