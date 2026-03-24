import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  color?: string; // tailwind color class like 'blue' 'orange' 'rose'
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

const colorMap: Record<string, string> = {
  blue: 'from-blue-500/8 to-transparent',
  orange: 'from-orange-500/8 to-transparent',
  rose: 'from-rose-500/8 to-transparent',
  indigo: 'from-indigo-500/8 to-transparent',
  cyan: 'from-cyan-500/8 to-transparent',
  green: 'from-emerald-500/8 to-transparent',
  violet: 'from-violet-500/8 to-transparent',
  amber: 'from-amber-500/8 to-transparent',
  primary: 'from-primary/8 to-transparent',
};

export function PageHeader({ icon: Icon, title, description, color = 'primary', badge, action, children }: PageHeaderProps) {
  const gradient = colorMap[color] || colorMap.primary;

  return (
    <div className={cn('rounded-xl bg-gradient-to-r p-4 sm:p-5 -mx-1', gradient)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-display font-bold">{title}</h1>
              {badge}
            </div>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
