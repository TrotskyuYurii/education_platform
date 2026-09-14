import fs from 'fs';
let file = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

file = file.replace(
  '  Trash2, UserProgress, InstructionSection } from \'../types\';',
  '  UserProgress, InstructionSection } from \'../types\';'
);

file = file.replace(
  '  CheckCircle2,',
  '  CheckCircle2,\n  Trash2,'
);

fs.writeFileSync('src/components/Dashboard.tsx', file);
