import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserCheck, ShoppingCart, Headphones, Calendar, ArrowRightLeft } from 'lucide-react';

interface SubAgentDef {
  key: string;
  label: string;
  description: string;
  icon: typeof Users;
  defaultPrompt: string;
}

const SUB_AGENTS: SubAgentDef[] = [
  {
    key: 'sdr',
    label: 'SDR (Qualificação)',
    description: 'Qualifica leads: coleta nome, cidade, interesses, necessidade. Faz 1 pergunta por vez.',
    icon: UserCheck,
    defaultPrompt: 'Você é o agente de qualificação. Seu objetivo é coletar dados do lead (nome, cidade, produto de interesse) fazendo UMA pergunta por mensagem. Quando tiver produto + nome, transfira para o agente de vendas ou faça handoff.',
  },
  {
    key: 'sales',
    label: 'Vendas',
    description: 'Apresenta produtos, envia carrosseis, responde sobre preços e disponibilidade.',
    icon: ShoppingCart,
    defaultPrompt: 'Você é o agente de vendas. Busque produtos no catálogo com search_products, apresente com send_carousel quando tiver 2+ opções. Destaque benefícios e diferenciais. Quando o lead demonstrar interesse em comprar, faça handoff para atendente.',
  },
  {
    key: 'support',
    label: 'Suporte',
    description: 'Responde dúvidas com base na Knowledge Base, FAQ e documentos.',
    icon: Headphones,
    defaultPrompt: 'Você é o agente de suporte. Responda dúvidas do cliente com base no conhecimento disponível. Se não souber a resposta, transfira para atendente humano. Seja empático e objetivo.',
  },
  {
    key: 'scheduling',
    label: 'Agendamento',
    description: 'Agenda visitas, reuniões e callbacks. Coleta data, horário e preferências.',
    icon: Calendar,
    defaultPrompt: 'Você é o agente de agendamento. Colete data, horário e preferência do lead para agendar visita ou reunião. Confirme os dados antes de finalizar. Quando tiver tudo, faça handoff com os dados do agendamento.',
  },
  {
    key: 'handoff',
    label: 'Transbordo',
    description: 'Gerencia a transição para atendente humano. Coleta motivo e dados finais.',
    icon: ArrowRightLeft,
    defaultPrompt: 'Você é o agente de transbordo. Informe o lead que um atendente assumirá em breve. Colete qualquer informação pendente (nome, motivo) e use handoff_to_human com um resumo completo dos dados coletados.',
  },
];

interface SubAgentsConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function SubAgentsConfig({ config, onChange }: SubAgentsConfigProps) {
  const subAgents: Record<string, { enabled: boolean; prompt: string; priority: number }> =
    config.sub_agents || {};

  const getAgent = (key: string) => subAgents[key] || { enabled: false, prompt: '', priority: 0 };

  const updateAgent = (key: string, updates: Partial<{ enabled: boolean; prompt: string }>) => {
    const current = getAgent(key);
    onChange({
      sub_agents: {
        ...subAgents,
        [key]: { ...current, ...updates },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Sub-Agentes</span>
        <span className="text-xs text-muted-foreground">— Personalize o comportamento por tipo de interação</span>
      </div>

      {SUB_AGENTS.map((def) => {
        const agent = getAgent(def.key);
        const Icon = def.icon;

        return (
          <Card key={def.key} className={!agent.enabled ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  {def.label}
                </CardTitle>
                <Switch
                  checked={agent.enabled}
                  onCheckedChange={(enabled) => updateAgent(def.key, { enabled })}
                />
              </div>
              <CardDescription className="text-xs">{def.description}</CardDescription>
            </CardHeader>
            {agent.enabled && (
              <CardContent>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Prompt do sub-agente</Label>
                <Textarea
                  value={agent.prompt || def.defaultPrompt}
                  onChange={(e) => updateAgent(def.key, { prompt: e.target.value })}
                  placeholder={def.defaultPrompt}
                  className="min-h-[80px] resize-none text-xs"
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
