import fs from 'fs';
let file = fs.readFileSync('src/components/QuizRunner.tsx', 'utf8');

if (!file.includes('Trophy,')) {
  file = file.replace('Award,', 'Award, Trophy,');
}
fs.writeFileSync('src/components/QuizRunner.tsx', file);
