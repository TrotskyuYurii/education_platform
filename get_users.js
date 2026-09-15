import mongoose from 'mongoose';
import { User, Role } from './server/models.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/viatec_db');
  const user = await User.findOne({ email: 'admin@viatec.ua' });
  console.log('User:', user?.email, user?.roleKeys, user?._id);
  const roles = await Role.find({});
  console.log('Roles:', roles.map(r => r.key));
  process.exit(0);
}
run();
