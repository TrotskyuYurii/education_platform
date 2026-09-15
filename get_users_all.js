import mongoose from 'mongoose';
import { User } from './server/models.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/viatec_db');
  const users = await User.find({});
  console.log('Users:', users.map(u => ({ email: u.email, id: u._id, roleKeys: u.roleKeys })));
  process.exit(0);
}
run();
