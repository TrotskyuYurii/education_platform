import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from './models.js';

export const UpdateSettingsSchema = z.object({
  body: z.object({
    disabledEmailTypes: z.array(z.enum(NOTIFICATION_TYPES))
  })
});

export const UpdateTemplateSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    titleTemplate: z.string().min(1).optional(),
    bodyTemplate: z.string().min(1).optional(),
    defaultChannels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).optional(),
    isCritical: z.boolean().optional()
  })
});
