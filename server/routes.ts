import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { User, Section, Question, Progress, Department, Course, Case } from './models.js';
import { generateAuthCode, sendAuthCodeEmail } from './email.js';
import { loginRateLimiter, verifyCodeRateLimiter, resendCodeRateLimiter } from './modules/core/rateLimit.js';
import { upload } from './modules/core/uploads.js';
import {
  JWT_SECRET,
  SESSION_COOKIE_NAME,
  issueSessionCookie,
  clearSessionCookie,
  sessionPolicy
} from './modules/core/session.js';
import {
  savePendingUpload,
  openStoredFile,
  resolveVersionAsset,
  saveVersionAsset,
  listVersionAssets,
  copyVersionAssets,
  deleteDocumentStorage
} from './services/fileStorage.js';
import { sendStoredFile, sendStoredInline } from './services/fileDownload.js';
import { normalizeDocumentAssets, assetApiUrl } from './services/documentAssets.js';
import {
  generateInstructionFromDocument,
  InstructionGenerationError,
  describeAiError
} from './services/aiInstructionGenerator.js';
import { importInstructions } from './services/instructionImport.js';
import {
  AiImportJob,
  enqueueAiImportJob,
  serializeAiImportJob
} from './modules/knowledge/aiImportJobs.js';


/** Скільки документів дозволено віддати в одну пачку ШІ-обробки. */
const AI_IMPORT_MAX_FILES = 25;
/** Скільки завдань показувати в панелі прогресу. */
const AI_IMPORT_JOB_LIST_LIMIT = 6;

import { orgRouter } from './modules/org/routes.js';
import { peopleRouter } from './modules/people/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { analyticsRouter } from './modules/analytics/routes.js';
export const apiRouter = Router();


// Middleware to verify auth
//
// Навмисно НЕ продовжує сесію: строк життя токена = дозволений простій, і
// оновлює його лише /auth/heartbeat за реальною активністю користувача.
// Інакше фонові опитування застосунку тримали б сесію живою нескінченно.
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId } as any);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err: any) {
    // Окремий код, щоб клієнт відрізняв «сесія протухла від простою» від
    // зламаного токена і показав людині зрозуміле пояснення на екрані входу.
    if (err?.name === 'TokenExpiredError') {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Сесію завершено через тривалу бездіяльність', code: 'SESSION_EXPIRED' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};


import { requirePermission } from './modules/core/permissions.js';
import { Role } from './models.js';
import { rolesRouter } from './modules/roles/routes.js';
import { progressV2Router } from './modules/learning/routes.js';
import { ProgressService } from './modules/learning/service.js';
import { knowledgeRouter } from './modules/knowledge/routes.js';
import { KnowledgeService } from './modules/knowledge/service.js';
import { KnowledgeSpace, InstructionVersion } from './modules/knowledge/models.js';
import { searchRouter } from './modules/search/routes.js';
import { onboardingRouter } from './modules/onboarding/routes.js';
import { systemRouter } from './modules/system/routes.js';
import { OnboardingService } from './modules/onboarding/service.js';

// Temporarily map old requireAdmin to new permission system for backward compatibility
const requireAdmin = requirePermission('admin.access');

// --- Mount V2 Routers ---
// Крок 15 (узгодженість): each router used to be reachable under 2-3 different
// prefixes (accretion from earlier steps renaming things without cleanup) — kept
// only the prefix the frontend actually calls for each one; the rest were dead.
apiRouter.use('/v2/org', requireAuth, orgRouter);
apiRouter.use('/v2/people', requireAuth, peopleRouter);
apiRouter.use('/v2/notifications', requireAuth, notificationsRouter);
apiRouter.use('/v2/analytics', requireAuth, analyticsRouter);
apiRouter.use('/progress-v2', requireAuth, progressV2Router);
apiRouter.use('/v2/knowledge', requireAuth, knowledgeRouter);
apiRouter.use('/search', requireAuth, searchRouter);
apiRouter.use('/v2/onboarding', requireAuth, onboardingRouter);
apiRouter.use('/v2/system', requireAuth, systemRouter);
apiRouter.use('/admin', requireAuth, rolesRouter);

// --- AUTH ROUTES ---
apiRouter.post('/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = (email || username || '').toLowerCase().trim();

    if (!loginIdentifier) {
      return res.status(400).json({ error: 'Введіть корпоративний email (@viatec.ua)' });
    }

    if (loginIdentifier !== 'admin' && !loginIdentifier.endsWith('@viatec.ua')) {
      return res.status(400).json({ error: 'Доступ дозволено лише для корпоративних адрес у домені @viatec.ua' });
    }

    const user = await User.findOne({ 
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }] 
    } as any);

    if (!user) {
      return res.status(401).json({ error: 'Користувача з таким email не знайдено або невірний пароль' });
    }

    // SECURITY REQ: Block default 'admin' if another admin exists
    if (user.username === 'admin' || user.email === 'admin@viatec.ua') {
      const otherAdmins = await User.countDocuments({ 
        role: 'admin', 
        username: { $ne: 'admin' },
        email: { $ne: 'admin@viatec.ua' } 
      } as any);
      if (otherAdmins > 0) {
        return res.status(403).json({ error: 'Системний обліковий запис вимкнено з міркувань безпеки. Використовуйте створеного адміністратора.' });
      }
    }

    const authMethod = user.authMethod || 'password';

    if (authMethod === 'otp') {
      const code = generateAuthCode();
      const expiresInMinutes = 5;
      user.authCode = code;
      user.authCodeExpires = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      await user.save();

      const emailResult = await sendAuthCodeEmail(user.email, code, expiresInMinutes);

      return res.json({
        requireEmailCode: true,
        email: user.email,
        expiresInSeconds: expiresInMinutes * 60,
        message: `Одноразовий код авторизації надіслано на ${user.email}`,
        debugCode: emailResult.simulated ? code : undefined
      });
    }

    if (!password) {
      return res.json({ requirePassword: true, email: user.email });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }

    // If requireEmailCode is false or we're using password auth (Option 1)
    issueSessionCookie(res, user);
    
    res.json({ 
      session: sessionPolicy(),
      user: { 
        id: user._id, 
        email: user.email,
        username: user.username || user.email, 
        role: user.role, 
        departments: user.departments, 
        allowedInstructionIds: user.allowedInstructionIds,
        requireEmailCode: user.requireEmailCode 
      } 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Внутрішня помилка сервера під час авторизації' });
  }
});

apiRouter.post('/auth/verify-code', verifyCodeRateLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email та 8-значний код авторизації обов\'язкові' });
    }

    const targetEmail = email.toLowerCase().trim();
    const user = await User.findOne({ 
      $or: [{ email: targetEmail }, { username: targetEmail }] 
    } as any);

    if (!user) {
      return res.status(400).json({ error: 'Користувача не знайдено' });
    }

    if (!user.authCode || !user.authCodeExpires) {
      return res.status(400).json({ error: 'Активного коду не знайдено. Будь ласка, введіть email та пароль знову.' });
    }

    const now = new Date();
    if (now > new Date(user.authCodeExpires)) {
      return res.status(400).json({ error: 'Термін дії коду авторизації вичерпано (5 хв). Запросіть новий код.' });
    }

    const cleanInputCode = code.trim().toUpperCase();
    if (user.authCode.toUpperCase() !== cleanInputCode) {
      return res.status(400).json({ error: 'Невірний код авторизації. Перевірте пошту та спробуйте ще раз.' });
    }

    // Code matches successfully! Clear the temporary code
    user.authCode = null;
    user.authCodeExpires = null;
    await user.save();

    issueSessionCookie(res, user);

    res.json({
      session: sessionPolicy(),
      user: {
        id: user._id,
        email: user.email,
        username: user.username || user.email,
        role: user.role,
        departments: user.departments,
        allowedInstructionIds: user.allowedInstructionIds,
        requireEmailCode: user.requireEmailCode
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Помилка під час підтвердження коду' });
  }
});

apiRouter.post('/auth/resend-code', resendCodeRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email обов\'язковий' });
    const targetEmail = email.toLowerCase().trim();

    const user = await User.findOne({ 
      $or: [{ email: targetEmail }, { username: targetEmail }] 
    } as any);

    if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });

    const code = generateAuthCode();
    const expiresInMinutes = 5;
    user.authCode = code;
    user.authCodeExpires = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    await user.save();

    const emailResult = await sendAuthCodeEmail(user.email, code, expiresInMinutes);

    res.json({
      success: true,
      expiresInSeconds: expiresInMinutes * 60,
      message: `Новий код авторизації надіслано на ${user.email}`,
      debugCode: emailResult.simulated ? code : undefined
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Не вдалося повторно надіслати код' });
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

/**
 * «Пульс» активної сесії. Клієнт викликає його лише тоді, коли людина справді
 * щось робить (клік, клавіатура, прокрутка), тому відлік простою обнуляється
 * саме від дій користувача, а не від фонових запитів застосунку.
 */
apiRouter.post('/auth/heartbeat', requireAuth, (req: any, res) => {
  issueSessionCookie(res, req.user);
  res.json({ success: true, session: sessionPolicy() });
});

apiRouter.get('/auth/me', requireAuth, async (req: any, res) => {
  try {
    const { getUserEffectivePermissions } = await import('./modules/core/permissions.js');
    const userPerms = await getUserEffectivePermissions(req.user);
    
    let departmentName = '';
    if (req.user.departmentId) {
      try {
        const dep = await Department.findById(req.user.departmentId);
        if (dep?.name) departmentName = dep.name;
      } catch {}
    }
    if (!departmentName && Array.isArray(req.user.departments) && req.user.departments.length > 0) {
      const found = req.user.departments.find((d: string) => d && d !== 'Всі підрозділи') || req.user.departments[0];
      if (found && !/^[0-9a-fA-F]{24}$/.test(found)) departmentName = found;
    }

    res.json({ 
      session: sessionPolicy(),
      user: { 
        id: req.user._id, 
        email: req.user.email,
        username: req.user.username || req.user.email, 
        fullName: req.user.fullName || '',
        role: req.user.role, 
        roleKeys: userPerms.roleKeys,
        permissions: userPerms.permissions,
        isAdmin: userPerms.isAdmin,
        departments: req.user.departments, 
        departmentId: req.user.departmentId,
        departmentName,
        positionId: req.user.positionId,
        managerId: req.user.managerId,
        locationId: req.user.locationId,
        avatarUrl: req.user.avatarUrl,
        phone: req.user.phone,
        hireDate: req.user.hireDate,
        isActive: req.user.isActive,
        allowedInstructionIds: req.user.allowedInstructionIds,
        requireEmailCode: req.user.requireEmailCode
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Помилка отримання профілю' });
  }
});

// --- ADMIN ROUTES ---

apiRouter.get('/admin/users', requireAuth, requirePermission('users.profile.view'), async (req, res) => {
  try {
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const filter = await scopeFilter((req as any).user, 'users.profile.view');
    
    // If _id is null, it means no access
    if (filter._id === null) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Крок 14: pagination is opt-in via ?limit=&skip= so existing callers that rely on
    // getting everyone (e.g. manager-picker dropdowns) keep working unchanged; a generous
    // default cap still guards against an unbounded scan on a very large user base.
    const limit = req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 1000, 1000) : 1000;
    const skip = req.query.skip ? parseInt(String(req.query.skip), 10) || 0 : 0;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -authCode')
        .populate('departmentId', 'name')
        .populate('positionId', 'title grade')
        .populate('managerId', 'fullName email username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

apiRouter.put('/admin/users/:id', requireAuth, requirePermission('users.profile.edit'), async (req, res) => {
  try {
    const { isUserInScope } = await import('./modules/core/permissions.js');
    const targetBefore = await User.findOne({ _id: req.params.id } as any).select('-passwordHash -authCode');
    if (!targetBefore) return res.status(404).json({ error: 'Користувача не знайдено' });

    // SECURITY: requirePermission only confirms the caller holds users.profile.edit at
    // SOME scope — it does not know which record is being touched. Without this check a
    // manager/HR user granted a narrower scope (e.g. 'team') could edit any user by id.
    const allowed = await isUserInScope((req as any).user, targetBefore, 'users.profile.edit');
    if (!allowed) return res.status(403).json({ error: 'Немає доступу до редагування цього користувача' });

    const {
      departments, departmentId, positionId, managerId, locationId,
      allowedInstructionIds, role, roleKeys, fullName, email, password, authMethod,
      avatarUrl, phone, hireDate, isActive, customFields
    } = req.body;
    if (!email || !email.toLowerCase().endsWith('@viatec.ua')) {
      return res.status(400).json({ error: 'Email є обов\'язковим і має бути в домені @viatec.ua' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existingEmail = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.params.id }
    } as any);
    if (existingEmail) return res.status(400).json({ error: 'Користувач з таким email вже існує' });

    const updateData: any = {
      email: normalizedEmail,
      username: normalizedEmail
    };
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (allowedInstructionIds !== undefined) updateData.allowedInstructionIds = allowedInstructionIds;
    if (authMethod !== undefined) updateData.authMethod = authMethod;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (phone !== undefined) updateData.phone = phone;
    if (hireDate !== undefined) updateData.hireDate = hireDate || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (locationId !== undefined) updateData.locationId = locationId || null;
    if (customFields !== undefined) updateData.customFields = customFields;

    if (roleKeys !== undefined && Array.isArray(roleKeys)) {
      updateData.roleKeys = roleKeys.length > 0 ? roleKeys : ['employee'];
      updateData.role = updateData.roleKeys.includes('admin') ? 'admin' : (role || 'user');
    } else if (role !== undefined) {
      updateData.role = role;
      if (role === 'admin') {
        updateData.roleKeys = ['admin'];
      }
    }

    // Крок 15 (узгодженість): departmentId (Крок 1 dictionary ref) and the legacy
    // departments[] string array must always be updated together — leaving one
    // stale (e.g. clearing departmentId without touching departments) makes RBAC
    // scoping (which trusts departmentId) and course visibility in GET /api/content
    // (which trusts departments[]) disagree about the same user.
    if (departmentId !== undefined) {
      updateData.departmentId = departmentId || null;
      if (departmentId) {
        const dep = await Department.findById(departmentId);
        updateData.departments = dep ? [dep.name] : [];
      } else {
        updateData.departments = ['Всі підрозділи'];
      }
    } else if (departments !== undefined) {
      updateData.departments = departments;
      if (departments.length > 0) {
        const dep = await Department.findOne({ name: departments[0] });
        updateData.departmentId = dep ? dep._id : null;
      } else {
        updateData.departmentId = null;
      }
    }

    if (positionId !== undefined) updateData.positionId = positionId || null;
    if (managerId !== undefined) updateData.managerId = managerId || null;

    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id } as any,
      updateData,
      { new: true } as any
    )
      .select('-passwordHash -authCode')
      .populate('departmentId', 'name')
      .populate('positionId', 'title grade')
      .populate('managerId', 'fullName email username');

    const { auditService } = await import('./modules/core/audit.js');
    await auditService.log({
      actorId: (req as any).user._id,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: String(req.params.id),
      before: targetBefore.toObject(),
      after: updated?.toObject()
    });

    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося оновити дані користувача' });
  }
});

// Крок 15: legacy /api/admin/departments (GET/POST/DELETE) removed — it was a
// second, unvalidated, unaudited code path writing to the same Department
// collection as /api/v2/org/departments. All frontend consumers now use v2.

apiRouter.post('/admin/users', requireAuth, requirePermission('users.profile.edit'), async (req, res) => {
  try {
    const { email, password, role, roleKeys, fullName, departmentId, departments, positionId, managerId, locationId, hireDate, allowedInstructionIds, authMethod } = req.body;
    if (!email || !email.toLowerCase().endsWith('@viatec.ua')) {
      return res.status(400).json({ error: 'Email є обов\'язковим і має бути в домені @viatec.ua' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Пароль є обов\'язковим полем' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ 
      $or: [{ username: normalizedEmail }, { email: normalizedEmail }] 
    } as any);
    if (existing) return res.status(400).json({ error: 'Користувач з таким email вже існує' });

    const passwordHash = await bcrypt.hash(password, 10);

    let resolvedRoleKeys: string[] = Array.isArray(roleKeys) && roleKeys.length > 0 ? roleKeys : ['employee'];
    if (role === 'admin' && !resolvedRoleKeys.includes('admin')) {
      resolvedRoleKeys.push('admin');
    }
    const resolvedRole = resolvedRoleKeys.includes('admin') ? 'admin' : (role || 'user');

    let resolvedDeptNames: string[] = ['Всі підрозділи'];
    let resolvedDeptId = departmentId || null;
    if (resolvedDeptId) {
      const dep = await Department.findById(resolvedDeptId);
      if (dep) resolvedDeptNames = [dep.name];
    } else if (departments && Array.isArray(departments) && departments.length > 0) {
      resolvedDeptNames = departments;
      const dep = await Department.findOne({ name: departments[0] });
      if (dep) resolvedDeptId = dep._id;
    }

    const newUser = await User.create({ 
      username: normalizedEmail, 
      email: normalizedEmail, 
      fullName: fullName?.trim() || '',
      passwordHash, 
      role: resolvedRole,
      roleKeys: resolvedRoleKeys,
      departmentId: resolvedDeptId,
      departments: resolvedDeptNames,
      positionId: positionId || null,
      managerId: managerId || null,
      locationId: locationId || null,
      hireDate: hireDate ? new Date(hireDate) : undefined,
      allowedInstructionIds: allowedInstructionIds || [],
      authMethod: authMethod || 'password'
    } as any);
    
    // SECURITY: Delete default admin immediately if a new admin is created
    if (newUser.role === 'admin' && newUser.email !== 'admin@viatec.ua') {
      await User.deleteOne({ 
        $or: [{ username: 'admin' }, { email: 'admin@viatec.ua' }] 
      } as any);
      console.log('🔒 Security: Removed default admin user because a custom admin was created.');
    }

    // Автозапуск онбордінгу: якщо під посаду/підрозділ новачка є активне
    // правило, він одразу отримує свій маршрут адаптації без окремої дії HR.
    const autoOnboarding = await OnboardingService.applyAutoRulesForUser(newUser, (req as any).user);

    res.json({ 
      success: true, 
      autoOnboarding: autoOnboarding
        ? { templateName: autoOnboarding.templateName, dueDate: autoOnboarding.dueDate }
        : null,
      user: { 
        id: newUser._id, 
        email: newUser.email,
        username: newUser.username, 
        fullName: newUser.fullName,
        role: newUser.role,
        roleKeys: newUser.roleKeys,
        departments: newUser.departments,
        authMethod: newUser.authMethod 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося створити користувача' });
  }
});

apiRouter.post('/admin/import', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sections, questions, replace } = req.body;
    const assets = await importInstructions(sections, questions, Boolean(replace));
    res.json({ success: true, assets });
  } catch (err) {
    console.error('Failed to import data', err);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

apiRouter.post('/admin/upload-source-file', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { token } = await savePendingUpload(req.file.path);
    res.json({
      success: true,
      sourceFileToken: token,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype
    });
  } catch (err) {
    console.error('Failed to store source file', err);
    res.status(500).json({ error: 'Не вдалося зберегти файл' });
  }
});

// Access-check helper shared by the source-file download routes below
function userCanAccessSection(user: any, section: any): boolean {
  if (!section) return false;
  // Адмін отримує деактивовані інструкції в /content і може їх відкрити, тож
  // і їхні зображення мусить бачити — інакше в тексті лишаються «биті» кадри.
  if (user?.role === 'admin') return true;
  if (!section.isActive) return false;

  const allowed: string[] = user?.allowedInstructionIds || [];
  if (allowed.length > 0) return allowed.includes(section.id);

  const deps: string[] = user?.departments || [];
  if (deps.includes('Всі підрозділи')) return true;
  return deps.includes(section.department);
}


apiRouter.get('/sections/:id/source-file', requireAuth, async (req: any, res) => {
  try {
    const section = await Section.findOne({ id: req.params.id } as any);
    if (!section || !userCanAccessSection(req.user, section)) {
      return res.status(404).json({ error: 'Документ не знайдено' });
    }
    const sourceFile = (section as any).sourceFile;
    const stored = sourceFile?.storagePath ? await openStoredFile(sourceFile.storagePath) : null;
    if (!stored) {
      return res.status(404).json({ error: 'Оригінальний файл не знайдено' });
    }
    sendStoredFile(res, stored, sourceFile.fileName || 'original');
  } catch (err) {
    console.error('Failed to download section source file', err);
    res.status(500).json({ error: 'Не вдалося завантажити файл' });
  }
});

apiRouter.get('/sections/:id/source-file.md', requireAuth, async (req: any, res) => {
  try {
    const section = await Section.findOne({ id: req.params.id } as any);
    if (!section || !userCanAccessSection(req.user, section)) {
      return res.status(404).json({ error: 'Документ не знайдено' });
    }
    // Файл у сховищі — першоджерело (посилання на зображення в ньому відносні,
    // тож набір файлів документа лишається самодостатнім); поле в БД — запасний
    // варіант для інструкцій, імпортованих до переходу на окреме зберігання.
    const markdownFile = (section as any).markdownFile;
    const stored = markdownFile?.storagePath ? await openStoredFile(markdownFile.storagePath) : null;
    if (stored) {
      return sendStoredFile(res, stored, `${section.id}.md`);
    }

    const rawMarkdown = (section as any).rawMarkdown;
    if (!rawMarkdown) {
      return res.status(404).json({ error: 'Markdown-файл не знайдено' });
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${section.id}.md"`);
    res.send(rawMarkdown);
  } catch (err) {
    console.error('Failed to download section markdown', err);
    res.status(500).json({ error: 'Не вдалося завантажити файл' });
  }
});

/**
 * Віддає скріншот документа. Саме на цей маршрут вказують посилання на зображення
 * у контенті інструкції (`/api/sections/<id>/assets/v<N>/img-001.png`), тож доступ
 * перевіряється так само, як і до самої інструкції.
 */
apiRouter.get('/sections/:id/assets/:version/:file', requireAuth, async (req: any, res) => {
  try {
    const section = await Section.findOne({ id: req.params.id } as any);
    if (!section || !userCanAccessSection(req.user, section)) {
      return res.status(404).json({ error: 'Документ не знайдено' });
    }

    // Сегмент версії має вигляд "v3"
    const versionNumber = Number(String(req.params.version).replace(/^v/i, ''));
    if (!Number.isFinite(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: 'Некоректна версія документа' });
    }

    const asset = await resolveVersionAsset(section.id, versionNumber, req.params.file);
    if (!asset) {
      return res.status(404).json({ error: 'Зображення не знайдено' });
    }

    sendStoredInline(res, { ...asset, fileName: req.params.file }, asset.mimeType);
  } catch (err) {
    console.error('Failed to serve document asset', err);
    res.status(500).json({ error: 'Не вдалося завантажити зображення' });
  }
});

/**
 * Завантаження зображення в документ з редактора Markdown.
 * Повертає посилання, яке редактор вставляє у текст — жодного base64.
 */
apiRouter.post('/admin/instructions/:id/assets', requireAuth, requireAdmin, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл зображення не передано' });
    }
    if (!/^image\//.test(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Дозволені лише файли зображень' });
    }

    const section = await Section.findOne({ id: req.params.id } as any);
    if (!section) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Інструкцію не знайдено' });
    }

    const versionNumber = section.versionNumber || 1;
    const buffer = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path);

    const asset = await saveVersionAsset(
      section.id,
      versionNumber,
      req.file.originalname || 'screenshot.png',
      buffer,
      req.file.mimetype,
      'upload'
    );

    const assets = await listVersionAssets(section.id, versionNumber);
    await Section.updateOne({ id: section.id } as any, { $set: { assets } } as any);

    res.json({
      success: true,
      fileName: asset.fileName,
      url: assetApiUrl(section.id, versionNumber, asset.fileName),
      sizeBytes: asset.sizeBytes
    });
  } catch (err) {
    console.error('Failed to upload document image', err);
    res.status(500).json({ error: 'Не вдалося зберегти зображення' });
  }
});

apiRouter.post('/admin/generate-instruction', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const generated = await generateInstructionFromDocument({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype
    });

    res.json({ success: true, ...generated });
  } catch (err: any) {
    if (err instanceof InstructionGenerationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Failed to generate instruction via AI', err);
    res.status(500).json({ error: describeAiError(err) });
  }
});

/**
 * Пакетна ШІ-обробка: адмін віддає одразу кілька документів, сервер ставить їх
 * у чергу і повертає завдання. Далі клієнт лише опитує прогрес — людина може
 * спокійно працювати з додатком, поки модель розбирає пачку.
 */
apiRouter.post('/admin/ai-import-jobs', requireAuth, requireAdmin, upload.array('files', AI_IMPORT_MAX_FILES), async (req: any, res) => {
  try {
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Не вибрано жодного файлу' });
    }

    const job = await enqueueAiImportJob({
      files: files.map(f => ({ originalname: f.originalname, path: f.path, mimetype: f.mimetype, size: f.size })),
      userId: String(req.user?._id || ''),
      userName: req.user?.fullName || req.user?.username || req.user?.email || ''
    });

    res.json({ success: true, job: serializeAiImportJob(job) });
  } catch (err) {
    console.error('Failed to enqueue AI import job', err);
    res.status(500).json({ error: 'Не вдалося поставити файли в чергу обробки' });
  }
});

/** Активні та останні завершені завдання поточного адміністратора. */
apiRouter.get('/admin/ai-import-jobs', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const createdBy = String(req.user?._id || '');
    const jobs = await AiImportJob
      .find({ createdBy, dismissedAt: { $exists: false } } as any)
      .sort({ createdAt: -1 } as any)
      .limit(AI_IMPORT_JOB_LIST_LIMIT);

    res.json({ jobs: jobs.map(serializeAiImportJob) });
  } catch (err) {
    console.error('Failed to list AI import jobs', err);
    res.status(500).json({ error: 'Не вдалося отримати стан обробки' });
  }
});

/** Зупиняє чергу: файл, що вже в роботі, дообробляється, решта пропускається. */
apiRouter.post('/admin/ai-import-jobs/:id/cancel', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const job = await AiImportJob.findOne({ id: req.params.id, createdBy: String(req.user?._id || '') } as any);
    if (!job) return res.status(404).json({ error: 'Завдання не знайдено' });

    if (job.status === 'queued' || job.status === 'processing') {
      job.cancelRequested = true;
      await job.save();
    }
    res.json({ success: true, job: serializeAiImportJob(job) });
  } catch (err) {
    console.error('Failed to cancel AI import job', err);
    res.status(500).json({ error: 'Не вдалося скасувати обробку' });
  }
});

/** Прибирає завершене завдання з панелі прогресу. */
apiRouter.post('/admin/ai-import-jobs/:id/dismiss', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const job = await AiImportJob.findOne({ id: req.params.id, createdBy: String(req.user?._id || '') } as any);
    if (!job) return res.status(404).json({ error: 'Завдання не знайдено' });
    if (job.status === 'queued' || job.status === 'processing') {
      return res.status(409).json({ error: 'Обробка ще триває' });
    }
    job.dismissedAt = new Date();
    await job.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to dismiss AI import job', err);
    res.status(500).json({ error: 'Не вдалося прибрати завдання' });
  }
});

apiRouter.post('/admin/courses', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      title, 
      department, 
      instructionIds, 
      useCases, 
      hasCertificate, 
      certificateValidityYears,
      isProgressive,
      quizTimeLimitMin,
      quizPassScorePercent,
      quizMaxAttempts,
      isActive
    } = req.body;
    const course = await Course.create({
      id: `course-${Date.now()}`,
      title,
      department,
      instructionIds: Array.isArray(instructionIds) ? instructionIds : [],
      useCases: !!useCases,
      hasCertificate: !!hasCertificate,
      certificateValidityYears: certificateValidityYears || 1,
      isProgressive: !!isProgressive,
      // Форма створення тепер має перемикач «Курс активний» — курс можна
      // підготувати вимкненим і показати співробітникам пізніше.
      isActive: isActive === undefined ? true : !!isActive,
      quizTimeLimitMin: quizTimeLimitMin !== undefined && quizTimeLimitMin !== null && quizTimeLimitMin !== '' ? Number(quizTimeLimitMin) : undefined,
      quizPassScorePercent: quizPassScorePercent !== undefined ? Number(quizPassScorePercent) : 80,
      quizMaxAttempts: quizMaxAttempts !== undefined && quizMaxAttempts !== null && quizMaxAttempts !== '' ? Number(quizMaxAttempts) : undefined
    } as any);
    res.json({ success: true, course });
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

apiRouter.delete('/admin/courses/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const courseId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(courseId);
    const query: any = {
      $or: [
        { id: courseId },
        ...(isObjectId ? [{ _id: courseId }] : [])
      ]
    };
    let deleted = await Course.findOneAndDelete(query);
    if (!deleted && isObjectId) {
      deleted = await Course.findByIdAndDelete(courseId);
    }
    res.json({ success: true, deleted: !!deleted });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

apiRouter.put('/admin/courses/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const courseId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(courseId);
    const query: any = {
      $or: [
        { id: courseId },
        ...(isObjectId ? [{ _id: courseId }] : [])
      ]
    };
    const { 
      title, 
      department, 
      instructionIds, 
      useCases, 
      hasCertificate, 
      certificateValidityYears,
      isProgressive,
      quizTimeLimitMin,
      quizPassScorePercent,
      quizMaxAttempts,
      isActive
    } = req.body;
    
    const updateData: any = {
      title,
      department,
      instructionIds: Array.isArray(instructionIds) ? instructionIds : [],
      useCases: !!useCases,
      hasCertificate: !!hasCertificate,
      certificateValidityYears: certificateValidityYears || 1,
      isProgressive: !!isProgressive,
      quizPassScorePercent: quizPassScorePercent !== undefined ? Number(quizPassScorePercent) : 80,
      quizTimeLimitMin: quizTimeLimitMin !== undefined && quizTimeLimitMin !== null && quizTimeLimitMin !== '' ? Number(quizTimeLimitMin) : undefined,
      quizMaxAttempts: quizMaxAttempts !== undefined && quizMaxAttempts !== null && quizMaxAttempts !== '' ? Number(quizMaxAttempts) : undefined
    };
    if (isActive !== undefined) {
      updateData.isActive = !!isActive;
    }

    const course = await Course.findOneAndUpdate(
      query,
      updateData,
      { new: true } as any
    );
    res.json({ success: true, course });
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

apiRouter.delete('/admin/instructions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const instructionId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(instructionId);
    const query: any = {
      $or: [
        { id: instructionId },
        ...(isObjectId ? [{ _id: instructionId }] : [])
      ]
    };
    const deletedSection = await Section.findOneAndDelete(query);
    const secId = deletedSection?.id || instructionId;

    await Question.deleteMany({
      $or: [
        { sectionId: secId },
        { sectionId: instructionId }
      ]
    } as any);
    
    // Also remove this instruction from any courses
    await Course.updateMany(
      { instructionIds: { $in: [secId, instructionId] } } as any,
      { $pull: { instructionIds: { $in: [secId, instructionId] } } } as any
    );

    // Also remove this deleted instruction from all users' progress to prevent progress overflow
    await Progress.updateMany(
      {},
      { $pull: { readSectionIds: { $in: [secId, instructionId] } } } as any
    );

    // Разом з інструкцією прибираємо її теку: оригінал, instruction.md та скріншоти,
    // інакше сховище засмічується файлами, на які вже ніщо не посилається
    if (deletedSection) {
      await InstructionVersion.deleteMany({ sectionId: secId } as any);
      await deleteDocumentStorage(secId);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting instruction:', err);
    res.status(500).json({ error: 'Failed to delete instruction' });
  }
});

apiRouter.put('/admin/instructions/:id/full', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { section, questions, createRevision, changeSummary, incrementType } = req.body;
    const instructionId = req.params.id;

    // Get current section to check if version needs incrementing
    const existingSection = await Section.findOne({ id: instructionId });
    
    let updatePayload = { ...section };
    const previousVersionNumber = existingSection?.versionNumber || 1;
    let targetVersionNumber = previousVersionNumber;

    if (createRevision && existingSection) {
      const currentVerStr = existingSection.version || '1.0';
      const currentVerNum = existingSection.versionNumber || 1;
      const [maj = '1', min = '0'] = currentVerStr.split('.');
      let newVersion = incrementType === 'major'
        ? `${parseInt(maj, 10) + 1}.0`
        : `${maj}.${parseInt(min, 10) + 1}`;

      updatePayload.version = newVersion;
      updatePayload.versionNumber = currentVerNum + 1;
      updatePayload.changeLog = changeSummary || `Оновлення редакції до v${newVersion}`;
      updatePayload.lastReviewedAt = new Date();
      updatePayload.reviewedBy = req.user?._id;
      targetVersionNumber = updatePayload.versionNumber;
    }

    // Нова редакція успадковує скріншоти попередньої, інакше посилання в її тексті «повиснуть»
    if (targetVersionNumber !== previousVersionNumber) {
      await copyVersionAssets(instructionId, previousVersionNumber, targetVersionNumber);
    }

    // Зображення з редактора (як посилання, так і випадковий base64) → файли теки документа
    try {
      const normalized = await normalizeDocumentAssets(updatePayload, {
        sectionId: instructionId,
        versionNumber: targetVersionNumber
      });
      Object.assign(updatePayload, normalized.fields, {
        assets: normalized.assets,
        ...(normalized.rawMarkdown ? { rawMarkdown: normalized.rawMarkdown } : {}),
        ...(normalized.markdownFile ? { markdownFile: normalized.markdownFile } : {})
      });
    } catch (assetErr) {
      console.error('Failed to store document images for section', instructionId, assetErr);
    }

    // Update section fields fully
    const updatedSection = await Section.findOneAndUpdate(
      { id: instructionId } as any,
      updatePayload,
      { new: true } as any
    );

    // If createRevision or if no revisions exist yet, snapshot in InstructionVersion
    if (updatedSection) {
      const revCount = await InstructionVersion.countDocuments({ sectionId: instructionId });
      if (createRevision || revCount === 0) {
        await InstructionVersion.create({
          sectionId: instructionId,
          version: updatedSection.version || '1.0',
          versionNumber: updatedSection.versionNumber || 1,
          status: updatedSection.status || 'published',
          title: updatedSection.title,
          subtitle: updatedSection.subtitle || '',
          summary: updatedSection.summary || '',
          contentMarkdown: updatedSection.contentMarkdown || '',
          contentHtml: updatedSection.contentHtml || '',
          keyPoints: updatedSection.keyPoints || [],
          keyFields: updatedSection.keyFields || [],
          stopRules: updatedSection.stopRules || [],
          steps: updatedSection.steps || [],
          tableData: updatedSection.tableData || null,
          // Знімок редакції має містити й файли: оригінал, .md та перелік скріншотів
          sourceFile: (updatedSection as any).sourceFile || undefined,
          markdownFile: (updatedSection as any).markdownFile || undefined,
          assets: (updatedSection as any).assets || [],
          rawMarkdown: (updatedSection as any).rawMarkdown || '',
          changeSummary: changeSummary || updatedSection.changeLog || 'Оновлення редакції',
          authorId: req.user?._id,
          authorName: req.user?.fullName || req.user?.username || 'Адміністратор',
          authorEmail: req.user?.email || '',
          createdAt: new Date()
        });
      }
    }

    // Replace all questions for this section
    await Question.deleteMany({ sectionId: instructionId } as any);
    if (questions && questions.length > 0) {
      // Ensure sectionId is set correctly on all questions
      const qsToInsert = questions.map((q: any) => ({ ...q, sectionId: instructionId }));
      await Question.insertMany(qsToInsert);
    }

    res.json({ success: true, section: updatedSection });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fully update instruction' });
  }
});

apiRouter.put('/admin/instructions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { department, title, isActive } = req.body;
    const updateData: any = { department, title };
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    
    const section = await Section.findOneAndUpdate(
      { id: req.params.id } as any,
      updateData,
      { new: true } as any
    );
    res.json({ success: true, section });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update instruction' });
  }
});

// --- CASE ROUTES ---
apiRouter.post('/admin/cases', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, sectionId, scenario, options, isActive } = req.body;
    const newCase = await Case.create({
      id: `case-${Date.now()}`,
      sectionId,
      title,
      scenario,
      options,
      isActive: isActive !== undefined ? isActive : true
    } as any);
    res.json({ success: true, case: newCase });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case' });
  }
});

apiRouter.delete('/admin/cases/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const caseId = req.params.id;
    const isObjectId = mongoose.isValidObjectId(caseId);
    const query: any = {
      $or: [
        { id: caseId },
        ...(isObjectId ? [{ _id: caseId }] : [])
      ]
    };
    const deletedCase = await Case.findOneAndDelete(query);
    const deletedId = deletedCase?.id || caseId;
    await Course.updateMany(
      { caseIds: { $in: [deletedId, caseId] } } as any,
      { $pull: { caseIds: { $in: [deletedId, caseId] } } } as any
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

apiRouter.put('/admin/cases/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, sectionId, scenario, options, isActive } = req.body;
    const updatedCase = await Case.findOneAndUpdate(
      { id: req.params.id } as any,
      { title, sectionId, scenario, options, isActive } as any,
      { new: true } as any
    );
    res.json({ success: true, case: updatedCase });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// --- DATA ROUTES ---
apiRouter.get('/content', requireAuth, async (req: any, res) => {
  try {
    const courseQuery: any = {};
    const instructionQuery: any = {};
    
    if (req.user.role !== 'admin') {
      // Non-admins only see active courses and instructions
      courseQuery.isActive = true;
      instructionQuery.isActive = true;

      const deps = req.user.departments || [];
      const hasAllDepartments = deps.includes('Всі підрозділи');
      
      const allowed = req.user.allowedInstructionIds || [];
      
      if (!hasAllDepartments) {
        courseQuery.department = { $in: deps };
        // User can see instructions in their allowed list OR in courses they have access to
        // We will fetch courses first to know which instructions are in them
      }
      
      if (allowed.length > 0) {
        // If strict overrides exist
        instructionQuery.id = { $in: allowed };
      }
    }

    // .lean() по всьому обробнику: відповідь одразу серіалізується в JSON, тож
    // гідрація в повноцінні документи Mongoose — це витрачені такти CPU й пам'ять
    // на кожен запит. На каталозі в сотні інструкцій різниця відчутна.
    const courses = await Course.find(courseQuery).lean();
    
    // If not admin, restrict instruction visibility
    if (req.user.role !== 'admin') {
       const allowedInstructions = new Set<string>(req.user.allowedInstructionIds || []);
       if (allowedInstructions.size === 0) {
          // If no specific restrictions, allow based on visible courses OR visible department
          const deps = req.user.departments || [];
          if (!deps.includes('Всі підрозділи')) {
            const courseInstIds = courses.flatMap((c: any) => c.instructionIds);
            instructionQuery.$or = [
              { department: { $in: deps } },
              { id: { $in: courseInstIds } }
            ];
          }
       }
    }

    const sections = await Section.find(instructionQuery).lean();
    const sectionIds = sections.map((s: any) => s.id);
    const questions = await Question.find({ sectionId: { $in: sectionIds } } as any).lean();
    
    // Also fetch cases that belong to these courses (or all for admin)
    const caseQuery: any = {};
    if (req.user.role !== 'admin') {
      caseQuery.isActive = true;
      const courseCaseIds = courses.flatMap((c: any) => c.caseIds || []);
      caseQuery.id = { $in: courseCaseIds };
    }
    const cases = await Case.find(caseQuery).lean();
    
    // Fetch knowledge spaces
    const spaces = await KnowledgeService.getSpaces(req.user.role === 'admin');
    
    res.json({ courses, sections, questions, cases, spaces });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Крок 12 (Аналітика): fire-and-forget view counter, called once when an
// employee opens an instruction section. No response body needed beyond ok.
apiRouter.post('/sections/:id/view', requireAuth, async (req: any, res) => {
  try {
    await Section.updateOne({ id: req.params.id } as any, { $inc: { viewsCount: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

apiRouter.get('/progress', requireAuth, async (req: any, res) => {
  try {
    const progress = await ProgressService.getUserProgress(req.user._id);
    res.json({ progress });
  } catch (err) {
    console.error('Failed to fetch progress', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

apiRouter.post('/progress', requireAuth, async (req: any, res) => {
  try {
    const { readSectionIds, testScore, employeeInfo } = req.body;

    if (readSectionIds && Array.isArray(readSectionIds)) {
      await ProgressService.saveReadSections(req.user._id, readSectionIds);
    }
    if (employeeInfo) {
      try {
        await ProgressService.saveAcknowledgment(req.user._id, employeeInfo);
      } catch (ackErr: any) {
        // Validation failure (e.g. quiz not yet passed) — surface the real reason to the client
        return res.status(400).json({ error: ackErr.message || 'Не вдалося зберегти підпис' });
      }
    }
    if (testScore) {
      await ProgressService.recordAttempt(req.user._id, testScore);
    }

    const progress = await ProgressService.getUserProgress(req.user._id);
    res.json({ success: true, progress });
  } catch (err) {
    console.error('Failed to update progress', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Admin/Manager/HR: Get summary of users and progress stats according to scope
apiRouter.get('/admin/users-progress', requireAuth, requirePermission('analytics.report.view'), async (req, res) => {
  try {
    const { scopeFilter } = await import('./modules/core/permissions.js');
    const userFilter = await scopeFilter((req as any).user, 'analytics.report.view');
    if (userFilter._id === null) {
      return res.json({ users: [] });
    }

    const userStats = await ProgressService.getUsersProgressReport(userFilter);
    res.json({ users: userStats });
  } catch (err) {
    console.error('Failed to fetch users progress', err);
    res.status(500).json({ error: 'Failed to fetch users progress' });
  }
});

// Delete/Revoke a user's certificate
apiRouter.delete('/admin/progress/:userId/certificate/:courseId', requireAuth, requirePermission('certificate.revoke'), async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    const { isUserInScope } = await import('./modules/core/permissions.js');
    const target = await User.findById(userId).select('_id departmentId managerId');
    if (!target) return res.status(404).json({ error: 'Користувача не знайдено' });
    if (!(await isUserInScope((req as any).user, target, 'certificate.revoke'))) {
      return res.status(403).json({ error: 'Немає доступу до сертифіката цього користувача' });
    }

    await ProgressService.revokeCertificate(String(userId), String(courseId), (req as any).user._id);
    const progress = await ProgressService.getUserProgress(String(userId));
    res.json({ success: true, progress });
  } catch (err: any) {
    console.error('Failed to delete certificate', err);
    res.status(500).json({ error: err.message || 'Не вдалося видалити сертифікат' });
  }
});

// User: Mark notification as read
apiRouter.post('/progress/notifications/:id/read', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    await ProgressService.markNotificationRead(req.user._id, id);
    const progress = await ProgressService.getUserProgress(req.user._id);
    res.json({ success: true, progress });
  } catch (err) {
    console.error('Failed to mark notification as read', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Admin: Get full progress for a specific user
apiRouter.get('/admin/progress/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findOne({ _id: userId } as any).select('-passwordHash -authCode');
    if (!targetUser) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }

    const progress = await ProgressService.getUserProgress(targetUser._id);

    res.json({ 
      user: {
        _id: targetUser._id,
        id: targetUser._id.toString(),
        email: targetUser.email || targetUser.username,
        username: targetUser.username,
        role: targetUser.role,
        departments: targetUser.departments || [],
        allowedInstructionIds: targetUser.allowedInstructionIds || [],
        createdAt: targetUser.createdAt
      },
      progress 
    });
  } catch (err) {
    console.error('Failed to fetch target user progress', err);
    res.status(500).json({ error: 'Failed to fetch user progress' });
  }
});
