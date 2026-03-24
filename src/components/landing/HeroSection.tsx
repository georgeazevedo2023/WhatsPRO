import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle2, MessageCircle } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const HeroSection = () => {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <section ref={ref} className="relative z-10 py-20 lg:py-28 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className={cn("text-center lg:text-left transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
            {/* Social Proof Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6">
              <Zap className="w-4 h-4" />
              <span className="font-medium">🔥 Usado por +500 empresas no Brasil</span>
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 leading-[1.1]">
              Dispare{' '}
              <span className="text-gradient">+10.000 mensagens</span>{' '}
              no WhatsApp em minutos
              <span className="text-primary">.</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
              A plataforma que agências e empresas usam para automatizar broadcasts, 
              carrosséis e leads no WhatsApp — <strong className="text-foreground">sem perder contas</strong>.
            </p>
            
            {/* CTA */}
            <div className="flex justify-center lg:justify-start mb-8">
              <a href="https://wa.me/5581993856099?text=Olá! Gostaria de agendar uma demonstração do WhatsPRO." target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="glow-primary w-full sm:w-auto text-base px-8 py-6">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Agendar Demonstração
                </Button>
              </a>
            </div>
          </div>

          {/* Right - Dashboard Mockup */}
          <div className={cn("relative transition-all duration-700 delay-200", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-3xl opacity-50" />
              
              {/* Dashboard Preview */}
              <div className="relative glass-card p-4 rounded-2xl">
                <div className="rounded-xl bg-background/80 overflow-hidden border border-border/50">
                  {/* Mock Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card/50">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-destructive/60" />
                      <div className="w-3 h-3 rounded-full bg-warning/60" />
                      <div className="w-3 h-3 rounded-full bg-primary/60" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-3 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
                        dashboard.whatspro.com
                      </div>
                    </div>
                  </div>
                  
                  {/* Mock Content */}
                  <div className="p-4 space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Mensagens Hoje', value: '2,847' },
                        { label: 'Taxa Sucesso', value: '98.5%' },
                        { label: 'Instâncias', value: '12' },
                      ].map((stat, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                          <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                          <div className="text-lg font-display font-bold text-primary">{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Activity Lines */}
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="h-3 bg-muted/50 rounded w-3/4 mb-1" />
                            <div className="h-2 bg-muted/30 rounded w-1/2" />
                          </div>
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                            Enviado
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Badge */}
              <div className="absolute -bottom-4 -left-4 glass-card px-4 py-2 rounded-full animate-float">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium">3 instâncias online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
