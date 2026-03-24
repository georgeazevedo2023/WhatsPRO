import { Ban, Clock, BarChart3 } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const painPoints = [
  {
    icon: Ban,
    title: 'Conta Bloqueada',
    description: 'Perdeu sua conta do WhatsApp por enviar muitas mensagens de uma vez. Precisou começar do zero.',
    color: 'destructive',
  },
  {
    icon: Clock,
    title: 'Horas Desperdiçadas',
    description: 'Gasta horas copiando e colando a mesma mensagem para dezenas de grupos diferentes.',
    color: 'warning',
  },
  {
    icon: BarChart3,
    title: 'Sem Controle',
    description: 'Não sabe quantas mensagens foram realmente entregues ou quem visualizou.',
    color: 'destructive',
  },
];

const PainSection = () => {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section ref={ref} className="relative z-10 py-20 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Você já passou por isso?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Se você trabalha com vendas ou marketing no WhatsApp, 
            provavelmente já enfrentou esses problemas:
          </p>
        </div>

        {/* Pain Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {painPoints.map((pain, index) => (
            <div
              key={index}
              className={cn("group relative p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-destructive/30 transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}
              style={{ transitionDelay: isInView ? `${index * 100}ms` : '0ms' }}
            >
              {/* Red accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-destructive/50 to-destructive/20" />
              
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                pain.color === 'warning' 
                  ? 'bg-warning/10 border border-warning/20' 
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                <pain.icon className={`w-7 h-7 ${
                  pain.color === 'warning' ? 'text-warning' : 'text-destructive'
                }`} />
              </div>
              
              <h3 className="font-display font-semibold text-xl mb-2">
                {pain.title}
              </h3>
              <p className="text-muted-foreground">
                {pain.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PainSection;
