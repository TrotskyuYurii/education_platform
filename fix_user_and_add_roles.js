import * as fs from 'fs';

const filePath = 'server/models.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Role schema
const roleSchemaStr = `
const roleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  permissions: [{
    permission: { type: String, required: true },
    scope: { type: String, enum: ['self', 'team', 'department', 'all'], required: true }
  }],
  isSystem: { type: Boolean, default: false }
});
`;

if (!content.includes('roleSchema = new mongoose.Schema')) {
  content = content.replace('const progressSchema', roleSchemaStr + '\nconst progressSchema');
}

// 2. Export Role
if (!content.includes('mongoose.models.Role')) {
  content += `\nexport const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);`;
}

// 3. Add roleKeys to User
if (!content.includes('roleKeys: { type: [String]')) {
  content = content.replace(
    /role: \{ type: String, enum: \['user', 'admin'\], default: 'user' \},/,
    `role: { type: String, enum: ['user', 'admin'], default: 'user' },\n  roleKeys: { type: [String], default: ['employee'] },`
  );
}

fs.writeFileSync(filePath, content);
console.log('Added Role schema and roleKeys to User');
