import { Check, X, ArrowRight } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const beforeItems = [
  'Envios manuais, um por um',
  'Risco constante de bloqueio',
  'Sem rastreamento de entregas',
  'Uma conta por vez',
  'Horas de trabalho repetitivo',
];

const afterItems = [
  'Automação inteligente em massa',
  'Delays anti-bloqueio configuráveis',
  'Histórico completo com métricas',
  'Múltiplas instâncias simultâneas',
  'Minutos em vez de horas',
];

const TransformationSection = () => {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <section ref={ref} className="relative z-10 py-20 border-t border-border/50 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            De <span className="text-muted-foreground line-through">caótico</span> para{' '}
            <span className="text-gradient">profissional</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Veja como o WhatsPRO transforma sua rotina de comunicação no WhatsApp
          </p>
        </div>

        {/* Before/After Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {/* Before */}
          <div className={cn("transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
            <div className="p-6 rounded-2xl bg-card/50 border border-destructive/20 h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="font-display font-bold text-xl text-destructive">Antes</h3>
              </div>
              
              <ul className="space-y-4">
                {beforeItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* After */}
          <div className={cn("transition-all duration-700 delay-100", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
            <div className="p-6 rounded-2xl glass-card border-primary/30 h-full relative overflow-hidden">
              {/* Glow effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-primary">Depois</h3>
                </div>
                
                <ul className="space-y-4">
                  {afterItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-foreground font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bridge Statement */}
        <div className={cn("text-center mt-12 transition-all duration-700 delay-200", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card/50 border border-border/50">
            <span className="text-muted-foreground">O</span>
            <span className="font-display font-bold text-primary">WsmartQR</span>
            <span className="text-muted-foreground">é a ponte entre o caos manual e a automação profissional</span>
            <ArrowRight className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default TransformationSection;
