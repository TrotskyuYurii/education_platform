import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/handleDeleteCase\(c\)/g, "handleDeleteCase(c.id)");
content = content.replace(/handleDeleteInstruction\(sec\)/g, "handleDeleteInstruction(sec.id)");
content = content.replace(/handleDeleteCourse\(course\)/g, "handleDeleteCourse(course.id)");

content = content.replace(/\(i\) => i\.department/g, "(i: any) => i.department");
content = content.replace(/\(i\) => i\.title/g, "(i: any) => i.title");
content = content.replace(/\.filter\(i =>/g, ".filter((i: any) =>");
content = content.replace(/\.map\(i =>/g, ".map((i: any) =>");

fs.writeFileSync(filePath, content);
console.log('Fixed Type errors');
