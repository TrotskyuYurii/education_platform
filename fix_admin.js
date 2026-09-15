import mongoose from 'mongoose';
import { User } from './server/models.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/viatec_db');
  await User.findOneAndUpdate({ email: 'y.trotskiy@viatec.ua' }, { $set: { roleKeys: ['admin'], role: 'admin' } });
  console.log('Fixed admin role');
  process.exit(0);
}
run();
