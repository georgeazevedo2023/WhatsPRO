import { QrCode, MousePointerClick, Rocket } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const steps = [
  {
    number: '01',
    icon: QrCode,
    title: 'Conecte',
    description: 'Escaneie o QR Code para conectar sua instância do WhatsApp. Leva menos de 1 minuto.',
  },
  {
    number: '02',
    icon: MousePointerClick,
    title: 'Configure',
    description: 'Escolha grupos, importe leads e monte sua mensagem. Texto, imagem ou carrossel.',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Dispare',
    description: 'Envie instantaneamente ou agende para depois. Acompanhe tudo em tempo real.',
  },
];

const HowItWorksSection = () => {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <section ref={ref} className="relative z-10 py-20 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Simples como <span className="text-gradient">1, 2, 3</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Comece a disparar mensagens em minutos, não em horas
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (desktop) */}
            <div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />
            
            {steps.map((step, index) => (
              <div
                key={index}
                className={cn("relative text-center transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}
                style={{ transitionDelay: isInView ? `${index * 150}ms` : '0ms' }}
              >
                {/* Step Circle */}
                <div className="relative inline-flex mb-6">
                  <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center relative z-10">
                    <step.icon className="w-10 h-10 text-primary" />
                  </div>
                  {/* Number Badge */}
                  <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-sm z-20">
                    {step.number}
                  </div>
                </div>
                
                <h3 className="font-display font-bold text-2xl mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
