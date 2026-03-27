/**
 * Shared constants for Edge Functions
 * Eliminates magic strings for status_ia and other common values
 */

export const STATUS_IA = {
  LIGADA: 'ligada',
  DESLIGADA: 'desligada',
  SHADOW: 'shadow',
} as const

export type StatusIA = typeof STATUS_IA[keyof typeof STATUS_IA]
