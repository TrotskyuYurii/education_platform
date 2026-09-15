import mongoose from 'mongoose';
import { Role } from './server/models.js';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/viatec_db');
  
  const rolesToCreate = [
    {
      key: 'admin',
      title: 'Адміністратор',
      isSystem: true,
      permissions: [
        { permission: 'admin.access', scope: 'all' },
        { permission: 'users.profile.edit', scope: 'all' },
        { permission: 'users.profile.view', scope: 'all' },
        { permission: 'knowledge.article.publish', scope: 'all' },
        { permission: 'learning.assignment.create', scope: 'all' },
        { permission: 'analytics.report.view', scope: 'all' },
        { permission: 'certificate.revoke', scope: 'all' }
      ]
    },
    {
      key: 'employee',
      title: 'Співробітник',
      isSystem: true,
      permissions: [
        { permission: 'users.profile.view', scope: 'self' },
        { permission: 'learning.assignment.view', scope: 'self' }
      ]
    },
    {
      key: 'manager',
      title: 'Керівник',
      isSystem: false,
      permissions: [
        { permission: 'users.profile.view', scope: 'team' },
        { permission: 'analytics.report.view', scope: 'team' },
        { permission: 'learning.assignment.create', scope: 'team' }
      ]
    }
  ];

  for (const roleDef of rolesToCreate) {
    await Role.findOneAndUpdate({ key: roleDef.key }, roleDef, { upsert: true });
  }

  console.log('Roles seeded.');
  process.exit(0);
}
seed();
