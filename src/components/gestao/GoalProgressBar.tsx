// M19 S4 P6: Barra de progresso de meta configurável
// Retorna null se target=0 (sem meta definida) — nada é renderizado
import React from 'react';

interface GoalProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;          // '%', 'USD', 'min', 'R$', etc.
  invertColors?: boolean; // true quando menor é melhor (ex: tempo, custo)
}

export default function GoalProgressBar({
  label,
  current,
  target,
  unit = '',
  invertColors = false,
}: GoalProgressBarProps) {
  // Sem meta definida — não renderiza nada
  if (!target || target === 0) return null;

  const progressPct = Math.min((current / target) * 100, 100);

  // Determina cor da barra de acordo com a lógica invertida ou direta
  let barColor: string;
  if (invertColors) {
    // Menor é melhor: verde se current <= target, amarelo se até 30% acima, vermelho se > 30% acima
    if (current <= target) {
      barColor = 'bg-green-500';
    } else if (current <= target * 1.3) {
      barColor = 'bg-yellow-500';
    } else {
      barColor = 'bg-red-500';
    }
  } else {
    // Maior é melhor: verde >= 100%, amarelo 70-99%, vermelho < 70%
    if (progressPct >= 100) {
      barColor = 'bg-green-500';
    } else if (progressPct >= 70) {
      barColor = 'bg-yellow-500';
    } else {
      barColor = 'bg-red-500';
    }
  }

  // Para invertidos, a largura da barra representa o quanto do target foi usado
  const barWidth = invertColors
    ? Math.min((current / target) * 100, 100)
    : progressPct;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">
          {current}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
