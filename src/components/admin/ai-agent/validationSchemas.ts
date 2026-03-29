import { z } from 'zod';

export const BRAIN_MODELS = ['gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4.1', 'gemini-2.5-flash', 'gemini-2.5-pro'] as const;

export const brainSchema = z.object({
  model: z.enum(BRAIN_MODELS, { errorMap: () => ({ message: 'Modelo invalido' }) }),
  temperature: z.number().min(0, 'Minimo: 0').max(1, 'Maximo: 1'),
  max_tokens: z.number().int().min(100, 'Minimo: 100').max(8192, 'Maximo: 8192'),
}).partial();

export const rulesSchema = z.object({
  handoff_cooldown_minutes: z.number().int().min(5, 'Minimo: 5 min').max(1440, 'Maximo: 1440 min (24h)'),
  max_lead_messages: z.number().int().min(1, 'Minimo: 1').max(50, 'Maximo: 50'),
}).partial();

export const guardrailsSchema = z.object({
  max_discount_percent: z.number().min(0, 'Minimo: 0%').max(100, 'Maximo: 100%').nullable().optional(),
}).partial();

export const voiceSchema = z.object({
  voice_max_text_length: z.number().int().min(10, 'Minimo: 10').max(500, 'Maximo: 500'),
}).partial();

export const BRAIN_FIELDS = new Set(['model', 'temperature', 'max_tokens']);
export const RULES_FIELDS = new Set(['handoff_cooldown_minutes', 'max_lead_messages']);
export const GUARDRAILS_FIELDS = new Set(['max_discount_percent']);
export const VOICE_FIELDS = new Set(['voice_max_text_length']);

export const SCHEMA_MAP: Array<{ fields: Set<string>; schema: z.ZodTypeAny }> = [
  { fields: BRAIN_FIELDS, schema: brainSchema },
  { fields: RULES_FIELDS, schema: rulesSchema },
  { fields: GUARDRAILS_FIELDS, schema: guardrailsSchema },
  { fields: VOICE_FIELDS, schema: voiceSchema },
];
