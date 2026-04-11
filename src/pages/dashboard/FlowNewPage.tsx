import { useNavigate } from 'react-router-dom'
import { ClipboardList, Zap, MessageSquare, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ModeCard {
  icon: React.ReactNode
  title: string
  description: string
  details: string
  bestFor: string
  path: string
  disabled?: boolean
  comingSoon?: boolean
}

const MODE_CARDS: ModeCard[] = [
  {
    icon: <ClipboardList className="h-8 w-8 text-blue-500" />,
    title: 'Formulário',
    description: 'Configure cada etapa manualmente com total controle',
    details: 'Defina gatilhos, steps e subagentes no seu ritmo. Ideal para quem tem um processo de atendimento bem definido.',
    bestFor: 'Equipes com processo definido',
    path: '/dashboard/flows/new/wizard?mode=form',
  },
  {
    icon: <Zap className="h-8 w-8 text-yellow-500" />,
    title: 'Templates',
    description: 'Comece com um template pré-configurado e customize depois',
    details: '12 templates prontos para os principais casos de uso: SDR, Vitrine, Suporte, Agendamento e mais.',
    bestFor: 'Começar rápido com boas práticas',
    path: '/dashboard/flows/new/templates',
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-purple-400" />,
    title: 'Conversa Guiada',
    description: 'A IA monta o fluxo em uma conversa interativa',
    details: 'Descreva seu objetivo em linguagem natural e a IA configura tudo automaticamente.',
    bestFor: 'Usuários que preferem descrever',
    path: '',
    disabled: true,
    comingSoon: true,
  },
]

export default function FlowNewPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-1 text-muted-foreground"
            onClick={() => navigate('/dashboard/flows')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Criar novo fluxo</h1>
          <p className="text-muted-foreground mt-1">Escolha como quer construir</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODE_CARDS.map((card) => (
            <div
              key={card.title}
              className={`relative rounded-xl border-2 p-6 flex flex-col transition-all ${
                card.disabled
                  ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
                  : 'cursor-pointer border-border hover:border-primary hover:shadow-md bg-card'
              }`}
              onClick={() => !card.disabled && navigate(card.path)}
            >
              {card.comingSoon && (
                <Badge className="absolute top-3 right-3 text-xs" variant="secondary">
                  Em breve
                </Badge>
              )}

              <div className="mb-4">{card.icon}</div>

              <h2 className="font-semibold text-base mb-1">{card.title}</h2>
              <p className="text-sm text-muted-foreground mb-3 flex-1">{card.description}</p>
              <p className="text-xs text-muted-foreground mb-4">{card.details}</p>

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Ideal para:</span> {card.bestFor}
                </p>
              </div>

              {!card.disabled && (
                <Button className="mt-4 w-full" size="sm">
                  Selecionar
                </Button>
              )}
              {card.disabled && (
                <Button className="mt-4 w-full" size="sm" disabled>
                  Disponível em breve
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
