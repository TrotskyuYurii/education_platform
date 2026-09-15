import { logger } from '../../server/modules/core/logger.js';
import { User, Section, Department } from '../../server/models.js';

export async function up(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Starting migration 001-org-dictionaries`);

  // 1. Collect unique department names from User and Section
  const users = await User.find({});
  const sections = await Section.find({});

  const deptNames = new Set<string>();
  users.forEach((u: any) => {
    if (u.departments && Array.isArray(u.departments)) {
      u.departments.forEach((d: string) => deptNames.add(d));
    }
  });
  sections.forEach((s: any) => {
    if (s.department) {
      deptNames.add(s.department);
    }
  });

  logger.info(`Found ${deptNames.size} unique department names: ${Array.from(deptNames).join(', ')}`);

  let createdCount = 0;
  const deptMap = new Map<string, any>();

  // 2. Create/Get Department documents
  for (const name of deptNames) {
    if (!name) continue; // Skip empty
    let dep = await Department.findOne({ name });
    if (!dep) {
      if (isDryRun) {
        logger.info(`[DRY-RUN] Would create department: '${name}'`);
        // Mock for mapping logic
        deptMap.set(name, { _id: `mock-id-${name}` });
        createdCount++;
      } else {
        dep = await Department.create({ name });
        deptMap.set(name, dep);
        createdCount++;
        logger.info(`Created department: '${name}'`);
      }
    } else {
      deptMap.set(name, dep);
    }
  }

  // 3. Map User.departmentId to the first element of departments
  let mappedUsersCount = 0;
  for (const u of users as any[]) {
    if (u.departments && u.departments.length > 0) {
      const firstDept = u.departments[0];
      const deptDoc = deptMap.get(firstDept);
      
      if (deptDoc && (!u.departmentId || String(u.departmentId) !== String(deptDoc._id))) {
        if (isDryRun) {
          logger.info(`[DRY-RUN] Would map user ${u.email} to departmentId ${deptDoc._id}`);
          mappedUsersCount++;
        } else {
          u.departmentId = deptDoc._id;
          await u.save();
          mappedUsersCount++;
        }
      }
    }
  }

  logger.info(`Migration 001-org-dictionaries completed. Created ${createdCount} departments, mapped ${mappedUsersCount} users.`);
}

export async function down(isDryRun: boolean) {
  logger.info(`[DRY-RUN: ${isDryRun}] Rolling back 001-org-dictionaries`);
  
  if (isDryRun) {
    logger.info(`[DRY-RUN] Would remove departmentId from all users`);
  } else {
    await User.updateMany({}, { $unset: { departmentId: "" } });
    logger.info(`Removed departmentId from all users`);
  }
}
