import * as fs from 'fs';
const filePath = 'server/models.ts';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('roleKeys: { type: [String], default: ["employee"] }')) {
  content = content.replace("role: { type: String, default: 'user' },", "role: { type: String, default: 'user' },\n  roleKeys: { type: [String], default: ['employee'] },");
}
if (!content.includes("managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }")) {
  content = content.replace("departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },", "departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },\n  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },");
}
fs.writeFileSync(filePath, content);
console.log('Fixed User schema');
