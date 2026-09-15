import * as fs from 'fs';
const filePath = 'src/components/QuizRunner.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /currentQ\.options\.map/g,
  "(currentQ.options || []).map"
);

fs.writeFileSync(filePath, content);
console.log('Fixed options map in QuizRunner');
