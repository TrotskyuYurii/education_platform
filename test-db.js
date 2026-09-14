import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({ username: String, email: String }));
  const users = await User.find({});
  console.log('Total users:', users.length);
  console.log(users);
  process.exit(0);
});
