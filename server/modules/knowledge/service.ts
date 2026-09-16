import mongoose from 'mongoose';
import { KnowledgeSpace, InstructionVersion } from './models.js';
import { Section, Course, User } from '../../models.js';
import { finalizePendingUpload } from '../../services/fileStorage.js';

export interface CreateSpaceDTO {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  color?: string;
  department?: string;
  order?: number;
  isActive?: boolean;
}

export class KnowledgeService {
  /**
   * Seed default Knowledge Spaces and initial revisions for existing instructions
   */
  static async initializeDefaults(): Promise<void> {
    const existingCount = await KnowledgeSpace.countDocuments();
    if (existingCount === 0) {
      const defaultSpaces = [
        {
          id: 'space-general',
          name: 'Загальнокорпоративний простір',
          code: 'GEN',
          description: 'Загальні стандарти компанії, корпоративні регламенти, безпека та правила взаємодії',
          icon: 'BookOpen',
          color: 'blue',
          isDefault: true,
          order: 1,
          isActive: true
        },
        {
          id: 'space-logistics',
          name: 'Склад та логістика',
          code: 'LOG',
          description: 'Регламенти складського обліку, резервування, приймання та відвантаження товарів',
          icon: 'Package',
          color: 'amber',
          department: 'Складська логістика',
          isDefault: false,
          order: 2,
          isActive: true
        },
        {
          id: 'space-sales',
          name: 'Продажі та робота з клієнтами',
          code: 'SALES',
          description: 'Стандарти роботи з клієнтами, B2B дистрибуція, супровід замовлень та переговори',
          icon: 'TrendingUp',
          color: 'purple',
          department: 'Менеджер з продажів',
          isDefault: false,
          order: 3,
          isActive: true
        },
        {
          id: 'space-finance',
          name: 'Фінанси та бухгалтерія',
          code: 'FIN',
          description: 'Касова дисципліна, фінансова звітність, первинні документи та взаєморозрахунки',
          icon: 'CreditCard',
          color: 'emerald',
          department: 'Бухгалтерія',
          isDefault: false,
          order: 4,
          isActive: true
        },
        {
          id: 'space-it-security',
          name: 'IT та безпека систем',
          code: 'IT',
          description: 'Інструкції користування корпоративними сервісами, кібербезпека та збереження даних',
          icon: 'ShieldCheck',
          color: 'indigo',
          department: 'IT',
          isDefault: false,
          order: 5,
          isActive: true
        }
      ];

      await KnowledgeSpace.insertMany(defaultSpaces);
      console.log('✅ Default Knowledge Spaces seeded successfully');
    }

    // Auto-bind unassigned sections to spaces based on department
    const spaces = await KnowledgeSpace.find({ isActive: true });
    const spaceByDept = new Map<string, string>();
    spaces.forEach(s => {
      if (s.department) {
        spaceByDept.set(s.department.toLowerCase().trim(), s.id);
      }
    });

    const sections = await Section.find({});
    for (const sec of sections) {
      let spaceId = sec.spaceId || 'space-general';
      if (!sec.spaceId || sec.spaceId === 'space-general') {
        const depLower = (sec.department || '').toLowerCase().trim();
        for (const [deptKey, sId] of spaceByDept.entries()) {
          if (depLower.includes(deptKey) || deptKey.includes(depLower)) {
            spaceId = sId;
            break;
          }
        }
      }

      // Check if version is initialized
      const currentVersion = sec.version || '1.0';
      const currentVerNum = sec.versionNumber || 1;
      const currentStatus = sec.status || 'published';
      const changeLog = sec.changeLog || 'Початкова публікація';

      let needsUpdate = false;
      if (sec.spaceId !== spaceId || !sec.version || !sec.status) {
        sec.spaceId = spaceId;
        sec.version = currentVersion;
        sec.versionNumber = currentVerNum;
        sec.status = currentStatus;
        sec.changeLog = changeLog;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await sec.save();
      }

      // Ensure at least one initial revision exists in InstructionVersion
      const versionCount = await InstructionVersion.countDocuments({ sectionId: sec.id });
      if (versionCount === 0) {
        await InstructionVersion.create({
          sectionId: sec.id,
          version: currentVersion,
          versionNumber: currentVerNum,
          status: currentStatus,
          title: sec.title || 'Без назви',
          subtitle: sec.subtitle || '',
          summary: sec.summary || '',
          contentMarkdown: sec.contentMarkdown || '',
          contentHtml: sec.contentHtml || '',
          keyPoints: sec.keyPoints || [],
          keyFields: sec.keyFields || [],
          stopRules: sec.stopRules || [],
          steps: sec.steps || [],
          tableData: sec.tableData || null,
          sourceFile: sec.sourceFile || undefined,
          rawMarkdown: sec.rawMarkdown || '',
          changeSummary: 'Початкова редакція регламенту (v1.0)',
          authorName: 'Система / Методист',
          createdAt: sec.createdAt || new Date()
        });
      }
    }

    // Also update courses with spaceId if missing
    const courses = await Course.find({});
    for (const course of courses) {
      if (!course.spaceId || !course.version || !course.status) {
        let spaceId = 'space-general';
        const depLower = (course.department || '').toLowerCase().trim();
        for (const [deptKey, sId] of spaceByDept.entries()) {
          if (depLower.includes(deptKey) || deptKey.includes(depLower)) {
            spaceId = sId;
            break;
          }
        }
        course.spaceId = course.spaceId || spaceId;
        course.version = course.version || '1.0';
        course.status = course.status || 'published';
        await course.save();
      }
    }
  }

  /**
   * Get all active (or all) knowledge spaces
   */
  static async getSpaces(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    const spaces = await KnowledgeSpace.find(filter).sort({ order: 1, name: 1 });

    // Aggregate counts of published instructions per space
    const sections = await Section.find({ isActive: true }).select('spaceId status');
    const courses = await Course.find({ isActive: true }).select('spaceId status');

    const instructionCountBySpace: Record<string, { total: number; published: number; draft: number }> = {};

    sections.forEach((s: any) => {
      const spId = s.spaceId || 'space-general';
      if (!instructionCountBySpace[spId]) {
        instructionCountBySpace[spId] = { total: 0, published: 0, draft: 0 };
      }
      instructionCountBySpace[spId].total += 1;
      if (s.status === 'published') instructionCountBySpace[spId].published += 1;
      if (s.status === 'draft' || s.status === 'in_review') instructionCountBySpace[spId].draft += 1;
    });

    const courseCountBySpace: Record<string, number> = {};
    courses.forEach((c: any) => {
      const spId = c.spaceId || 'space-general';
      courseCountBySpace[spId] = (courseCountBySpace[spId] || 0) + 1;
    });

    return spaces.map(sp => ({
      _id: sp._id,
      id: sp.id,
      name: sp.name,
      code: sp.code,
      description: sp.description,
      icon: sp.icon,
      color: sp.color,
      department: sp.department,
      order: sp.order,
      isActive: sp.isActive,
      isDefault: sp.isDefault,
      createdAt: sp.createdAt,
      stats: {
        totalInstructions: instructionCountBySpace[sp.id]?.total || 0,
        publishedInstructions: instructionCountBySpace[sp.id]?.published || 0,
        draftInstructions: instructionCountBySpace[sp.id]?.draft || 0,
        totalCourses: courseCountBySpace[sp.id] || 0
      }
    }));
  }

  /**
   * Create a new Knowledge Space
   */
  static async createSpace(data: CreateSpaceDTO, user: any) {
    const rawId = data.id || `space-${Date.now()}`;
    const cleanId = rawId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const existing = await KnowledgeSpace.findOne({ id: cleanId });
    if (existing) {
      throw new Error(`Простір з ідентифікатором «${cleanId}» вже існує`);
    }

    const space = await KnowledgeSpace.create({
      id: cleanId,
      name: data.name,
      code: data.code || cleanId.substring(0, 4).toUpperCase(),
      description: data.description || '',
      icon: data.icon || 'BookOpen',
      color: data.color || 'indigo',
      department: data.department || '',
      order: data.order !== undefined ? data.order : 10,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDefault: false
    });

    return space;
  }

  /**
   * Update an existing Knowledge Space
   */
  static async updateSpace(id: string, data: Partial<CreateSpaceDTO>) {
    const space = await KnowledgeSpace.findOne({ id });
    if (!space) {
      throw new Error('Простір не знайдено');
    }

    if (data.name !== undefined) space.name = data.name;
    if (data.code !== undefined) space.code = data.code;
    if (data.description !== undefined) space.description = data.description;
    if (data.icon !== undefined) space.icon = data.icon;
    if (data.color !== undefined) space.color = data.color;
    if (data.department !== undefined) space.department = data.department;
    if (data.order !== undefined) space.order = data.order;
    if (data.isActive !== undefined) space.isActive = data.isActive;
    space.updatedAt = new Date();

    await space.save();
    return space;
  }

  /**
   * Delete a Knowledge Space (moves contents to default space)
   */
  static async deleteSpace(id: string) {
    const space = await KnowledgeSpace.findOne({ id });
    if (!space) throw new Error('Простір не знайдено');
    if (space.isDefault || space.id === 'space-general') {
      throw new Error('Загальнокорпоративний базовий простір не можна видалити');
    }

    // Re-assign all sections and courses to space-general
    await Section.updateMany({ spaceId: id }, { $set: { spaceId: 'space-general' } });
    await Course.updateMany({ spaceId: id }, { $set: { spaceId: 'space-general' } });

    await KnowledgeSpace.deleteOne({ id });
    return { success: true, reassignedTo: 'space-general' };
  }

  /**
   * Get version history for a specific section
   */
  static async getSectionVersions(sectionId: string) {
    const versions = await InstructionVersion.find({ sectionId })
      .sort({ versionNumber: -1, createdAt: -1 });
    return versions;
  }

  /**
   * Publish a new version / revision of an instruction
   */
  static async createVersion(
    sectionId: string,
    sectionUpdate: any,
    user: any,
    options: {
      incrementType?: 'minor' | 'major' | 'patch';
      changeSummary?: string;
      status?: 'draft' | 'in_review' | 'published' | 'archived';
    } = {}
  ) {
    const section = await Section.findOne({ id: sectionId });
    if (!section) {
      throw new Error('Регламент не знайдено');
    }

    const currentVersionNumber = section.versionNumber || 1;
    const currentVersionStr = section.version || '1.0';

    let nextVerNum = currentVersionNumber + 1;
    let nextVersionStr = currentVersionStr;

    // Calculate semantic version string
    const [majorStr = '1', minorStr = '0'] = currentVersionStr.split('.');
    let major = parseInt(majorStr, 10) || 1;
    let minor = parseInt(minorStr, 10) || 0;

    if (options.incrementType === 'major') {
      major += 1;
      minor = 0;
      nextVersionStr = `${major}.0`;
    } else {
      // Default minor
      minor += 1;
      nextVersionStr = `${major}.${minor}`;
    }

    const newStatus = options.status || sectionUpdate.status || section.status || 'published';
    const changeSummary = options.changeSummary || sectionUpdate.changeLog || `Оновлення редакції до v${nextVersionStr}`;

    // Source file / raw markdown are handled separately from the generic field spread below
    const { sourceFileToken, sourceFileName, sourceMimeType, rawMarkdown, ...restUpdate } = sectionUpdate || {};

    // Apply updates to section
    Object.assign(section, restUpdate, {
      version: nextVersionStr,
      versionNumber: nextVerNum,
      status: newStatus,
      changeLog: changeSummary,
      lastReviewedAt: new Date(),
      reviewedBy: user?._id || undefined
    });

    if (sourceFileToken) {
      // A new original file was uploaded for this revision
      section.sourceFile = finalizePendingUpload(sourceFileToken, sectionId, nextVerNum, sourceFileName, sourceMimeType);
    }
    // If no new file was uploaded, section.sourceFile simply carries over from the previous revision

    if (rawMarkdown !== undefined) {
      section.rawMarkdown = rawMarkdown;
    }

    await section.save();

    // Create revision snapshot in InstructionVersion
    const versionRecord = await InstructionVersion.create({
      sectionId,
      version: nextVersionStr,
      versionNumber: nextVerNum,
      status: newStatus,
      title: section.title,
      subtitle: section.subtitle || '',
      summary: section.summary || '',
      contentMarkdown: section.contentMarkdown || '',
      contentHtml: section.contentHtml || '',
      keyPoints: section.keyPoints || [],
      keyFields: section.keyFields || [],
      stopRules: section.stopRules || [],
      steps: section.steps || [],
      tableData: section.tableData || null,
      sourceFile: section.sourceFile || undefined,
      rawMarkdown: section.rawMarkdown || '',
      changeSummary,
      authorId: user?._id,
      authorName: user?.fullName || user?.username || 'Адміністратор',
      authorEmail: user?.email || '',
      createdAt: new Date()
    });

    return {
      section,
      versionRecord
    };
  }

  /**
   * Restore a historical revision of an instruction
   */
  static async restoreVersion(sectionId: string, versionNumber: number, user: any) {
    const historical = await InstructionVersion.findOne({ sectionId, versionNumber });
    if (!historical) {
      throw new Error(`Ревізію з номером ${versionNumber} не знайдено`);
    }

    const section = await Section.findOne({ id: sectionId });
    if (!section) throw new Error('Регламент не знайдено');

    // Create new version marking the rollback
    const currentVerNum = section.versionNumber || 1;
    const currentVerStr = section.version || '1.0';
    const [maj = '1', min = '0'] = currentVerStr.split('.');
    const nextVerStr = `${maj}.${parseInt(min, 10) + 1}`;
    const nextVerNum = currentVerNum + 1;

    section.title = historical.title;
    section.subtitle = historical.subtitle;
    section.summary = historical.summary;
    section.contentMarkdown = historical.contentMarkdown;
    section.contentHtml = historical.contentHtml;
    section.keyPoints = historical.keyPoints;
    section.keyFields = historical.keyFields;
    section.stopRules = historical.stopRules;
    section.steps = historical.steps;
    section.tableData = historical.tableData;
    section.sourceFile = historical.sourceFile || section.sourceFile;
    section.rawMarkdown = historical.rawMarkdown !== undefined ? historical.rawMarkdown : section.rawMarkdown;
    section.version = nextVerStr;
    section.versionNumber = nextVerNum;
    section.status = historical.status || 'published';
    section.changeLog = `Відновлено зміст з версії v${historical.version}`;
    section.lastReviewedAt = new Date();
    section.reviewedBy = user?._id;

    await section.save();

    const rollbackSnapshot = await InstructionVersion.create({
      sectionId,
      version: nextVerStr,
      versionNumber: nextVerNum,
      status: section.status,
      title: section.title,
      subtitle: section.subtitle,
      summary: section.summary,
      contentMarkdown: section.contentMarkdown,
      contentHtml: section.contentHtml,
      keyPoints: section.keyPoints,
      keyFields: section.keyFields,
      stopRules: section.stopRules,
      steps: section.steps,
      tableData: section.tableData,
      sourceFile: section.sourceFile || undefined,
      rawMarkdown: section.rawMarkdown || '',
      changeSummary: `Відкат (rollback) до параметрів версії v${historical.version}`,
      authorId: user?._id,
      authorName: user?.fullName || user?.username || 'Адміністратор',
      authorEmail: user?.email || '',
      createdAt: new Date()
    });

    return {
      section,
      restoredFromVersion: historical.version,
      newVersionRecord: rollbackSnapshot
    };
  }

  /**
   * Get the stored original-file metadata for a specific historical revision
   */
  static async getVersionSourceFile(sectionId: string, versionNumber: number) {
    const historical = await InstructionVersion.findOne({ sectionId, versionNumber });
    if (!historical) throw new Error('Ревізію не знайдено');
    return historical;
  }

  /**
   * Change document lifecycle status: draft | in_review | published | archived
   */
  static async updateStatus(
    sectionId: string, 
    status: 'draft' | 'in_review' | 'published' | 'archived',
    reviewNotes: string,
    user: any
  ) {
    const section = await Section.findOne({ id: sectionId });
    if (!section) throw new Error('Регламент не знайдено');

    const oldStatus = section.status || 'published';
    section.status = status;
    section.reviewNotes = reviewNotes || '';
    section.lastReviewedAt = new Date();
    section.reviewedBy = user?._id;

    await section.save();

    // Also update the latest revision status
    await InstructionVersion.findOneAndUpdate(
      { sectionId, versionNumber: section.versionNumber },
      { $set: { status } }
    );

    return {
      success: true,
      sectionId,
      oldStatus,
      newStatus: status,
      reviewedAt: section.lastReviewedAt
    };
  }

  /**
   * Aggregate knowledge base metrics
   */
  static async getKnowledgeMetrics() {
    const [spacesCount, sections, courses, versionsCount] = await Promise.all([
      KnowledgeSpace.countDocuments({ isActive: true }),
      Section.find({ isActive: true }).select('status spaceId readTimeMin'),
      Course.find({ isActive: true }).select('status spaceId'),
      InstructionVersion.countDocuments()
    ]);

    let publishedCount = 0;
    let draftCount = 0;
    let inReviewCount = 0;
    let archivedCount = 0;
    let totalReadTime = 0;

    sections.forEach((s: any) => {
      const st = s.status || 'published';
      if (st === 'published') publishedCount += 1;
      else if (st === 'draft') draftCount += 1;
      else if (st === 'in_review') inReviewCount += 1;
      else if (st === 'archived') archivedCount += 1;
      totalReadTime += (s.readTimeMin || 0);
    });

    return {
      spacesCount,
      totalInstructions: sections.length,
      totalCourses: courses.length,
      publishedCount,
      draftCount,
      inReviewCount,
      archivedCount,
      totalRevisions: versionsCount,
      totalReadTimeMin: totalReadTime
    };
  }
}
