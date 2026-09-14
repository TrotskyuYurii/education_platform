import fs from 'fs';

let file = fs.readFileSync('src/components/CourseCatalog.tsx', 'utf8');

// Add certificates to props interface
file = file.replace(
  'interface CourseCatalogProps {',
  `interface CourseCatalogProps {\n  certificates?: Array<{ courseId: string; courseTitle: string; issuedAt: string; expiresAt: string; }>;`
);

// Add certificates to component args
file = file.replace(
  'onStartCourseQuiz\n}) => {',
  'onStartCourseQuiz,\n  certificates = []\n}) => {'
);

fs.writeFileSync('src/components/CourseCatalog.tsx', file);
