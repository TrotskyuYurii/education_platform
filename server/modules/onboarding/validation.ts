import { z } from 'zod';
import { ONBOARDING_STEP_TYPES, ONBOARDING_OWNER_ROLES } from './models.js';

const objectIdOrEmpty = z.string().regex(/^[a-f\d]{24}$/i).or(z.literal('')).optional().nullable();

const stepNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ONBOARDING_STEP_TYPES),
  title: z.string().min(1, 'Крок має містити назву'),
  description: z.string().optional(),
  targetId: z.string().optional(),
  url: z.string().optional(),
  stageKey: z.string().optional(),
  dueOffsetDays: z.number().int().min(-365).max(3650).optional(),
  ownerRole: z.enum(ONBOARDING_OWNER_ROLES).optional(),
  ownerUserId: objectIdOrEmpty,
  isRequired: z.boolean().optional(),
  estimatedMinutes: z.number().int().min(0).max(10000).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional()
});

const stepEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional()
});

const stageSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  dayOffset: z.number().int(),
  color: z.string().optional(),
  order: z.number().int().optional()
});

export const CreateTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Вкажіть назву онбордінгу').max(200),
    description: z.string().max(2000).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    departmentId: objectIdOrEmpty,
    positionId: objectIdOrEmpty,
    durationDays: z.number().int().min(1).max(3650).optional(),
    requiresBuddy: z.boolean().optional(),
    surveyDayOffsets: z.array(z.number().int().min(0).max(3650)).max(10).optional(),
    stages: z.array(stageSchema).max(20).optional(),
    nodes: z.array(stepNodeSchema).max(300).optional(),
    edges: z.array(stepEdgeSchema).max(600).optional()
  })
});

export const UpdateTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    departmentId: objectIdOrEmpty,
    positionId: objectIdOrEmpty,
    status: z.enum(['draft', 'published', 'archived']).optional(),
    durationDays: z.number().int().min(1).max(3650).optional(),
    requiresBuddy: z.boolean().optional(),
    surveyDayOffsets: z.array(z.number().int().min(0).max(3650)).max(10).optional(),
    stages: z.array(stageSchema).max(20).optional(),
    nodes: z.array(stepNodeSchema).max(300).optional(),
    edges: z.array(stepEdgeSchema).max(600).optional()
  })
});

export const AssignTemplateSchema = z.object({
  body: z.object({
    templateId: z.string().min(1),
    targetScope: z.enum(['single', 'multiple', 'department', 'position']),
    userId: objectIdOrEmpty,
    userIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500).optional(),
    departmentId: objectIdOrEmpty,
    positionId: objectIdOrEmpty,
    startDate: z.string().optional(),
    buddyUserId: objectIdOrEmpty,
    notes: z.string().max(2000).optional()
  })
});

export const CompleteStepSchema = z.object({
  body: z.object({
    comment: z.string().max(2000).optional()
  })
});

export const SubmitSurveySchema = z.object({
  body: z.object({
    assignmentId: z.string().regex(/^[a-f\d]{24}$/i),
    dayOffset: z.number().int().min(0).max(3650),
    satisfaction: z.number().int().min(1).max(5),
    nps: z.number().int().min(0).max(10).optional(),
    clarity: z.number().int().min(1).max(5).optional(),
    supportLevel: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(4000).optional()
  })
});

export const AutoRuleSchema = z.object({
  body: z.object({
    templateId: z.string().min(1),
    departmentId: objectIdOrEmpty,
    positionId: objectIdOrEmpty,
    locationId: objectIdOrEmpty,
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional()
  })
});
