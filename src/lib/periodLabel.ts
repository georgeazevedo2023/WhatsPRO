// Rótulo humano do período dos dashboards (filtro do gestor: 24h/7/15/30/60 dias).
// FONTE ÚNICA — evita o texto quebrado "últimos 1 dias" quando periodDays === 1.
// Use em TODO consumidor de periodDays que exiba o período ao usuário.
export function formatPeriodLabel(periodDays: number, capitalized = false): string {
  const label = periodDays === 1 ? 'últimas 24h' : `últimos ${periodDays} dias`;
  return capitalized ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}
