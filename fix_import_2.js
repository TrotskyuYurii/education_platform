import fs from 'fs';
let file = fs.readFileSync('src/components/CourseCatalog.tsx', 'utf8');

// The regex might have matched the wrong import.
// Remove it from types.ts import
file = file.replace(
  "  AlertTriangle, InstructionSection } from '../types';",
  "  InstructionSection } from '../types';"
);

// Add it to lucide-react import
file = file.replace(
  "import { \n  BookOpen,",
  "import { \n  BookOpen,\n  AlertTriangle,"
);

fs.writeFileSync('src/components/CourseCatalog.tsx', file);
