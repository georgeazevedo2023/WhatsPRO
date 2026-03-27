/**
 * Shared constants for status_ia values
 * Eliminates magic strings across the frontend
 */

export const STATUS_IA = {
  LIGADA: 'ligada',
  DESLIGADA: 'desligada',
  SHADOW: 'shadow',
} as const;

export type StatusIA = typeof STATUS_IA[keyof typeof STATUS_IA];
