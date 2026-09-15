import * as fs from 'fs';
const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/handleDeleteInstruction\(sec\)/g, "handleDeleteInstruction(sec.id)");
content = content.replace(/handleDeleteCourse\(course\)/g, "handleDeleteCourse(course.id)");
content = content.replace(/handleDeleteCourse\(c\)/g, "handleDeleteCourse(c.id)");
content = content.replace(/handleDeleteCase\(c\)/g, "handleDeleteCase(c.id)");
content = content.replace(/handleDeleteInstruction\(c\)/g, "handleDeleteInstruction(c.id)");

fs.writeFileSync(filePath, content);
console.log('Fixed argument types');
