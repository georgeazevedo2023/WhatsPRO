import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
}

const StatsCard = ({ title, value, icon: Icon, description, trend, className }: StatsCardProps) => {
  return (
    <Card className={cn('glass-card-hover', className)}>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl md:text-2xl font-display font-bold leading-tight">{value}</p>
            {description && (
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'text-[10px] md:text-xs font-medium',
                  trend.positive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.positive ? '+' : ''}{trend.value}% vs ontem
              </p>
            )}
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(StatsCard);
