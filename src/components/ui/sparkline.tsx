import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = 'hsl(var(--primary))', className, height = 24, width = 64 }: SparklineProps) {
  if (!data.length) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height * 0.8) - height * 0.1;
    return `${x},${y}`;
  }).join(' ');

  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const trendColor = trend > 0 ? 'hsl(var(--success))' : trend < 0 ? 'hsl(var(--destructive))' : color;

  return (
    <svg className={cn('shrink-0', className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={trendColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
