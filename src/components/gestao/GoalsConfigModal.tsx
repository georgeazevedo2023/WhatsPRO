// M19 S4 P6: Modal de configuração de metas da instância
// 6 métricas configuráveis com período (diário/semanal/mensal)
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInstanceGoals, useUpsertGoal } from '@/hooks/useInstanceGoals';

interface GoalsConfigModalProps {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Definição das métricas configuráveis
const METRIC_DEFINITIONS: { key: string; label: string }[] = [
  { key: 'conversion_rate', label: 'Taxa de Conversão (%)' },
  { key: 'nps_avg', label: 'NPS Médio (1-5)' },
  { key: 'handoff_rate', label: 'Taxa de Transbordo (%)' },
  { key: 'response_time_min', label: 'Tempo Médio Resolução (min)' },
  { key: 'ia_cost_usd', label: 'Custo IA Mensal (USD)' },
  { key: 'avg_ticket', label: 'Ticket Médio (R$)' },
];

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

type MetricState = {
  targetValue: string;
  period: string;
};

export default function GoalsConfigModal({
  instanceId,
  open,
  onOpenChange,
}: GoalsConfigModalProps) {
  const { data: goals = [] } = useInstanceGoals(instanceId || null);
  const upsertGoal = useUpsertGoal();

  // Estado local para os campos do formulário
  const [values, setValues] = useState<Record<string, MetricState>>(() => {
    const initial: Record<string, MetricState> = {};
    for (const m of METRIC_DEFINITIONS) {
      initial[m.key] = { targetValue: '', period: 'monthly' };
    }
    return initial;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Pré-preenche com valores existentes quando goals carrega
  useEffect(() => {
    if (goals.length === 0) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const goal of goals) {
        if (next[goal.metricKey]) {
          next[goal.metricKey] = {
            targetValue: goal.targetValue > 0 ? String(goal.targetValue) : '',
            period: goal.period,
          };
        }
      }
      return next;
    });
  }, [goals]);

  function handleValueChange(metricKey: string, field: keyof MetricState, val: string) {
    setValues((prev) => ({
      ...prev,
      [metricKey]: { ...prev[metricKey], [field]: val },
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const promises: Promise<void>[] = [];
      for (const m of METRIC_DEFINITIONS) {
        const state = values[m.key];
        const numVal = parseFloat(state.targetValue);
        if (!isNaN(numVal) && numVal > 0) {
          promises.push(
            upsertGoal.mutateAsync({
              instanceId,
              metricKey: m.key,
              targetValue: numVal,
              period: state.period,
            })
          );
        }
      }
      await Promise.all(promises);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Metas</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {METRIC_DEFINITIONS.map((m) => (
            <div key={m.key} className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">{m.label}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ex: 30"
                  value={values[m.key]?.targetValue ?? ''}
                  onChange={(e) => handleValueChange(m.key, 'targetValue', e.target.value)}
                  className="flex-1"
                  disabled={isSaving}
                />
                <Select
                  value={values[m.key]?.period ?? 'monthly'}
                  onValueChange={(val) => handleValueChange(m.key, 'period', val)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[120px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Salvando...' : 'Salvar Metas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
