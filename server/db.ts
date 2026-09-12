import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Department } from './models.js'; // Ensure .js for ESM

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
  const adminExists = await User.findOne({ role: 'admin' } as any);
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      passwordHash,
      role: 'admin',
      departments: ['Всі підрозділи']
    } as any);
    console.log('🌱 Seeded default admin user (username: admin, password: admin123)');
  }

  const defaultDep = await Department.findOne({ name: 'Всі підрозділи' } as any);
  if (!defaultDep) {
    await Department.create({ name: 'Всі підрозділи' } as any);
    console.log('🌱 Seeded default department "Всі підрозділи"');
  }
}
