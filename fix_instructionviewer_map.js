import * as fs from 'fs';
const filePath = 'src/components/InstructionViewer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /activeSection\.stopRules\.map/g,
  "(activeSection.stopRules || []).map"
);

content = content.replace(
  /activeSection\.systemAutomaticActions\.map/g,
  "(activeSection.systemAutomaticActions || []).map"
);

fs.writeFileSync(filePath, content);
console.log('Fixed options map in InstructionViewer');
