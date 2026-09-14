import fs from 'fs';
let file = fs.readFileSync('src/App.tsx', 'utf8');

// Add notifications to the initial state
if (!file.includes('notifications: [],')) {
  file = file.replace(
    'certificates: [],',
    'certificates: [],\n    notifications: [],'
  );
}

// Add notifications to the fetch response mapping
if (!file.includes('notifications: data.progress.notifications || [],')) {
  file = file.replace(
    'certificates: data.progress.certificates || [],',
    'certificates: data.progress.certificates || [],\n          notifications: data.progress.notifications || [],'
  );
}

fs.writeFileSync('src/App.tsx', file);
