import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/const \[createCourseInstSearch, setCreateCourseInstSearch\] = useState\(''\);\n/g, '');
content = content.replace(/const \[editCourseInstFilter, setEditCourseInstFilter\] = useState\(''\);\n/g, '');
content = content.replace(/const \[editCourseInstSearch, setEditCourseInstSearch\] = useState\(''\);\n/g, '');

const missingStates = `
  const [createCourseInstSearch, setCreateCourseInstSearch] = useState('');
  const [editCourseInstFilter, setEditCourseInstFilter] = useState('');
  const [editCourseInstSearch, setEditCourseInstSearch] = useState('');
`;

content = content.replace('const [users, setUsers] = useState<any[]>([]);', missingStates + 'const [users, setUsers] = useState<any[]>([]);');


fs.writeFileSync(filePath, content);
console.log('Fixed more states');
