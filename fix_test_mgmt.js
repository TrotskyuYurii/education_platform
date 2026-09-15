import * as fs from 'fs';

const filePath = 'src/components/TestManagement.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Import OrganizationSettings
content = content.replace(
  "import { BookOpen,",
  "import { OrganizationSettings } from './Admin/OrganizationSettings';\nimport { BookOpen,"
);

// 2. Rename tab from departments to organization
content = content.replace(
  "activeTab === 'departments'",
  "activeTab === 'organization'"
);
content = content.replace(
  "activeTab === 'departments'",
  "activeTab === 'organization'"
);
content = content.replace(
  "activeTab === 'departments'",
  "activeTab === 'organization'"
);

// 3. Replace the entire content of departments tab with <OrganizationSettings />
// Wait, the old code is:
//           {activeTab === 'departments' && (
//             <div className="space-y-6">
//               <div className="border-b border-slate-100 pb-4">
// ...
//           )}

const oldTabRegex = /\{activeTab === 'organization' && \([\s\S]*?Створюйте підрозділи для структурування інструкцій та доступу користувачів\.[\s\S]*?<\/div>[\s\n]*\)\}/;
content = content.replace(
  oldTabRegex,
  "{activeTab === 'organization' && <OrganizationSettings />}"
);

// 4. Change the text in the sidebar tab:
content = content.replace(
  /<span>Підрозділи<\/span>/g,
  "<span>Організація</span>"
);

fs.writeFileSync(filePath, content);
console.log('Fixed TestManagement.tsx for organization tab');
