import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Timer, Sparkles, RotateCcw } from 'lucide-react';

export interface DaySchedule {
  open: boolean;
  start: string;
  end: string;
}

export interface WeeklyHours {
  mon: DaySchedule;
  tue: DaySchedule;
  wed: DaySchedule;
  thu: DaySchedule;
  fri: DaySchedule;
  sat: DaySchedule;
  sun: DaySchedule;
}

const DAYS: { key: keyof WeeklyHours; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

const DEFAULT_DAY: DaySchedule = { open: true, start: '08:00', end: '18:00' };
const CLOSED_DAY: DaySchedule = { open: false, start: '00:00', end: '00:00' };

export const PRESET_COMERCIO_PADRAO: WeeklyHours = {
  mon: { open: true, start: '08:00', end: '18:00' },
  tue: { open: true, start: '08:00', end: '18:00' },
  wed: { open: true, start: '08:00', end: '18:00' },
  thu: { open: true, start: '08:00', end: '18:00' },
  fri: { open: true, start: '08:00', end: '18:00' },
  sat: { open: true, start: '08:00', end: '12:00' },
  sun: CLOSED_DAY,
};

/**
 * Normaliza qualquer formato salvo para WeeklyHours (ou null se desligado).
 *
 * - null/undefined → null (desligado, IA atende 24h)
 * - Weekly válido → retorna como está
 * - Legacy {start, end} → migra aplicando o mesmo horário todos os 7 dias
 * - Inválido/vazio → null
 */
export function normalizeBusinessHours(value: unknown): WeeklyHours | null {
  if (value == null) return null;
  if (typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;

  // Weekly format detection — tem pelo menos 1 dia da semana válido
  const hasWeekly = DAYS.some(d => v[d.key] && typeof v[d.key] === 'object');
  if (hasWeekly) {
    const out = {} as WeeklyHours;
    for (const d of DAYS) {
      const day = v[d.key] as Partial<DaySchedule> | undefined;
      out[d.key] = {
        open: day?.open !== false, // default open=true se não especificado
        start: typeof day?.start === 'string' ? day.start : DEFAULT_DAY.start,
        end: typeof day?.end === 'string' ? day.end : DEFAULT_DAY.end,
      };
    }
    return out;
  }

  // Legacy format {start, end} — aplica em todos os dias
  if (typeof v.start === 'string' && typeof v.end === 'string') {
    const start = v.start;
    const end = v.end;
    return DAYS.reduce((acc, d) => {
      acc[d.key] = { open: true, start, end };
      return acc;
    }, {} as WeeklyHours);
  }

  return null;
}

interface BusinessHoursEditorProps {
  value: unknown; // null | legacy | weekly
  onChange: (newValue: WeeklyHours | null) => void;
  outOfHoursMessage: string;
  onOutOfHoursMessageChange: (text: string) => void;
}

export function BusinessHoursEditor({
  value,
  onChange,
  outOfHoursMessage,
  onOutOfHoursMessageChange,
}: BusinessHoursEditorProps) {
  const weekly = normalizeBusinessHours(value);
  const enabled = weekly !== null;

  // Master toggle on/off
  function handleMasterToggle(on: boolean) {
    if (on) {
      // Liga com preset padrão se não tinha config; mantém weekly atual senão
      onChange(weekly ?? PRESET_COMERCIO_PADRAO);
    } else {
      // Desliga → null → IA atende 24h
      onChange(null);
    }
  }

  function updateDay(dayKey: keyof WeeklyHours, patch: Partial<DaySchedule>) {
    if (!weekly) return;
    onChange({ ...weekly, [dayKey]: { ...weekly[dayKey], ...patch } });
  }

  function applyPreset() {
    onChange(PRESET_COMERCIO_PADRAO);
  }

  function clearAllDays() {
    if (!weekly) return;
    const cleared = DAYS.reduce((acc, d) => {
      acc[d.key] = CLOSED_DAY;
      return acc;
    }, {} as WeeklyHours);
    onChange(cleared);
  }

  // Validação: end > start em dias abertos
  function dayHasError(day: DaySchedule): boolean {
    if (!day.open) return false;
    return day.start >= day.end;
  }

  const anyError = weekly ? DAYS.some(d => dayHasError(weekly[d.key])) : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          Horário Comercial
        </CardTitle>
        <CardDescription>
          Defina quando a IA atende. Fora do horário, ela envia uma mensagem padrão e não responde.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master toggle */}
        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
          <div>
            <Label className="text-sm font-medium">Ativar horário comercial</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {enabled
                ? 'IA respeita os horários abaixo. Fora deles, envia mensagem padrão.'
                : 'IA atende 24 horas por dia, todos os dias.'}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleMasterToggle}
            aria-label="Ativar horário comercial"
          />
        </div>

        {/* Weekly grid — só aparece quando ativado */}
        {enabled && weekly && (
          <>
            {/* Atalhos */}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={applyPreset} className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Comércio padrão
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAllDays} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Apagar tudo
              </Button>
              <p className="text-[11px] text-muted-foreground self-center ml-2">
                Comércio padrão: Seg-Sex 8h-18h, Sáb 8h-12h, Dom fechado
              </p>
            </div>

            {/* 7 linhas — uma por dia */}
            <div className="space-y-2 border rounded-md p-3">
              {DAYS.map(({ key, label }) => {
                const day = weekly[key];
                const error = dayHasError(day);
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[100px_72px_1fr] items-center gap-3"
                    data-day={key}
                  >
                    <Label className="text-sm">{label}</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={day.open}
                        onCheckedChange={(open) => updateDay(key, { open })}
                        aria-label={`${label} aberto`}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {day.open ? 'aberto' : 'fechado'}
                      </span>
                    </div>
                    {day.open ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={day.start}
                          onChange={(e) => updateDay(key, { start: e.target.value })}
                          className={`h-8 w-28 ${error ? 'border-destructive' : ''}`}
                          aria-label={`${label} abertura`}
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={day.end}
                          onChange={(e) => updateDay(key, { end: e.target.value })}
                          className={`h-8 w-28 ${error ? 'border-destructive' : ''}`}
                          aria-label={`${label} fechamento`}
                        />
                        {error && (
                          <span className="text-[11px] text-destructive font-medium">
                            Fechamento deve ser depois da abertura
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            {anyError && (
              <p className="text-[11px] text-destructive font-medium">
                Há dias com horário inválido (fechamento ≤ abertura). Corrija antes de salvar.
              </p>
            )}

            {/* Mensagem fora do horário */}
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem fora do horário</Label>
              <Textarea
                value={outOfHoursMessage || ''}
                onChange={(e) => onOutOfHoursMessageChange(e.target.value)}
                placeholder="Estamos fora do horário de atendimento. Retornaremos em breve!"
                className="min-h-[60px] resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Enviada ao lead quando ele manda mensagem fora do horário comercial. Se ficar vazia, a IA não envia nada (cliente fica sem resposta).
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
