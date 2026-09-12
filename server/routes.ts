import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Section, Question, Progress, Department, Course, Case } from './models.js';

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
    const { username, password } = req.body;
    const user = await User.findOne({ username } as any);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // SECURITY REQ: Block default 'admin' if another admin exists
    if (username === 'admin') {
      const otherAdmins = await User.countDocuments({ role: 'admin', username: { $ne: 'admin' } });
      if (otherAdmins > 0) {
        return res.status(403).json({ error: 'Системний обліковий запис вимкнено з міркувань безпеки. Використовуйте створеного адміністратора.' });
      }
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
    
    res.json({ user: { id: user._id, username: user.username, role: user.role, departments: user.departments, allowedCourseIds: user.allowedCourseIds } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  res.json({ success: true });
});

apiRouter.get('/auth/me', requireAuth, (req: any, res) => {
  res.json({ user: { id: req.user._id, username: req.user.username, role: req.user.role, departments: req.user.departments, allowedInstructionIds: req.user.allowedInstructionIds } });
});

// --- ADMIN ROUTES ---
apiRouter.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find().select('-passwordHash');
  res.json({ users });
});

apiRouter.put('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { departments, allowedInstructionIds, role, username, password } = req.body;
    const updateData: any = {};
    if (departments) updateData.departments = departments;
    if (allowedInstructionIds) updateData.allowedInstructionIds = allowedInstructionIds;
    if (role) updateData.role = role;
    if (username) updateData.username = username;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    const updated = await User.findOneAndUpdate({ _id: req.params.id } as any, updateData, { new: true } as any).select('-passwordHash');
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
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
    const { username, password, role } = req.body;
    const existing = await User.findOne({ username } as any);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, passwordHash, role: role || 'user' } as any);
    
    // SECURITY: Delete default admin immediately if a new admin is created
    if (newUser.role === 'admin' && newUser.username !== 'admin') {
      await User.deleteOne({ username: 'admin' } as any);
      console.log('🔒 Security: Removed default admin user because a custom admin was created.');
    }

    res.json({ success: true, user: { id: newUser._id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
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
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import data' });
  }
});

apiRouter.post('/admin/courses', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, department, instructionIds, hasCertificate, certificateValidityYears } = req.body;
    const course = await Course.create({ 
      id: `course-${Date.now()}`, 
      title, 
      department, 
      instructionIds,
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
    await Course.findOneAndDelete({ id: req.params.id } as any);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

apiRouter.put('/admin/courses/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, department, instructionIds, hasCertificate, certificateValidityYears } = req.body;
    const course = await Course.findOneAndUpdate(
      { id: req.params.id } as any,
      { title, department, instructionIds, hasCertificate, certificateValidityYears } as any,
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
    await Section.findOneAndDelete({ id: instructionId } as any);
    await Question.deleteMany({ sectionId: instructionId } as any);
    
    // Also remove this instruction from any courses
    await Course.updateMany(
      { instructionIds: instructionId } as any,
      { $pull: { instructionIds: instructionId } } as any
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete instruction' });
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
    const { title, scenario, options, isActive } = req.body;
    const newCase = await Case.create({
      id: `case-${Date.now()}`,
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
    await Case.findOneAndDelete({ id: caseId } as any);
    await Course.updateMany(
      { caseIds: caseId } as any,
      { $pull: { caseIds: caseId } } as any
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

apiRouter.put('/admin/cases/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, scenario, options, isActive } = req.body;
    const updatedCase = await Case.findOneAndUpdate(
      { id: req.params.id } as any,
      { title, scenario, options, isActive } as any,
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
    }
    res.json({ progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

apiRouter.post('/progress', requireAuth, async (req: any, res) => {
  try {
    const { readSectionIds, testScore } = req.body;
    let progress = await Progress.findOne({ userId: req.user._id } as any);
    if (!progress) progress = new Progress({ userId: req.user._id, readSectionIds: [], testScores: [], certificates: [] } as any);

    if (readSectionIds) progress.readSectionIds = readSectionIds;
    
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
