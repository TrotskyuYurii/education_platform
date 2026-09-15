import * as fs from 'fs';
const filePath = 'server/models.ts';
let content = fs.readFileSync(filePath, 'utf8');

// The replacement matched twice or there was a default one.
content = content.replace(/managerId: \{ type: mongoose\.Schema\.Types\.ObjectId, ref: 'User' \},\n/g, '');
content = content.replace(/managerId: \{ type: mongoose\.Schema\.Types\.ObjectId, ref: 'User', default: null \},\n  managerId: \{ type: mongoose\.Schema\.Types\.ObjectId, ref: 'User', default: null \},/g, "managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },");

fs.writeFileSync(filePath, content);
console.log('Fixed dup in User schema');
