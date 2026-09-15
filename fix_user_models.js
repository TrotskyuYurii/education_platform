import * as fs from 'fs';

const filePath = 'server/models.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace departmentSchema definition
content = content.replace(
  /const departmentSchema = new mongoose\.Schema\(\{[\s\S]*?\}\);/,
  `const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  headUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const positionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  grade: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String },
  country: { type: String },
  timezone: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});`
);

// Add to exports
content = content.replace(
  /export const Department = mongoose\.models\.Department \|\| mongoose\.model\('Department', departmentSchema\);/,
  `export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);\nexport const Position = mongoose.models.Position || mongoose.model('Position', positionSchema);\nexport const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);`
);

// Add new fields to userSchema
content = content.replace(
  /createdAt: \{ type: Date, default: Date\.now \}/,
  `createdAt: { type: Date, default: Date.now },
  fullName: { type: String },
  avatarUrl: { type: String },
  phone: { type: String },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hireDate: { type: Date },
  isActive: { type: Boolean, default: true },
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }`
);

fs.writeFileSync(filePath, content);
console.log('Fixed models.ts');
