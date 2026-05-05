import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X } from 'lucide-react';

/**
 * D30 Sprint E — Modo Estendido (override pontual do horário comercial).
 *
 * Quando `ai_agents.extended_hours_until` está no futuro, o helper
 * `_shared/businessHours.ts` retorna `false` em `isOutsideBusinessHours()`
 * — ou seja, a IA atende como se estivesse no horário, mesmo fora dele.
 *
 * Caso de uso: Black Friday, lançamento, live, atendimento emergencial.
 *
 * UX guidelines:
 *   - Mostra status grande e visível em cima — "ATIVO até 21:30" ou "Não ativado".
 *   - 4 quick actions cobrem 95% dos casos (+1h, +2h, fim do dia, amanhã 23:59).
 *   - Custom datetime para casos muito específicos.
 *   - Botão de cancelar só aparece quando está ativo.
 */

export interface ExtendedHoursConfigProps {
  value?: string | null;
  onChange: (next: { extended_hours_until: string | null }) => void;
}

/** Formata ISO em string local "DD/MM HH:mm" para o usuário ler. */
function formatLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} às ${hh}:${mm}`;
}

/** ISO local completa para uso em <input type="datetime-local"> (sem TZ). */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
}

/** Adiciona `hours` à data atual e retorna ISO. */
function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/** Hoje 23:59 (fim do dia em local time). */
function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

/** Amanhã 23:59 em local time. */
function endOfTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

export function ExtendedHoursConfig({ value, onChange }: ExtendedHoursConfigProps) {
  const [customValue, setCustomValue] = useState<string>(toDatetimeLocalValue(value));

  const isActive = useMemo(() => {
    if (!value) return false;
    const t = new Date(value).getTime();
    return !isNaN(t) && t > Date.now();
  }, [value]);

  function applyExtension(iso: string) {
    onChange({ extended_hours_until: iso });
    setCustomValue(toDatetimeLocalValue(iso));
  }

  function cancel() {
    onChange({ extended_hours_until: null });
    setCustomValue('');
  }

  function applyCustom() {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime())) return;
    if (d.getTime() <= Date.now()) return; // valor passado nao tem efeito
    applyExtension(d.toISOString());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Modo Estendido
          {isActive && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300">
              Ativo
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Estenda o expediente pontualmente — a IA atende fora do horário comercial até a data/hora escolhida.
          Útil em datas especiais (Black Friday, live, lançamento) sem precisar editar o horário comercial geral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div
          className={`p-3 rounded-md border text-sm ${
            isActive
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-muted/30 border-muted text-muted-foreground'
          }`}
          data-testid="extended-hours-status"
        >
          {isActive && value ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span>
                <strong>Ativo</strong> até <strong>{formatLocal(value)}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancel}
                className="h-7 text-amber-900 hover:bg-amber-100"
                aria-label="Cancelar Modo Estendido"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancelar agora
              </Button>
            </div>
          ) : (
            <span>Não ativado — IA respeita o horário comercial padrão.</span>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Estender por…</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyExtension(addHours(1))}
              data-testid="extend-1h"
            >
              +1 hora
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyExtension(addHours(2))}
              data-testid="extend-2h"
            >
              +2 horas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyExtension(endOfToday())}
              data-testid="extend-today"
            >
              Resto do dia
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyExtension(endOfTomorrow())}
              data-testid="extend-tomorrow"
            >
              Até amanhã 23:59
            </Button>
          </div>
        </div>

        {/* Custom */}
        <div className="space-y-1.5">
          <Label htmlFor="extended-custom" className="text-xs text-muted-foreground">
            Data/hora personalizada
          </Label>
          <div className="flex gap-2">
            <Input
              id="extended-custom"
              type="datetime-local"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="default"
              size="sm"
              onClick={applyCustom}
              disabled={!customValue || new Date(customValue).getTime() <= Date.now()}
            >
              Aplicar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Precisa estar no futuro. A IA volta a respeitar o horário comercial automaticamente após esse momento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
