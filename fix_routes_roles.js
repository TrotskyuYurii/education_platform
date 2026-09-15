import * as fs from 'fs';

const filePath = 'server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Rewrite requireAdmin
const requireAdminCode = `
import { requirePermission } from './modules/core/permissions.js';
import { Role } from './models.js';

// Temporarily map old requireAdmin to new permission system for backward compatibility
const requireAdmin = requirePermission('admin.access');
`;

content = content.replace(
  /const requireAdmin = \(req: any, res: any, next: any\) => \{[\s\S]*?next\(\);\n\};/,
  requireAdminCode
);

// 2. Add Roles fetching API
const rolesApiCode = `
apiRouter.get('/admin/roles', requireAuth, requireAdmin, async (req, res) => {
  const roles = await Role.find({});
  res.json({ roles });
});
`;

content = content.replace(
  /apiRouter\.get\('\/admin\/users'/,
  rolesApiCode + "\napiRouter.get('/admin/users'"
);

// 3. Update PUT /admin/users/:id to handle roles and departments sync
const putUserRegex = /apiRouter\.put\('\/admin\/users\/:id', requireAuth, requireAdmin, async \(req, res\) => \{[\s\S]*?res\.json\(\{ user, message: 'Користувача оновлено' \}\);\n  \} catch \(err\) \{[\s\S]*?\}\n\}\);/;

const newPutUser = `apiRouter.put('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { departments, departmentId, allowedInstructionIds, role, roleKeys, email, password, authMethod, managerId } = req.body;
    
    if (!email || !email.toLowerCase().endsWith('@viatec.ua')) {
      return res.status(400).json({ error: 'Email є обов\\'язковим і має бути в домені @viatec.ua' });
    }

    const updateData: any = {
      allowedInstructionIds: allowedInstructionIds || [],
      email: email.toLowerCase().trim(),
      authMethod,
      role: role || 'user',
      roleKeys: roleKeys || ['employee'],
      managerId: managerId || null
    };
    
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    
    // Resolve Departments Sync (String array vs ObjectId)
    if (departmentId) {
      updateData.departmentId = departmentId;
      const d = await Department.findById(departmentId);
      if (d) updateData.departments = [d.name];
    } else if (departments && departments.length > 0) {
      updateData.departments = departments;
      const d = await Department.findOne({ name: departments[0] });
      if (d) updateData.departmentId = d._id;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });

    res.json({ user, message: 'Користувача оновлено' });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});`;

content = content.replace(putUserRegex, newPutUser);

// 4. Update POST /admin/users
const postUserRegex = /apiRouter\.post\('\/admin\/users', requireAuth, requireAdmin, async \(req, res\) => \{[\s\S]*?res\.status\(201\)\.json\(\{ user, message: 'Користувача створено' \}\);\n  \} catch \(err\) \{[\s\S]*?\}\n\}\);/;

const newPostUser = `apiRouter.post('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, departments, departmentId, role, roleKeys, managerId } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Заповніть всі обов\\'язкові поля' });
    }

    if (!email.toLowerCase().endsWith('@viatec.ua')) {
      return res.status(400).json({ error: 'Email має бути в домені @viatec.ua' });
    }

    const exists = await User.findOne({ 
      $or: [{ username }, { email: email.toLowerCase().trim() }] 
    } as any);

    if (exists) {
      return res.status(400).json({ error: 'Користувач з таким логіном або email вже існує' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const createData: any = {
      username,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'user',
      roleKeys: roleKeys || ['employee'],
      managerId: managerId || null
    };

    if (departmentId) {
      createData.departmentId = departmentId;
      const d = await Department.findById(departmentId);
      if (d) createData.departments = [d.name];
    } else if (departments && departments.length > 0) {
      createData.departments = departments;
      const d = await Department.findOne({ name: departments[0] });
      if (d) createData.departmentId = d._id;
    } else {
      createData.departments = ['Всі підрозділи'];
      const d = await Department.findOne({ name: 'Всі підрозділи' });
      if (d) createData.departmentId = d._id;
    }

    const user = await User.create(createData as any);
    res.status(201).json({ user, message: 'Користувача створено' });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера при створенні' });
  }
});`;

content = content.replace(postUserRegex, newPostUser);

fs.writeFileSync(filePath, content);
console.log('Fixed User CRUD to support roles, manager, and department sync');
