// M17 F1: Motor de Automação — Dialog de criação/edição de regra
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateAutomationRule,
  useUpdateAutomationRule,
  type AutomationRule,
} from '@/hooks/useAutomationRules';

interface Props {
  open: boolean;
  onClose: () => void;
  funnelId: string;
  rule?: AutomationRule;
}

type TriggerType = AutomationRule['trigger_type'];
type ConditionType = AutomationRule['condition_type'];
type ActionType = AutomationRule['action_type'];

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'card_moved', label: 'Card movido para coluna' },
  { value: 'form_completed', label: 'Formulario completo' },
  { value: 'lead_created', label: 'Lead criado' },
  { value: 'conversation_resolved', label: 'Conversa resolvida' },
  { value: 'tag_added', label: 'Tag adicionada' },
  { value: 'label_applied', label: 'Etiqueta aplicada' },
  { value: 'poll_answered', label: 'Enquete respondida' },
];

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'always', label: 'Sempre (sem condicao)' },
  { value: 'tag_contains', label: 'Conversa tem tag' },
  { value: 'funnel_is', label: 'Funil e este' },
  { value: 'business_hours', label: 'Horario comercial' },
];

const ACTION_OPTIONS: { value: ActionType; label: string; disabled?: boolean }[] = [
  { value: 'send_message', label: 'Enviar mensagem de texto' },
  { value: 'move_card', label: 'Mover card no Kanban' },
  { value: 'add_tag', label: 'Adicionar tag' },
  { value: 'activate_ai', label: 'Ativar IA' },
  { value: 'handoff', label: 'Transbordo para humano' },
  { value: 'send_poll', label: 'Enviar enquete' },
];

function buildEmptyState() {
  return {
    name: '',
    enabled: true,
    trigger_type: 'lead_created' as TriggerType,
    trigger_column_id: '',
    trigger_form_slug: '',
    trigger_tag: '',
    trigger_label: '',
    condition_type: 'always' as ConditionType,
    condition_tag: '',
    condition_business_hours_inside: 'true',
    action_type: 'send_message' as ActionType,
    action_message: '',
    action_column_id: '',
    action_tag: '',
    action_department_id: '',
    // M17 F4: Poll action fields
    action_poll_question: '',
    action_poll_options: ['', ''],
    action_poll_selectable_count: 1,
  };
}

export function AutomationRuleEditor({ open, onClose, funnelId, rule }: Props) {
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();

  const [state, setState] = useState(buildEmptyState());

  // Sync com a regra sendo editada
  useEffect(() => {
    if (rule) {
      const tc = rule.trigger_config as Record<string, string>;
      const cc = rule.condition_config as Record<string, string>;
      const ac = rule.action_config as Record<string, string>;
      setState({
        name: rule.name,
        enabled: rule.enabled,
        trigger_type: rule.trigger_type,
        trigger_column_id: tc.column_id ?? '',
        trigger_form_slug: tc.form_slug ?? '',
        trigger_tag: tc.tag ?? '',
        trigger_label: tc.label ?? '',
        condition_type: rule.condition_type,
        condition_tag: cc.tag ?? '',
        condition_business_hours_inside: cc.inside !== undefined ? String(cc.inside) : 'true',
        action_type: rule.action_type,
        action_message: ac.message ?? '',
        action_column_id: ac.column_id ?? '',
        action_tag: ac.tag ?? '',
        action_department_id: ac.department_id ?? '',
        action_poll_question: ac.question ?? '',
        action_poll_options: (ac.options as unknown as string[]) ?? ['', ''],
        action_poll_selectable_count: Number(ac.selectable_count) || 1,
      });
    } else {
      setState(buildEmptyState());
    }
  }, [rule, open]);

  function set<K extends keyof typeof state>(key: K, value: (typeof state)[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function buildTriggerConfig(): Record<string, unknown> {
    switch (state.trigger_type) {
      case 'card_moved':
        return state.trigger_column_id ? { column_id: state.trigger_column_id } : {};
      case 'form_completed':
        return state.trigger_form_slug ? { form_slug: state.trigger_form_slug } : {};
      case 'tag_added':
        return state.trigger_tag ? { tag: state.trigger_tag } : {};
      case 'label_applied':
        return state.trigger_label ? { label: state.trigger_label } : {};
      default:
        return {};
    }
  }

  function buildConditionConfig(): Record<string, unknown> {
    switch (state.condition_type) {
      case 'tag_contains':
        return { tag: state.condition_tag };
      case 'business_hours':
        return { inside: state.condition_business_hours_inside === 'true' };
      default:
        return {};
    }
  }

  function buildActionConfig(): Record<string, unknown> {
    switch (state.action_type) {
      case 'send_message':
        return { message: state.action_message };
      case 'move_card':
        return { column_id: state.action_column_id };
      case 'add_tag':
        return { tag: state.action_tag };
      case 'handoff':
        return state.action_department_id ? { department_id: state.action_department_id } : {};
      case 'send_poll':
        return {
          question: state.action_poll_question,
          options: state.action_poll_options.filter(o => o.trim()),
          selectable_count: state.action_poll_selectable_count,
        };
      default:
        return {};
    }
  }

  async function handleSave() {
    const payload = {
      name: state.name.trim() || 'Nova regra',
      enabled: state.enabled,
      trigger_type: state.trigger_type,
      trigger_config: buildTriggerConfig(),
      condition_type: state.condition_type,
      condition_config: buildConditionConfig(),
      action_type: state.action_type,
      action_config: buildActionConfig(),
    };

    if (rule) {
      await updateRule.mutateAsync({ id: rule.id, ...payload });
    } else {
      await createRule.mutateAsync({ funnel_id: funnelId, ...payload });
    }
    onClose();
  }

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar automacao' : 'Nova automacao'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label>Nome da regra</Label>
            <Input
              value={state.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ex: Mover card ao completar formulario"
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-3">
            <Switch
              checked={state.enabled}
              onCheckedChange={(v) => set('enabled', v)}
              id="rule-enabled"
            />
            <Label htmlFor="rule-enabled">Regra ativa</Label>
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label>QUANDO (gatilho)</Label>
            <Select
              value={state.trigger_type}
              onValueChange={(v) => set('trigger_type', v as TriggerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sub-campos por trigger */}
            {state.trigger_type === 'card_moved' && (
              <Input
                value={state.trigger_column_id}
                onChange={(e) => set('trigger_column_id', e.target.value)}
                placeholder="ID da coluna de destino (opcional)"
              />
            )}
            {state.trigger_type === 'form_completed' && (
              <Input
                value={state.trigger_form_slug}
                onChange={(e) => set('trigger_form_slug', e.target.value)}
                placeholder="Slug do formulario (opcional)"
              />
            )}
            {state.trigger_type === 'tag_added' && (
              <Input
                value={state.trigger_tag}
                onChange={(e) => set('trigger_tag', e.target.value)}
                placeholder="Tag exata (ex: interesse:tintas, opcional)"
              />
            )}
            {state.trigger_type === 'label_applied' && (
              <Input
                value={state.trigger_label}
                onChange={(e) => set('trigger_label', e.target.value)}
                placeholder="Nome da etiqueta (opcional)"
              />
            )}
          </div>

          {/* Condition */}
          <div className="space-y-1.5">
            <Label>SE (condicao)</Label>
            <Select
              value={state.condition_type}
              onValueChange={(v) => set('condition_type', v as ConditionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sub-campos por condição */}
            {state.condition_type === 'tag_contains' && (
              <Input
                value={state.condition_tag}
                onChange={(e) => set('condition_tag', e.target.value)}
                placeholder="Tag para verificar (ex: qualificado:sim)"
              />
            )}
            {state.condition_type === 'business_hours' && (
              <Select
                value={state.condition_business_hours_inside}
                onValueChange={(v) => set('condition_business_hours_inside', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Dentro do horario comercial</SelectItem>
                  <SelectItem value="false">Fora do horario comercial</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <Label>ENTAO (acao)</Label>
            <Select
              value={state.action_type}
              onValueChange={(v) => set('action_type', v as ActionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sub-campos por ação */}
            {state.action_type === 'send_message' && (
              <Textarea
                value={state.action_message}
                onChange={(e) => set('action_message', e.target.value)}
                placeholder="Texto da mensagem a ser enviada"
                rows={3}
              />
            )}
            {state.action_type === 'move_card' && (
              <Input
                value={state.action_column_id}
                onChange={(e) => set('action_column_id', e.target.value)}
                placeholder="ID da coluna de destino"
              />
            )}
            {state.action_type === 'add_tag' && (
              <Input
                value={state.action_tag}
                onChange={(e) => set('action_tag', e.target.value)}
                placeholder="Tag a adicionar (ex: qualificado:sim)"
              />
            )}
            {state.action_type === 'handoff' && (
              <Input
                value={state.action_department_id}
                onChange={(e) => set('action_department_id', e.target.value)}
                placeholder="ID do departamento (opcional)"
              />
            )}
            {state.action_type === 'send_poll' && (
              <div className="space-y-3">
                <Textarea
                  value={state.action_poll_question}
                  onChange={(e) => set('action_poll_question', e.target.value)}
                  placeholder="Pergunta da enquete (max 255 caracteres)"
                  rows={2}
                  maxLength={255}
                />
                <div className="space-y-1">
                  <Label className="text-xs">Opcoes (2-12)</Label>
                  {state.action_poll_options.map((opt: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...state.action_poll_options];
                          newOpts[idx] = e.target.value;
                          set('action_poll_options', newOpts);
                        }}
                        placeholder={`Opcao ${idx + 1}`}
                        maxLength={100}
                      />
                      {state.action_poll_options.length > 2 && (
                        <Button variant="ghost" size="sm" onClick={() => {
                          const newOpts = state.action_poll_options.filter((_: string, i: number) => i !== idx);
                          set('action_poll_options', newOpts);
                        }}>✕</Button>
                      )}
                    </div>
                  ))}
                  {state.action_poll_options.length < 12 && (
                    <Button variant="outline" size="sm" onClick={() => set('action_poll_options', [...state.action_poll_options, ''])}>
                      + Opcao
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
