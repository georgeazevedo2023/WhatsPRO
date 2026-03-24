import { forwardRef } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'O WhatsApp não vai bloquear minha conta?',
    answer: 'O WhatsPRO possui sistema de delays anti-bloqueio configurável. Você define o intervalo entre cada mensagem (recomendamos 3-5 segundos), o que simula o comportamento humano e evita detecção. Milhares de empresas usam diariamente sem problemas.',
  },
  {
    question: 'Preciso instalar algo no celular?',
    answer: 'Não! Basta escanear o QR Code com o WhatsApp do seu celular, igual ao WhatsApp Web. Sua instância fica conectada na nuvem e você acessa de qualquer lugar.',
  },
  {
    question: 'Funciona com grupos e contatos individuais?',
    answer: 'Sim! Você pode disparar para grupos do WhatsApp (ideal para comunidades) ou importar uma base de leads (telefones) para campanhas de prospecção. Ambos os modos estão inclusos.',
  },
  {
    question: 'Posso conhecer a plataforma antes de contratar?',
    answer: 'Claro! Agende uma demonstração gratuita pelo WhatsApp e nosso time mostrará todas as funcionalidades ao vivo, tirando suas dúvidas em tempo real.',
  },
  {
    question: 'E se eu não gostar?',
    answer: 'Sem problemas. Você pode cancelar a qualquer momento sem burocracia. Nosso objetivo é que você tenha resultados reais com a ferramenta.',
  },
  {
    question: 'Quantas instâncias posso conectar?',
    answer: 'Depende do seu plano. O plano inicial permite 3 instâncias simultâneas. Planos profissionais oferecem 10, 25 ou instâncias ilimitadas. Você pode escalar conforme cresce.',
  },
];

const FAQSection = forwardRef<HTMLElement>((_, _ref) => {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <section ref={ref} className="relative z-10 py-20 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Dúvidas Frequentes
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Tudo que você precisa saber antes de começar
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className={cn("max-w-3xl mx-auto transition-all duration-700", isInView ? "animate-fade-in" : "opacity-0 translate-y-10")}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass-card rounded-xl px-6 border-0"
              >
                <AccordionTrigger className="text-left font-display font-semibold text-lg hover:text-primary py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
});

FAQSection.displayName = 'FAQSection';

export default FAQSection;