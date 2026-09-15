import { Router } from 'express';
import { requirePermission, scopeFilter } from '../core/permissions.js';
import { validateRequest } from '../core/validation.js';
import { AnalyticsService } from './service.js';
import { buildXlsx, buildCsv, ExportColumn } from './export.js';
import { ReportFiltersSchema, ExportQuerySchema } from './validation.js';

export const analyticsRouter = Router();

const requireAnalyticsView = requirePermission('analytics.report.view');

const extractFilters = (query: any) => ({
  departmentId: query.departmentId as string | undefined,
  courseId: query.courseId as string | undefined,
  dateFrom: query.dateFrom as string | undefined,
  dateTo: query.dateTo as string | undefined
});

analyticsRouter.get('/coverage', requireAnalyticsView, validateRequest(ReportFiltersSchema), async (req, res, next) => {
  try {
    const result = await AnalyticsService.getCoverageByDepartment((req as any).user, extractFilters(req.query));
    res.json(result);
  } catch (err) { next(err); }
});

analyticsRouter.get('/acknowledgements', requireAnalyticsView, validateRequest(ReportFiltersSchema), async (req, res, next) => {
  try {
    const result = await AnalyticsService.getAcknowledgementsByDepartment((req as any).user, extractFilters(req.query));
    res.json(result);
  } catch (err) { next(err); }
});

analyticsRouter.get('/test-results', requireAnalyticsView, validateRequest(ReportFiltersSchema), async (req, res, next) => {
  try {
    const result = await AnalyticsService.getTestResults((req as any).user, extractFilters(req.query));
    res.json(result);
  } catch (err) { next(err); }
});

analyticsRouter.get('/certificates', requireAnalyticsView, validateRequest(ReportFiltersSchema), async (req, res, next) => {
  try {
    const result = await AnalyticsService.getCertificatesSummary((req as any).user, extractFilters(req.query));
    res.json(result);
  } catch (err) { next(err); }
});

// Content analytics spans the whole knowledge base, not one department/team —
// only viewers whose analytics.report.view scope is 'all' (i.e. the same bar
// as seeing every user's data) can see it.
analyticsRouter.get('/content', requireAnalyticsView, async (req, res, next) => {
  try {
    const filter = await scopeFilter((req as any).user, 'analytics.report.view');
    if (Object.keys(filter).length > 0) {
      return res.status(403).json({ error: 'Аналітика контенту доступна лише з повним доступом до аналітики' });
    }
    const staleDays = req.query.staleDays ? parseInt(String(req.query.staleDays), 10) : 180;
    const result = await AnalyticsService.getContentAnalytics(isNaN(staleDays) ? 180 : staleDays);
    res.json(result);
  } catch (err) { next(err); }
});

const REPORT_COLUMNS: Record<string, ExportColumn[]> = {
  coverage: [
    { key: 'department', header: 'Підрозділ', width: 28 },
    { key: 'total', header: 'Всього' },
    { key: 'assigned', header: 'Призначено' },
    { key: 'inProgress', header: 'У процесі' },
    { key: 'completed', header: 'Завершено' },
    { key: 'overdue', header: 'Прострочено' },
    { key: 'complianceRate', header: '% виконання' }
  ],
  acknowledgements: [
    { key: 'department', header: 'Підрозділ', width: 28 },
    { key: 'total', header: 'Всього' },
    { key: 'signed', header: 'Підписали' },
    { key: 'unsigned', header: 'Не підписали' },
    { key: 'percentSigned', header: '% підписали' }
  ],
  certificates: [
    { key: 'fullName', header: 'ПІБ', width: 28 },
    { key: 'email', header: 'Email', width: 28 },
    { key: 'courseTitle', header: 'Курс', width: 28 },
    { key: 'expiresAt', header: 'Спливає', width: 18 },
    { key: 'daysLeft', header: 'Днів залишилось' }
  ],
  'test-results': [
    { key: 'range', header: 'Діапазон балів' },
    { key: 'count', header: 'Кількість спроб' }
  ]
};

analyticsRouter.get('/export', requireAnalyticsView, validateRequest(ExportQuerySchema), async (req, res, next) => {
  try {
    const { report, format } = req.query as any;
    const filters = extractFilters(req.query);
    const user = (req as any).user;

    let rows: Record<string, any>[];
    let sheetName: string;

    if (report === 'coverage') {
      const data = await AnalyticsService.getCoverageByDepartment(user, filters);
      rows = data.rows; sheetName = 'Покриття навчанням';
    } else if (report === 'acknowledgements') {
      const data = await AnalyticsService.getAcknowledgementsByDepartment(user, filters);
      rows = data.rows; sheetName = 'Ознайомлення';
    } else if (report === 'certificates') {
      const data = await AnalyticsService.getCertificatesSummary(user, filters);
      rows = data.expiringSoon; sheetName = 'Сертифікати, що спливають';
    } else {
      const data = await AnalyticsService.getTestResults(user, filters);
      rows = data.distribution; sheetName = 'Результати тестування';
    }

    const columns = REPORT_COLUMNS[report];
    const filename = `viatec-${report}-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'xlsx') {
      const buffer = await buildXlsx(sheetName, columns, rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      const csv = buildCsv(columns, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    }
  } catch (err) { next(err); }
});
