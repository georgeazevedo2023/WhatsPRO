import { useCountUp } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const stats = [
  { end: 10000, suffix: '+', label: 'Mensagens por dia', prefix: '' },
  { end: 500, suffix: '+', label: 'Empresas ativas', prefix: '' },
  { end: 99.9, suffix: '%', label: 'Uptime garantido', prefix: '', decimals: true },
];

const StatCounter = ({ 
  end, 
  suffix, 
  label, 
  prefix = '',
  decimals = false,
  delay = 0 
}: { 
  end: number; 
  suffix: string; 
  label: string; 
  prefix?: string;
  decimals?: boolean;
  delay?: number;
}) => {
  const { formattedCount, ref } = useCountUp({ 
    end: decimals ? Math.floor(end) : end, 
    suffix: decimals ? '.9%' : suffix, 
    prefix,
    delay 
  });

  return (
    <div ref={ref} className="text-center p-6">
      <div className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-gradient mb-2">
        {decimals ? `${Math.floor(end)}.9%` : formattedCount}
      </div>
      <div className="text-muted-foreground text-lg">{label}</div>
    </div>
  );
};

const SocialProofNumbers = () => {
  const { ref, isInView } = useInView({ threshold: 0.3 });

  return (
    <section ref={ref} className="relative z-10 py-16 border-t border-border/50">
      <div className="container mx-auto px-4">
        <div className={cn("glass-card rounded-2xl py-8 px-4 transition-all duration-700", isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10")}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:divide-x md:divide-border/30">
            {stats.map((stat, index) => (
              <StatCounter
                key={index}
                end={stat.end}
                suffix={stat.suffix}
                label={stat.label}
                prefix={stat.prefix}
                decimals={stat.decimals}
                delay={index * 200}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProofNumbers;
