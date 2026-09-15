import * as fs from 'fs';
const filePath = 'src/components/CaseSimulator.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /currentCase\.options\.map/g,
  "(currentCase.options || []).map"
);

fs.writeFileSync(filePath, content);
console.log('Fixed options map in CaseSimulator');
