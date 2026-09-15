import { z } from 'zod';

export const PeopleListQuerySchema = z.object({
  query: z.object({
    q: z.string().optional(),
    departmentId: z.string().optional(),
    positionId: z.string().optional(),
    locationId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    skip: z.coerce.number().int().min(0).default(0)
  })
});

// Self-service edit: an employee may only ever touch their own contact details,
// never org-managed fields (position/department/manager) — those stay HR/admin-only
// via the existing /api/admin/users/:id route.
export const SelfServiceUpdateSchema = z.object({
  body: z.object({
    phone: z.string().max(50).optional(),
    avatarUrl: z.string().max(2000).optional(),
    customFields: z.record(z.string(), z.any()).optional()
  })
});
