import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// I will just add editingCourseId and stuff
const moreMissingStates = `
  const [createCourseInstSearch, setCreateCourseInstSearch] = useState('');
  const [editCourseInstFilter, setEditCourseInstFilter] = useState('');
  const [editCourseInstSearch, setEditCourseInstSearch] = useState('');
`;

content = content.replace('const [users, setUsers] = useState<any[]>([]);', moreMissingStates + 'const [users, setUsers] = useState<any[]>([]);');

fs.writeFileSync(filePath, content);
console.log('Fixed more states');
