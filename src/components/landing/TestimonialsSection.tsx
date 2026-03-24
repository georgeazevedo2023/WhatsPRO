import { Star, Quote } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const testimonials = [
  {
    name: 'João Silva',
    role: 'Diretor de Marketing',
    company: 'Agência Digital Pro',
    content: 'Economizamos 20 horas por semana com o WhatsPRO. Antes, mandávamos mensagem por mensagem. Agora disparamos para 50 grupos em minutos.',
    avatar: 'JS',
    rating: 5,
  },
  {
    name: 'Maria Santos',
    role: 'CEO',
    company: 'E-commerce Fashion',
    content: 'Os carrosséis interativos aumentaram nossa taxa de resposta em 340%. O cliente visualiza os produtos direto no WhatsApp.',
    avatar: 'MS',
    rating: 5,
  },
  {
    name: 'Pedro Costa',
    role: 'Gerente Comercial',
    company: 'Imobiliária Premium',
    content: 'O agendamento automático mudou tudo. Configuro as mensagens domingo e elas são enviadas durante a semana toda.',
    avatar: 'PC',
    rating: 5,
  },
];

const TestimonialsSection = () => {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section ref={ref} className="relative z-10 py-20 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Quem usa, <span className="text-gradient">recomenda</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Veja o que nossos clientes estão dizendo
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={cn("relative p-6 rounded-2xl glass-card transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}
              style={{ transitionDelay: isInView ? `${index * 100}ms` : '0ms' }}
            >
              {/* Quote Icon */}
              <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/20" />
              
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                ))}
              </div>
              
              {/* Content */}
              <p className="text-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
