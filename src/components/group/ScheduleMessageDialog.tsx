import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, Repeat, CalendarDays, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface ScheduleConfig {
  scheduledAt: Date;
  isRecurring: boolean;
  recurrenceType: "daily" | "weekly" | "monthly" | "custom";
  recurrenceInterval: number;
  recurrenceDays: number[];
  recurrenceEndAt?: Date;
  recurrenceCount?: number;
  endType: "never" | "date" | "count";
  randomDelay: "none" | "5-10" | "10-20";
}

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: ScheduleConfig) => void;
  isLoading?: boolean;
}

const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: ScheduleMessageDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("09:00");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 3, 5]); // Seg, Qua, Sex
  const [endType, setEndType] = useState<"never" | "date" | "count">("never");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endCount, setEndCount] = useState(10);
  const [randomDelay, setRandomDelay] = useState<"none" | "5-10" | "10-20">("none");

  const handleConfirm = () => {
    if (!date) return;

    const [hours, minutes] = time.split(":").map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const config: ScheduleConfig = {
      scheduledAt,
      isRecurring,
      recurrenceType,
      recurrenceInterval,
      recurrenceDays: recurrenceType === "weekly" ? recurrenceDays : [],
      endType,
      recurrenceEndAt: endType === "date" ? endDate : undefined,
      recurrenceCount: endType === "count" ? endCount : undefined,
      randomDelay,
    };

    onConfirm(config);
  };

  const toggleDay = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const getRecurrenceLabel = () => {
    switch (recurrenceType) {
      case "daily":
        return recurrenceInterval === 1 ? "dia" : "dias";
      case "weekly":
        return recurrenceInterval === 1 ? "semana" : "semanas";
      case "monthly":
        return recurrenceInterval === 1 ? "mês" : "meses";
      case "custom":
        return recurrenceInterval === 1 ? "dia" : "dias";
      default:
        return "dias";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Agendar Mensagem
          </DialogTitle>
          <DialogDescription>
            Configure a data, hora e recorrência do envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Hora</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Toggle Recorrência */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Repetir envio
              </Label>
              <p className="text-xs text-muted-foreground">
                Enviar automaticamente em intervalos regulares
              </p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {/* Configurações de Recorrência */}
          {isRecurring && (
            <div className="space-y-4 p-4 border rounded-lg">
              {/* Tipo e Intervalo */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">Repetir a cada</span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16"
                />
                <Select
                  value={recurrenceType}
                  onValueChange={(v) => setRecurrenceType(v as typeof recurrenceType)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Dia(s)</SelectItem>
                    <SelectItem value="weekly">Semana(s)</SelectItem>
                    <SelectItem value="monthly">Mês(es)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dias da Semana (apenas para semanal) */}
              {recurrenceType === "weekly" && (
                <div className="space-y-2">
                  <Label className="text-sm">Dias da semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => (
                      <div
                        key={day.value}
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full cursor-pointer text-sm font-medium transition-colors",
                          recurrenceDays.includes(day.value)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        )}
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quando terminar */}
              <div className="space-y-3">
                <Label className="text-sm">Quando terminar</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="end-never"
                      checked={endType === "never"}
                      onCheckedChange={() => setEndType("never")}
                    />
                    <label htmlFor="end-never" className="text-sm cursor-pointer">
                      Nunca
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="end-date"
                      checked={endType === "date"}
                      onCheckedChange={() => setEndType("date")}
                    />
                    <label htmlFor="end-date" className="text-sm cursor-pointer">
                      Em uma data específica
                    </label>
                    {endType === "date" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="ml-2">
                            <CalendarDays className="mr-2 h-3 w-3" />
                            {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={(d) => d < (date || new Date())}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="end-count"
                      checked={endType === "count"}
                      onCheckedChange={() => setEndType("count")}
                    />
                    <label htmlFor="end-count" className="text-sm cursor-pointer">
                      Após
                    </label>
                    {endType === "count" && (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={endCount}
                          onChange={(e) => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 h-8"
                        />
                        <span className="text-sm">execuções</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Intervalo Anti-Bloqueio */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Intervalo anti-bloqueio</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Adiciona delays aleatórios entre envios para evitar bloqueio
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={randomDelay === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRandomDelay('none')}
              >
                Desativado
              </Button>
              <Button
                type="button"
                variant={randomDelay === '5-10' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRandomDelay('5-10')}
              >
                5-10 seg
              </Button>
              <Button
                type="button"
                variant={randomDelay === '10-20' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRandomDelay('10-20')}
              >
                10-20 seg
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-muted/30 rounded-lg text-sm">
            <p className="font-medium mb-1">Resumo:</p>
            <p className="text-muted-foreground">
              {date && (
                <>
                  Primeiro envio: {format(date, "dd/MM/yyyy", { locale: ptBR })} às {time}
                </>
              )}
            </p>
            {isRecurring && (
              <p className="text-muted-foreground">
                Repetir a cada {recurrenceInterval} {getRecurrenceLabel()}
                {recurrenceType === "weekly" && recurrenceDays.length > 0 && (
                  <> ({recurrenceDays.map(d => WEEK_DAYS.find(wd => wd.value === d)?.label).join(", ")})</>
                )}
                {endType === "date" && endDate && (
                  <> até {format(endDate, "dd/MM/yyyy", { locale: ptBR })}</>
                )}
                {endType === "count" && (
                  <> por {endCount} vezes</>
                )}
              </p>
            )}
            {randomDelay !== 'none' && (
              <p className="text-muted-foreground">
                Intervalo anti-bloqueio: {randomDelay === '5-10' ? '5-10 segundos' : '10-20 segundos'}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!date || isLoading}>
            {isLoading ? "Agendando..." : "Confirmar Agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
