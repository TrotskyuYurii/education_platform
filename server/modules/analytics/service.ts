import mongoose from 'mongoose';
import { User, Section } from '../../models.js';
import { LearningAssignment, Acknowledgment, QuizAttempt, CertificateRecord } from '../learning/models.js';
import { SearchQueryLog } from './models.js';
import { scopeFilter } from '../core/permissions.js';
import { formatDuration } from '../../../shared/attemptDuration.js';

export interface ReportFilters {
  departmentId?: string;
  courseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Resolves "which User _ids may this viewer's report include" by combining the
// existing RBAC scope (self/team/department/all) with an optional department
// narrowing filter from the UI — the scope check happens here, before any
// report aggregation runs, never as an after-the-fact filter on the results.
async function resolveScopedUserIds(viewer: any, permission: string, departmentId?: string): Promise<mongoose.Types.ObjectId[] | 'all'> {
  const baseFilter = await scopeFilter(viewer, permission);
  if (baseFilter._id === null) return [];

  const finalFilter: any = { ...baseFilter };
  if (departmentId) finalFilter.departmentId = departmentId;

  // Scope is 'all' and no extra narrowing — every report's $match can skip the
  // userId filter entirely (cheaper, and avoids loading the whole User collection).
  if (Object.keys(finalFilter).length === 0) return 'all';

  const users = await User.find(finalFilter).select('_id');
  return users.map(u => u._id);
}

const dateRangeMatch = (field: string, dateFrom?: string, dateTo?: string) => {
  const range: any = {};
  if (dateFrom) range.$gte = new Date(dateFrom);
  if (dateTo) range.$lte = new Date(dateTo);
  return Object.keys(range).length ? { [field]: range } : {};
};

// Resolves each assignment's CURRENT department via its user (not the
// department string frozen on the assignment at creation time, which may be
// a stale name or even a raw departmentId string depending on when it was
// created — see Крок 12 investigation notes).
const departmentLookupStages = (userIdField: string) => [
  { $lookup: { from: 'users', localField: userIdField, foreignField: '_id', as: '_user' } },
  { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'departments', localField: '_user.departmentId', foreignField: '_id', as: '_dept' } },
  {
    $addFields: {
      _departmentName: {
        $ifNull: [
          { $arrayElemAt: ['$_dept.name', 0] },
          { $ifNull: [{ $arrayElemAt: ['$_user.departments', 0] }, 'Без підрозділу'] }
        ]
      }
    }
  }
];

export const AnalyticsService = {
  resolveScopedUserIds,

  async getCoverageByDepartment(viewer: any, filters: ReportFilters) {
    const userIds = await resolveScopedUserIds(viewer, 'analytics.report.view', filters.departmentId);
    if (Array.isArray(userIds) && userIds.length === 0) return { rows: [], totals: null };

    const now = new Date();
    const match: any = { ...dateRangeMatch('assignedDate', filters.dateFrom, filters.dateTo) };
    if (filters.courseId) match.targetId = filters.courseId;
    if (userIds !== 'all') match.userId = { $in: userIds };

    const rows = await LearningAssignment.aggregate([
      { $match: match },
      {
        $addFields: {
          _effectiveStatus: {
            $cond: [
              { $and: [{ $ne: ['$status', 'completed'] }, { $lt: ['$dueDate', now] }] },
              'overdue',
              '$status'
            ]
          }
        }
      },
      ...departmentLookupStages('userId'),
      {
        $group: {
          _id: '$_departmentName',
          total: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ['$_effectiveStatus', 'assigned'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$_effectiveStatus', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$_effectiveStatus', 'completed'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ['$_effectiveStatus', 'overdue'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          department: '$_id',
          total: 1, assigned: 1, inProgress: 1, completed: 1, overdue: 1,
          complianceRate: {
            $cond: [{ $eq: ['$total', 0] }, 100, { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }]
          }
        }
      },
      { $sort: { department: 1 } }
    ]);

    const totals = rows.reduce((acc: any, r: any) => ({
      total: acc.total + r.total, assigned: acc.assigned + r.assigned, inProgress: acc.inProgress + r.inProgress,
      completed: acc.completed + r.completed, overdue: acc.overdue + r.overdue
    }), { total: 0, assigned: 0, inProgress: 0, completed: 0, overdue: 0 });

    return { rows, totals };
  },

  async getAcknowledgementsByDepartment(viewer: any, filters: ReportFilters) {
    const userIds = await resolveScopedUserIds(viewer, 'analytics.report.view', filters.departmentId);
    if (Array.isArray(userIds) && userIds.length === 0) return { rows: [], totals: null };

    const match: any = userIds === 'all' ? {} : { _id: { $in: userIds } };

    const rows = await User.aggregate([
      { $match: { ...match, isActive: { $ne: false } } },
      { $lookup: { from: 'acknowledgments', localField: '_id', foreignField: 'userId', as: '_ack' } },
      { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: '_dept' } },
      {
        $addFields: {
          _isSigned: { $ifNull: [{ $arrayElemAt: ['$_ack.isSigned', 0] }, false] },
          _departmentName: {
            $ifNull: [{ $arrayElemAt: ['$_dept.name', 0] }, { $ifNull: [{ $arrayElemAt: ['$departments', 0] }, 'Без підрозділу'] }]
          }
        }
      },
      {
        $group: {
          _id: '$_departmentName',
          total: { $sum: 1 },
          signed: { $sum: { $cond: ['$_isSigned', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0, department: '$_id', total: 1, signed: 1,
          unsigned: { $subtract: ['$total', '$signed'] },
          percentSigned: { $cond: [{ $eq: ['$total', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$signed', '$total'] }, 100] }, 0] }] }
        }
      },
      { $sort: { department: 1 } }
    ]);

    const totals = rows.reduce((acc: any, r: any) => ({
      total: acc.total + r.total, signed: acc.signed + r.signed, unsigned: acc.unsigned + r.unsigned
    }), { total: 0, signed: 0, unsigned: 0 });

    return { rows, totals };
  },

  async getTestResults(viewer: any, filters: ReportFilters) {
    const userIds = await resolveScopedUserIds(viewer, 'analytics.report.view', filters.departmentId);
    if (Array.isArray(userIds) && userIds.length === 0) {
      return { avgScore: 0, totalAttempts: 0, passRate: 0, avgDurationSec: null, distribution: [] };
    }

    // Звіт про тести: проходження кейсів-тренажерів сюди не входять.
    const match: any = { ...dateRangeMatch('date', filters.dateFrom, filters.dateTo), mode: { $ne: 'cases' } };
    if (filters.courseId) match.courseId = filters.courseId;
    if (userIds !== 'all') match.userId = { $in: userIds };

    const [facetResult] = await QuizAttempt.aggregate([
      { $match: match },
      {
        $facet: {
          overall: [
            // $avg пропускає спроби без тривалості (записані до її появи)
            { $group: { _id: null, avgScore: { $avg: '$percentage' }, avgDurationSec: { $avg: '$durationSec' }, totalAttempts: { $sum: 1 }, passedCount: { $sum: { $cond: ['$passed', 1, 0] } } } }
          ],
          distribution: [
            { $bucket: { groupBy: '$percentage', boundaries: [0, 60, 80, 101], default: 'other', output: { count: { $sum: 1 }, avgDurationSec: { $avg: '$durationSec' } } } }
          ]
        }
      }
    ]);

    const overall = facetResult.overall[0] || { avgScore: 0, totalAttempts: 0, passedCount: 0 };
    const bucketLabels: Record<string, string> = { '0': '0-59%', '60': '60-79%', '80': '80-100%' };
    const distribution = [0, 60, 80].map(boundary => {
      const bucket = facetResult.distribution.find((b: any) => b._id === boundary);
      const avgDurationSec = typeof bucket?.avgDurationSec === 'number' ? Math.round(bucket.avgDurationSec) : null;
      return {
        range: bucketLabels[String(boundary)],
        count: bucket?.count || 0,
        avgDurationSec,
        avgDuration: formatDuration(avgDurationSec)
      };
    });

    return {
      avgScore: Math.round(overall.avgScore || 0),
      totalAttempts: overall.totalAttempts,
      passRate: overall.totalAttempts > 0 ? Math.round((overall.passedCount / overall.totalAttempts) * 100) : 0,
      avgDurationSec: typeof overall.avgDurationSec === 'number' ? Math.round(overall.avgDurationSec) : null,
      distribution
    };
  },

  async getCertificatesSummary(viewer: any, filters: ReportFilters) {
    const userIds = await resolveScopedUserIds(viewer, 'analytics.report.view', filters.departmentId);
    if (Array.isArray(userIds) && userIds.length === 0) {
      return { active: 0, revoked: 0, expiringIn30: 0, expiringIn60: 0, expiringIn90: 0, expiringSoon: [] };
    }

    const match: any = {};
    if (filters.courseId) match.courseId = filters.courseId;
    if (userIds !== 'all') match.userId = { $in: userIds };

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 86400000);

    const [facetResult] = await CertificateRecord.aggregate([
      { $match: match },
      {
        $facet: {
          counts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          expiring: [
            { $match: { status: 'active', expiresAt: { $gte: now, $lte: in90Days } } },
            { $sort: { expiresAt: 1 } },
            { $limit: 200 },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: '_user' } },
            { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0, userId: 1, courseTitle: 1, expiresAt: 1,
                fullName: { $ifNull: ['$_user.fullName', '$_user.email'] },
                email: '$_user.email'
              }
            }
          ]
        }
      }
    ]);

    const countsMap = new Map(facetResult.counts.map((c: any) => [c._id, c.count]));
    const expiringSoon = facetResult.expiring.map((e: any) => ({
      ...e,
      daysLeft: Math.ceil((new Date(e.expiresAt).getTime() - now.getTime()) / 86400000)
    }));

    return {
      active: countsMap.get('active') || 0,
      revoked: countsMap.get('revoked') || 0,
      expiringIn30: expiringSoon.filter((e: any) => e.daysLeft <= 30).length,
      expiringIn60: expiringSoon.filter((e: any) => e.daysLeft <= 60).length,
      expiringIn90: expiringSoon.filter((e: any) => e.daysLeft <= 90).length,
      expiringSoon
    };
  },

  // Content analytics is company-wide (not per-department) — gated at the
  // route level to viewers with 'all' scope rather than scoped by user here.
  async getContentAnalytics(staleDays: number = 180) {
    const staleBefore = new Date(Date.now() - staleDays * 86400000);

    const [mostViewed, zeroViewed, stale, noResultSearches] = await Promise.all([
      Section.find({ isActive: { $ne: false } }).sort({ viewsCount: -1 }).limit(10).select('id title viewsCount department'),
      Section.find({ isActive: { $ne: false }, $or: [{ viewsCount: { $exists: false } }, { viewsCount: 0 }] }).select('id title department').limit(50),
      Section.find({ isActive: { $ne: false }, $or: [{ lastReviewedAt: { $exists: false } }, { lastReviewedAt: { $lt: staleBefore } }] })
        .select('id title lastReviewedAt department').limit(50),
      SearchQueryLog.aggregate([
        { $match: { resultCount: 0 } },
        { $group: { _id: '$query', count: { $sum: 1 }, lastSearchedAt: { $max: '$createdAt' } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
        { $project: { _id: 0, query: '$_id', count: 1, lastSearchedAt: 1 } }
      ])
    ]);

    return { mostViewed, zeroViewed, stale, noResultSearches, staleDays };
  }
};
