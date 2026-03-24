export const STATUS_OPTIONS = [
  { value: 'aberta', label: 'Atendendo', color: 'bg-emerald-500', icon: '🟢' },
  { value: 'pendente', label: 'Aguardando', color: 'bg-yellow-500', icon: '🟡' },
  { value: 'resolvida', label: 'Resolvida', color: 'bg-blue-500', icon: '✅' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'alta', label: 'Alta', color: 'bg-destructive' },
  { value: 'media', label: 'Média', color: 'bg-warning' },
  { value: 'baixa', label: 'Baixa', color: 'bg-primary' },
] as const;

/** Maps status value -> dot color class (for quick lookups). */
export const STATUS_COLOR_MAP: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.color]),
);

/** Maps priority value -> dot color class (for quick lookups). */
export const PRIORITY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  PRIORITY_OPTIONS.map((p) => [p.value, p.color]),
);
