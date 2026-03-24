import { 
  Rocket, Send, Palette, Users, Calendar, BarChart3 
} from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Rocket,
    benefit: 'Escale sem contratar',
    description: 'Gerencie múltiplas instâncias do WhatsApp em um painel centralizado. Uma pessoa faz o trabalho de dez.',
  },
  {
    icon: Send,
    benefit: 'Alcance milhares em minutos',
    description: 'Disparador em massa com delay inteligente anti-bloqueio. Envie para grupos ou leads importados.',
  },
  {
    icon: Palette,
    benefit: 'Engaje com visuais profissionais',
    description: 'Crie carrosséis interativos com cards, imagens e botões de ação. Destaque-se na timeline.',
  },
  {
    icon: Users,
    benefit: 'Organize sua base de leads',
    description: 'Importe contatos via Excel, segmente em bases separadas e direcione campanhas específicas.',
  },
  {
    icon: Calendar,
    benefit: 'Programe e esqueça',
    description: 'Agende mensagens para datas e horários específicos. Configure recorrência automática.',
  },
  {
    icon: BarChart3,
    benefit: 'Acompanhe cada resultado',
    description: 'Histórico detalhado de todos os envios com taxa de sucesso, falhas e opção de reenvio.',
  },
];

const FeaturesSection = () => {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section ref={ref} className="relative z-10 py-20 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Tudo que você precisa para{' '}
            <span className="text-gradient">escalar suas vendas</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Funcionalidades pensadas para quem leva o WhatsApp Marketing a sério
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn("group p-6 rounded-2xl glass-card-hover transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}
              style={{ transitionDelay: isInView ? `${index * 80}ms` : '0ms' }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              
              <h3 className="font-display font-bold text-xl mb-2">
                {feature.benefit}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
