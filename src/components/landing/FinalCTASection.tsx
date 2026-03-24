import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, MessageCircle } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const FinalCTASection = forwardRef<HTMLElement>((_, _ref) => {
  const { ref, isInView } = useInView({ threshold: 0.3 });

  return (
    <section ref={ref} className="relative z-10 py-24 border-t border-border/50 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 rounded-full blur-[120px]" />
      
      <div className="container mx-auto px-4 relative">
        <div className={cn("max-w-3xl mx-auto text-center transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
          {/* Headline */}
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
            Comece a automatizar suas mensagens{' '}
            <span className="text-gradient">agora</span>
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Junte-se a mais de 500 empresas que já economizam tempo e vendem mais 
            com o WhatsPRO.
          </p>
          
          {/* CTA Button */}
          <a href="https://wa.me/5581993856099?text=Olá! Gostaria de agendar uma demonstração do WhatsPRO." target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="glow-primary text-lg px-10 py-7 mb-8">
              <MessageCircle className="w-5 h-5 mr-2" />
              Agendar Demonstração
            </Button>
          </a>
          
          {/* Trust Elements */}
          <div className="mt-10 pt-10 border-t border-border/30 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-5 h-5 text-primary" />
              <span>Conexão segura SSL</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Suporte via WhatsApp</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

FinalCTASection.displayName = 'FinalCTASection';

export default FinalCTASection;