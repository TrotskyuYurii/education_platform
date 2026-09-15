import { z } from 'zod';

// Shared query filters across the report endpoints. All optional — an empty
// query means "everything the caller's scope allows, no extra narrowing".
export const ReportFiltersSchema = z.object({
  query: z.object({
    departmentId: z.string().optional(),
    courseId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional()
  })
});

export const ExportQuerySchema = z.object({
  query: z.object({
    report: z.enum(['coverage', 'acknowledgements', 'test-results', 'certificates']),
    format: z.enum(['xlsx', 'csv']),
    departmentId: z.string().optional(),
    courseId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional()
  })
});
