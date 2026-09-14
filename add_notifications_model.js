import fs from 'fs';
let file = fs.readFileSync('server/models.ts', 'utf8');

if (!file.includes('notifications: [{')) {
  file = file.replace(
    '  certificates: [{',
    '  notifications: [{\n    id: String,\n    message: String,\n    date: { type: Date, default: Date.now },\n    read: { type: Boolean, default: false }\n  }],\n  certificates: [{'
  );
  fs.writeFileSync('server/models.ts', file);
}
