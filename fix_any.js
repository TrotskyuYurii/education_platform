import * as fs from 'fs';
import * as path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix implicit 'any' on 'prev'
  content = content.replace(/\(prev => /g, '(prev: any => ');
  content = content.replace(/\(prev: any => /g, '((prev: any) => '); // Fix syntax just in case

  fs.writeFileSync(filePath, content);
}

fixFile(path.join(process.cwd(), 'src/components/TestManagement.tsx'));

console.log('Fixed implicit any');
