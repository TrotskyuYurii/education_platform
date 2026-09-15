import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: newCase initialization
content = content.replace(
  "const [newCase, setNewCase] = useState<any>({ title: '', instructionIds: [], scenario: '', expectedResult: '', maxScore: 100, passScore: 80 });",
  "const [newCase, setNewCase] = useState<any>({ title: '', sectionId: '', scenario: '', expectedResult: '', maxScore: 100, passScore: 80, options: [{ id: 'opt-1', text: '', isCorrect: true, feedback: '' }], isActive: true });"
);

// Fix 2: Add fallback for editingCase / newCase options in map and length
content = content.replace(
  /\{\(editingCase \? editingCase\?\.options : newCase\.options\)\.map/g,
  "{(editingCase ? (editingCase?.options || []) : (newCase.options || [])).map"
);

content = content.replace(
  /const updatedOptions = \(editingCase \? editingCase\?\.options : newCase\.options\)\.map/g,
  "const updatedOptions = (editingCase ? (editingCase?.options || []) : (newCase.options || [])).map"
);

content = content.replace(
  /const updatedOptions = \[\.\.\.\(editingCase \? editingCase\?\.options : newCase\.options\)\]/g,
  "const updatedOptions = [...(editingCase ? (editingCase?.options || []) : (newCase.options || []))]"
);

content = content.replace(
  /\{\(editingCase \? editingCase\?\.options : newCase\.options\)\.length/g,
  "{(editingCase ? (editingCase?.options || []) : (newCase.options || [])).length"
);

content = content.replace(
  /const updatedOptions = \(editingCase \? editingCase\?\.options : newCase\.options\)\.filter/g,
  "const updatedOptions = (editingCase ? (editingCase?.options || []) : (newCase.options || [])).filter"
);

content = content.replace(
  /\.\.\.newCase\.options/g,
  "...(newCase.options || [])"
);

fs.writeFileSync(filePath, content);
console.log('Fixed options map in TestManagement');
