import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Department } from './models.js'; // Ensure .js for ESM
import { KnowledgeService } from './modules/knowledge/service.js';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI is not set. The application will start in "Setup Required" mode.');
    return false;
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
    await seedDefaults();
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    return false;
  }
}

async function seedDefaults() {
  const otherAdmins = await User.countDocuments({ role: 'admin', username: { $ne: 'admin' } } as any);

  if (otherAdmins === 0) {
    const adminExists = await User.findOne({ username: 'admin' } as any);
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        email: 'admin@viatec.ua',
        passwordHash,
        role: 'admin',
        departments: ['Всі підрозділи'],
        requireEmailCode: false
      } as any);
      console.log('🌱 Seeded default admin user (username: admin, password: admin123)');
    }
  } else {
    // SECURITY: Remove default admin if a custom admin has been created
    const defaultAdmin = await User.findOne({ username: 'admin' } as any);
    if (defaultAdmin) {
      await User.deleteOne({ username: 'admin' } as any);
      console.log('🔒 Security: Removed default admin user because a custom admin exists.');
    }
  }

  const defaultDep = await Department.findOne({ name: 'Всі підрозділи' } as any);
  if (!defaultDep) {
    await Department.create({ name: 'Всі підрозділи' } as any);
    console.log('🌱 Seeded default department "Всі підрозділи"');
  }

  // Seed Knowledge Base Spaces and initial document revisions
  try {
    await KnowledgeService.initializeDefaults();
  } catch (kErr) {
    console.error('⚠️ Could not initialize knowledge spaces defaults:', kErr);
  }
}
