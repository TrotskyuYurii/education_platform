import * as fs from 'fs';
import * as path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix editingCourse is possibly null
  content = content.replace(/setEditingCourse\(\{\s*\.\.\.editingCourse,/g, 'setEditingCourse(prev => !prev ? null : { ...prev,');
  content = content.replace(/setEditingCourse\(\{\s*\.\.\.editingCourse\s*,/g, 'setEditingCourse(prev => !prev ? null : { ...prev,');
  content = content.replace(/editingCourse\./g, 'editingCourse?.');
  content = content.replace(/editingCourse\?/g, 'editingCourse?.');
  content = content.replace(/editingCourse\?\.\./g, 'editingCourse?.'); // Cleanup

  // Fix other editing states
  content = content.replace(/setEditingInst\(\{\s*\.\.\.editingInst,/g, 'setEditingInst(prev => !prev ? null : { ...prev,');
  content = content.replace(/editingInst\./g, 'editingInst?.');
  
  content = content.replace(/setEditingCase\(\{\s*\.\.\.editingCase,/g, 'setEditingCase(prev => !prev ? null : { ...prev,');
  content = content.replace(/editingCase\./g, 'editingCase?.');

  fs.writeFileSync(filePath, content);
}

fixFile(path.join(process.cwd(), 'src/components/TestManagement.tsx'));

console.log('Fixed TestManagement.tsx');
