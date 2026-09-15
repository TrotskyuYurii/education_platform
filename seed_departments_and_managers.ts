import mongoose from 'mongoose';
import { User, Department } from './server/models.js';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/viatec_db');
  
  // Set up manager relationship for testing
  // Find admin user
  const admin = await User.findOne({ email: 'admin@viatec.ua' });
  const d = await Department.findOne({ name: 'IT' });
  
  if (admin && d) {
    admin.departmentId = d._id;
    admin.managerId = null;
    await admin.save();
    
    // Find all employees, assign to IT and admin manager
    const employees = await User.find({ email: { $ne: 'admin@viatec.ua' } });
    for (const emp of employees) {
      emp.departmentId = d._id;
      emp.managerId = admin._id;
      await emp.save();
    }
    console.log(`Seeded managerId for ${employees.length} employees.`);
  }

  process.exit(0);
}
seed();
