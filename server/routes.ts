import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { User, Section, Question, Progress, Department, Course, Case } from './models.js';
import { generateAuthCode, sendAuthCodeEmail } from './email.js';

const upload = multer({ dest: 'uploads/' });

export const apiRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Middleware to verify auth
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId } as any);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  next();
};

// --- AUTH ROUTES ---
apiRouter.post('/auth/login', async (req, res) => {
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
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
    
    res.json({ 
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
    res.status(500).json({ error: 'Внутрішня помилка сервера під час авторизації' });
  }
});

apiRouter.post('/auth/verify-code', async (req, res) => {
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

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });

    res.json({
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

apiRouter.post('/auth/resend-code', async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося повторно надіслати код' });
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  res.json({ success: true });
});

apiRouter.get('/auth/me', requireAuth, (req: any, res) => {
  res.json({ 
    user: { 
      id: req.user._id, 
      email: req.user.email,
      username: req.user.username || req.user.email, 
      role: req.user.role, 
      departments: req.user.departments, 
      allowedInstructionIds: req.user.allowedInstructionIds,
      requireEmailCode: req.user.requireEmailCode 
    } 
  });
});

// --- ADMIN ROUTES ---
apiRouter.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find().select('-passwordHash -authCode');
  res.json({ users });
});

apiRouter.put('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { departments, allowedInstructionIds, role, email, password, authMethod } = req.body;
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
    if (departments !== undefined) updateData.departments = departments;
    if (allowedInstructionIds !== undefined) updateData.allowedInstructionIds = allowedInstructionIds;
    if (role !== undefined) updateData.role = role;
    if (authMethod !== undefined) updateData.authMethod = authMethod;
    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    const updated = await User.findOneAndUpdate(
      { _id: req.params.id } as any, 
      updateData, 
      { new: true } as any
    ).select('-passwordHash -authCode');
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Не вдалося оновити дані користувача' });
  }
});

apiRouter.get('/admin/departments', requireAuth, requireAdmin, async (req, res) => {
  const deps = await Department.find();
  res.json({ departments: deps });
});

apiRouter.post('/admin/departments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const dep = await Department.create({ name } as any);
    res.json({ department: dep });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create department' });
  }
});

apiRouter.delete('/admin/departments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const dep = await Department.findOne({ _id: req.params.id } as any);
    if (!dep) return res.status(404).json({ error: 'Not found' });
    if (dep.name === 'Всі підрозділи') return res.status(400).json({ error: 'Cannot delete default department' });
    await Department.findOneAndDelete({ _id: req.params.id } as any);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

apiRouter.post('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, role, departments, allowedInstructionIds, authMethod } = req.body;
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
    const newUser = await User.create({ 
      username: normalizedEmail, 
      email: normalizedEmail, 
      passwordHash, 
      role: role || 'user',
      departments: departments || ['Всі підрозділи'],
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

    res.json({ 
      success: true, 
      user: { 
        id: newUser._id, 
        email: newUser.email,
        username: newUser.username, 
        role: newUser.role,
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
    if (replace) {
      await Section.deleteMany({});
      await Question.deleteMany({});
    }
    
    if (sections?.length) await Section.insertMany(sections);
    if (questions?.length) await Question.insertMany(questions);

    // After import, ensure users' progress does not reference deleted or non-existent instructions
    const allCurrentSections = await Section.find({} as any, { id: 1 } as any);
    const currentValidIds = allCurrentSections.map(s => s.id);
    await Progress.updateMany(
      {},
      { $pull: { readSectionIds: { $nin: currentValidIds } } } as any
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import data' });
  }
});

apiRouter.post('/admin/generate-instruction', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Check mime type (we accept text, pdf, word doc generally)
    // For simplicity, we use Gemini's File API for processing documents natively
    const mimeType = req.file.mimetype;
    let fileResult;
    try {
      fileResult = await ai.files.upload({
        file: req.file.path,
        config: {
          mimeType: req.file.mimetype,
          displayName: req.file.originalname
        }
      });
    } catch (uploadErr: any) {
      console.error('File API upload error', uploadErr);
      let errMsg = 'Failed to upload document to AI Assistant';
      if (uploadErr?.message && uploadErr.message.includes('429')) {
        errMsg = 'Помилка API (429): Недостатньо коштів на балансі Gemini API або перевищено ліміт запитів. Будь ласка, поповніть баланс Google AI Studio.';
      } else if (uploadErr?.message) {
        errMsg = uploadErr.message;
      }
      return res.status(500).json({ error: errMsg });
    } finally {
      // Clean up the local temp file after uploading to Gemini
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Failed to clean up temp file', e);
      }
    }

    // Now wait for the file to be processed
    let fileState = await ai.files.get({ name: fileResult.name });
    while (fileState.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileState = await ai.files.get({ name: fileResult.name });
    }
    
    if (fileState.state === 'FAILED') {
      return res.status(500).json({ error: 'AI Assistant failed to process the document format.' });
    }

    // Now generate the markdown
    const aiPromptGuide = `ВИКОРИСТОВУЙ ЦЕЙ ПРОМПТ ДЛЯ ІНШИХ МОДЕЛЕЙ ШІ (ChatGPT, Claude, Gemini, DeepSeek):
-------------------------------------------------------------------------
Ти — провідний експерт з корпоративного навчання, регламентів бізнес-процесів та укладання професійних тестів.
Твоє завдання: перенести додану робочу інструкцію/регламент компанії у цей додаток У ТОМУ САМОМУ ВИГЛЯДІ (повний текст, розділи, таблиці, малюнки/скріншоти), забезпечити співробітнику зручне повноцінне читання та ознайомлення, а в кінці вивести контрольні блоки та тестові питання для квіз-опитування.

Формат результату — єдиний самодостатній файл Markdown (.md) суворо за такою структурою:

# Назва інструкції: [Повна назва інструкції або регламенту]
**Підзаголовок:** [Коротке роз'яснення для кого і в яких ситуаціях застосовується]
**Підрозділ:** [Назва підрозділу, наприклад: Відділ роздрібного продажу / Казначейство / Бухгалтерія / Склад]
**Суть:** [1-2 речення з головною суттю регламенту — що потрібно знати в першу чергу]
**Роль:** [Одне зі значень: all | cashier | manager | accountant]
**Першоджерело:** [Номер наказу, регламенту або номер сторінки, наприклад: Стор. 1–4, Регламент №12]
**Час читання:** [Орієнтовний час вивчення, наприклад: 5 хв]

### ПОВНИЙ ТЕКСТ ІНСТРУКЦІЇ
[Встав сюди ПОВНИЙ оригінальний текст регламенту без скорочень!
Зберігай усю початкову структуру, заголовки, параграфи, виноски, примітки та описи.]

### ПОКРОКОВИЙ ПОРЯДОК ДІЙ
[Якщо регламент містить послідовність операцій, розпиши їх покроково:]
#### Крок 1: [Коротка назва дії]
[Детальний опис дій співробітника в інтерфейсі програми чи на робочому місці]
💡 Підказка: [Корисна порада для прискорення роботи або запобігання помилкам]
⚠️ Увага: [Попередження про критичні нюанси]

#### Крок 2: [Наступна дія]
[Опис кроку 2]

---
В КІНЦІ ОСНОВНОЇ ІНСТРУКЦІЇ ОБОВ'ЯЗКОВО СФОРМУЙ 3 АНАЛІТИЧНІ БЛОКИ ТА СИСТЕМНІ ДІЇ:

### ОСНОВНІ ВИСНОВКИ
- [Ключовий висновок 1 — головне правило, яке працівник повинен запам'ятати]
- [Ключовий висновок 2]
- [Ключовий висновок 3]

### КЛЮЧОВІ ПОЛЯ ТА РЕКВІЗИТИ
- [Обов'язкове поле/реквізит 1: наприклад, «Статус чека — тільки "Пробитий"»]
- [Обов'язкове поле/реквізит 2: наприклад, «Номер первинного фіскального чека»]
- [Обов'язкове поле/реквізит 3: наприклад, «Заява покупця з паспортними даними при сумі > 100 грн»]

### СТОП-СПИСКИ
- [Критична заборона 1: Категорично заборонено видавати готівку, якщо покупка була оплачена карткою!]
- [Критична заборона 2: Заборонено проводити повернення без заяви покупця при сумі понад 100 грн!]
- [Критична заборона 3: Дія, яка тягне за собою збій, штраф чи скаргу клієнта]

### АВТОМАТИЧНІ ДІЇ СИСТЕМИ
- [Дія 1: Що облікова програма (BAS, CRM, ПРРО) проводить автоматично]
- [Дія 2: Автоматичні бухгалтерські, касові чи складські рухи]

### ТАБЛИЦЯ ВІДПОВІДНОСТЕЙ ТА ВІДПОВІДАЛЬНОСТІ
| Ситуація / Умова | Дія співробітника | Відповідальна особа | Термін |
| --- | --- | --- | --- |
| [Умова 1] | [Дія 1] | [Посада] | [Термін] |
| [Умова 2] | [Дія 2] | [Посада] | [Термін] |

---
БЛОК ПИТАНЬ ДЛЯ КВІЗ-ОПИТУ (ТЕСТУВАННЯ):

### ПИТАННЯ: [Текст практичного запитання 1 на основі реальної робочої ситуації?]
**Складність:** [easy | medium | hard]
**Контекст:** [Реальна робоча ситуація клієнта або інцидент, на якому ґрунтується питання]
**Першоджерело:** [Пункт регламенту чи сторінка]
- [ ] [Неправильний варіант відповіді A]
- [x] [ПРАВИЛЬНИЙ варіант відповіді — позначається строго через [x]]
- [ ] [Неправильний варіант відповіді B]
- [ ] [Неправильний варіант відповіді C]
**Пояснення:** [Детальне обґрунтування, чому ця відповідь правильна з посиланням на регламент і логіку системи]

ВИМОГИ ДО ТЕСТОВИХ ПИТАНЬ:
1. Склади від 3 до 6 якісних запитань різної складності (easy, medium, hard).
2. Запитання обов'язково повинні спиратися на текст інструкції, Ключові поля та СТОП-СПИСКИ.
3. Рівно один варіант відповіді має бути позначений як правильний через [x].
4. У відповіді виводь виключно готовий текст Markdown без вступних слів, привітань та сторонніх коментарів.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [
          { text: aiPromptGuide },
          { fileData: { fileUri: fileResult.uri, mimeType: fileResult.mimeType } }
        ]}
      ]
    });

    const markdownText = response.text || '';
    
    // Optional: Clean up the file from Gemini storage
    try {
      await ai.files.delete({ name: fileResult.name });
    } catch (e) {
      console.error('Failed to delete file from Gemini', e);
    }

    res.json({ success: true, markdown: markdownText });
  } catch (err: any) {
    console.error('Failed to generate instruction via AI', err);
    let errMsg = 'Помилка при генерації через AI';
    if (err?.message && err.message.includes('429')) {
      errMsg = 'Помилка API (429): Недостатньо коштів на балансі Gemini API або перевищено ліміт запитів. Будь ласка, поповніть баланс Google AI Studio.';
    } else if (err?.message) {
      errMsg = err.message;
    }
    res.status(500).json({ error: errMsg });
  }
});

apiRouter.post('/admin/courses', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, department, instructionIds, useCases, hasCertificate, certificateValidityYears } = req.body;
    const course = await Course.create({ 
      id: `course-${Date.now()}`, 
      title, 
      department, 
      instructionIds,
      useCases,
      hasCertificate,
      certificateValidityYears
    } as any);
    res.json({ success: true, course });
  } catch (err) {
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
    await Course.findOneAndDelete(query);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

apiRouter.put('/admin/courses/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, department, instructionIds, useCases, hasCertificate, certificateValidityYears } = req.body;
    const course = await Course.findOneAndUpdate(
      { id: req.params.id } as any,
      { title, department, instructionIds, useCases, hasCertificate, certificateValidityYears } as any,
      { new: true } as any
    );
    res.json({ success: true, course });
  } catch (err) {
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
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting instruction:', err);
    res.status(500).json({ error: 'Failed to delete instruction' });
  }
});

apiRouter.put('/admin/instructions/:id/full', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { section, questions } = req.body;
    const instructionId = req.params.id;

    // Update section fields fully
    await Section.findOneAndUpdate(
      { id: instructionId } as any,
      section,
      { new: true } as any
    );

    // Replace all questions for this section
    await Question.deleteMany({ sectionId: instructionId } as any);
    if (questions && questions.length > 0) {
      // Ensure sectionId is set correctly on all questions
      const qsToInsert = questions.map((q: any) => ({ ...q, sectionId: instructionId }));
      await Question.insertMany(qsToInsert);
    }

    res.json({ success: true });
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

    const courses = await Course.find(courseQuery);
    
    // If not admin, restrict instruction visibility
    if (req.user.role !== 'admin') {
       const allowedInstructions = new Set<string>(req.user.allowedInstructionIds || []);
       if (allowedInstructions.size === 0) {
          // If no specific restrictions, allow based on visible courses OR visible department
          const deps = req.user.departments || [];
          if (!deps.includes('Всі підрозділи')) {
            const courseInstIds = courses.flatMap(c => c.instructionIds);
            instructionQuery.$or = [
              { department: { $in: deps } },
              { id: { $in: courseInstIds } }
            ];
          }
       }
    }

    const sections = await Section.find(instructionQuery);
    const sectionIds = sections.map(s => s.id);
    const questions = await Question.find({ sectionId: { $in: sectionIds } } as any);
    
    // Also fetch cases that belong to these courses (or all for admin)
    const caseQuery: any = {};
    if (req.user.role !== 'admin') {
      caseQuery.isActive = true;
      const courseCaseIds = courses.flatMap(c => c.caseIds || []);
      caseQuery.id = { $in: courseCaseIds };
    }
    const cases = await Case.find(caseQuery);
    
    res.json({ courses, sections, questions, cases });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

apiRouter.get('/progress', requireAuth, async (req: any, res) => {
  try {
    let progress = await Progress.findOne({ userId: req.user._id } as any);
    if (!progress) {
      progress = await Progress.create({ userId: req.user._id, readSectionIds: [], testScores: [] } as any);
    } else {
      // Auto-clean stale or duplicate readSectionIds against actual existing sections
      const currentSections = await Section.find({} as any, { id: 1 } as any);
      const validSectionIds = new Set(currentSections.map(s => s.id));
      const rawIds: string[] = progress.readSectionIds || [];
      const seen = new Set<string>();
      const cleanedIds: string[] = [];
      for (const id of rawIds) {
        if (validSectionIds.has(id) && !seen.has(id)) {
          seen.add(id);
          cleanedIds.push(id);
        }
      }
      if (cleanedIds.length !== rawIds.length) {
        progress.readSectionIds = cleanedIds;
        await progress.save();
      }
    }
    res.json({ progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

apiRouter.post('/progress', requireAuth, async (req: any, res) => {
  try {
    const { readSectionIds, testScore, employeeInfo } = req.body;
    let progress = await Progress.findOne({ userId: req.user._id } as any);
    if (!progress) progress = new Progress({ userId: req.user._id, readSectionIds: [], testScores: [], certificates: [] } as any);

    if (readSectionIds && Array.isArray(readSectionIds)) {
      const currentSections = await Section.find({} as any, { id: 1 } as any);
      const validSectionIds = new Set(currentSections.map(s => s.id));
      const seen = new Set<string>();
      const sanitizedIds: string[] = [];
      for (const id of readSectionIds) {
        if (validSectionIds.has(id) && !seen.has(id)) {
          seen.add(id);
          sanitizedIds.push(id);
        }
      }
      progress.readSectionIds = sanitizedIds;
    }
    if (employeeInfo) progress.employeeInfo = employeeInfo;
    
    if (testScore) {
      progress.testScores.push(testScore);
      
      if (testScore.courseId && testScore.percentage >= 80) {
        const course = await Course.findOne({ id: testScore.courseId } as any);
        if (course && course.hasCertificate) {
          const hasExisting = progress.certificates.find((c: any) => c.courseId === course.id);
          const validityYears = course.certificateValidityYears || 1;
          const issuedAt = new Date();
          const expiresAt = new Date();
          expiresAt.setFullYear(issuedAt.getFullYear() + validityYears);
          
          if (hasExisting) {
            hasExisting.issuedAt = issuedAt;
            hasExisting.expiresAt = expiresAt;
          } else {
            progress.certificates.push({
              courseId: course.id,
              courseTitle: course.title,
              issuedAt,
              expiresAt
            });
          }
        }
      }
    }
    
    progress.updatedAt = new Date();
    await progress.save();
    res.json({ success: true, progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Admin: Get summary of all users and their progress stats
apiRouter.get('/admin/users-progress', requireAuth, requireAdmin, async (req, res) => {
  try {
    const currentSections = await Section.find({} as any, { id: 1 } as any);
    const validSectionIds = new Set(currentSections.map(s => s.id));
    const totalSectionsCount = currentSections.length;

    const users = await User.find().select('-passwordHash -authCode').sort({ createdAt: -1 });
    const userIds = users.map(u => u._id);
    const progressList = await Progress.find({ userId: { $in: userIds } } as any);
    const progressMap = new Map();
    progressList.forEach((p: any) => {
      progressMap.set(p.userId.toString(), p);
    });

    const userStats = users.map(u => {
      const p = progressMap.get(u._id.toString());
      const testScores = p?.testScores || [];
      const bestScore = testScores.length > 0 ? Math.max(...testScores.map((s: any) => s.percentage || 0)) : 0;
      const totalAnswers = testScores.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
      
      const rawReadIds: string[] = p?.readSectionIds || [];
      const validReadSet = new Set(rawReadIds.filter(id => validSectionIds.has(id)));
      const readCount = Math.min(validReadSet.size, totalSectionsCount);

      return {
        _id: u._id,
        id: u._id.toString(),
        email: u.email || u.username,
        username: u.username,
        role: u.role,
        departments: u.departments || [],
        allowedInstructionIds: u.allowedInstructionIds || [],
        createdAt: u.createdAt,
        employeeInfo: p?.employeeInfo || null,
        stats: {
          readCount,
          testsCount: testScores.length,
          bestScore,
          certificatesCount: p?.certificates?.length || 0,
          totalQuestionsAnswered: totalAnswers,
          lastActivity: p?.updatedAt || p?.testScores?.[p.testScores.length - 1]?.date || null
        }
      };
    });

    res.json({ users: userStats });
  } catch (err) {
    console.error('Failed to fetch users progress', err);
    res.status(500).json({ error: 'Failed to fetch users progress' });
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

    let progress = await Progress.findOne({ userId: targetUser._id } as any);
    if (!progress) {
      progress = {
        userId: targetUser._id,
        readSectionIds: [],
        testScores: [],
        certificates: [],
        employeeInfo: null
      } as any;
    } else {
      const currentSections = await Section.find({} as any, { id: 1 } as any);
      const validSectionIds = new Set(currentSections.map(s => s.id));
      const rawIds: string[] = progress.readSectionIds || [];
      const seen = new Set<string>();
      const cleanedIds: string[] = [];
      for (const id of rawIds) {
        if (validSectionIds.has(id) && !seen.has(id)) {
          seen.add(id);
          cleanedIds.push(id);
        }
      }
      if (cleanedIds.length !== rawIds.length) {
        progress.readSectionIds = cleanedIds;
        await progress.save();
      }
    }

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
