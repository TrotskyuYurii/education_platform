import { User } from '../../models.js';
import { isUserInScope } from '../core/permissions.js';

// Fields every authenticated colleague may see in the directory/profile card —
// deliberately excludes anything from the "managed" or "sensitive" set below.
const selectPublicFields =
  'fullName avatarUrl phone email positionId departmentId locationId managerId isActive';

export interface PeopleListParams {
  q?: string;
  departmentId?: string;
  positionId?: string;
  locationId?: string;
  limit: number;
  skip: number;
}

const buildSearchFilter = (params: PeopleListParams) => {
  const filter: any = { isActive: { $ne: false } };
  if (params.departmentId) filter.departmentId = params.departmentId;
  if (params.positionId) filter.positionId = params.positionId;
  if (params.locationId) filter.locationId = params.locationId;
  if (params.q && params.q.trim()) {
    const re = new RegExp(escapeRegExp(params.q.trim()), 'i');
    filter.$or = [{ fullName: re }, { email: re }, { username: re }];
  }
  return filter;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const toPublicProfile = (u: any) => ({
  id: u._id,
  fullName: u.fullName || '',
  avatarUrl: u.avatarUrl || null,
  phone: u.phone || null,
  email: u.email,
  position: u.positionId ? { id: u.positionId._id, title: u.positionId.title, grade: u.positionId.grade } : null,
  department: u.departmentId ? { id: u.departmentId._id, name: u.departmentId.name } : null,
  location: u.locationId ? { id: u.locationId._id, name: u.locationId.name, city: u.locationId.city } : null,
  manager: u.managerId ? { id: u.managerId._id, fullName: u.managerId.fullName, email: u.managerId.email } : null
});

export const PeopleService = {
  async list(params: PeopleListParams) {
    const filter = buildSearchFilter(params);
    const [items, total] = await Promise.all([
      User.find(filter)
        .select(selectPublicFields)
        .populate('positionId', 'title grade')
        .populate('departmentId', 'name')
        .populate('locationId', 'name city')
        .populate('managerId', 'fullName email')
        .sort({ fullName: 1 })
        .skip(params.skip)
        .limit(params.limit),
      User.countDocuments(filter)
    ]);
    return { items: items.map(toPublicProfile), total };
  },

  async orgChart() {
    const users = await User.find({ isActive: { $ne: false } })
      .select('fullName avatarUrl positionId departmentId managerId')
      .populate('positionId', 'title')
      .populate('departmentId', 'name');
    return users.map(u => ({
      id: u._id,
      fullName: u.fullName || '',
      avatarUrl: u.avatarUrl || null,
      positionTitle: (u.positionId as any)?.title || null,
      departmentName: (u.departmentId as any)?.name || null,
      managerId: u.managerId || null
    }));
  },

  async getProfile(viewer: any, targetId: string) {
    const target = await User.findById(targetId).select(`${selectPublicFields} hireDate customFields`);
    if (!target || target.isActive === false) return null;

    // IMPORTANT: scope must be evaluated against the raw ObjectId refs (departmentId/
    // managerId) *before* populate() replaces them with hydrated subdocuments —
    // otherwise String(target.departmentId) no longer equals String(viewer.departmentId).
    const canViewFull = await isUserInScope(viewer, target, 'users.profile.view');
    const canEdit = await isUserInScope(viewer, target, 'users.profile.edit');

    await target.populate([
      { path: 'positionId', select: 'title grade' },
      { path: 'departmentId', select: 'name' },
      { path: 'locationId', select: 'name city' },
      { path: 'managerId', select: 'fullName email' }
    ]);

    const profile: any = toPublicProfile(target);
    profile.canViewFull = canViewFull;
    profile.canEdit = canEdit;
    if (canViewFull) {
      profile.hireDate = target.hireDate || null;
      profile.customFields = target.customFields ? Object.fromEntries(target.customFields as any) : {};
    }
    return profile;
  }
};
