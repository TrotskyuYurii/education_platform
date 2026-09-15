import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const missingStates = `
  const [newCourse, setNewCourse] = useState<any>({ title: '', department: '', instructionIds: [] });
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [createCourseInstFilter, setCreateCourseInstFilter] = useState('');
  const [createCourseInstSearch, setCreateCourseInstSearch] = useState('');
  const [editCourseInstFilter, setEditCourseInstFilter] = useState('');
  const [editCourseInstSearch, setEditCourseInstSearch] = useState('');
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newCase, setNewCase] = useState<any>({ title: '', instructionIds: [], scenario: '', expectedResult: '', maxScore: 100, passScore: 80 });

  const handleDeleteCourse = async (id: string) => { setIsDeletingCourse(true); try { await fetch('/api/admin/courses/' + id, { method: 'DELETE' }); } catch(e){} finally { setIsDeletingCourse(false); setDeletingCourseId(null); } };
  
`;

content = content.replace('const [users, setUsers] = useState<any[]>([]);', missingStates + 'const [users, setUsers] = useState<any[]>([]);');

fs.writeFileSync(filePath, content);
console.log('Fixed more states');
