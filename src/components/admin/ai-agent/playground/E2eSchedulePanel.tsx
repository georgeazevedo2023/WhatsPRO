import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp, Clock, Bell } from 'lucide-react'
import { useE2eScheduleSettings } from '@/hooks/useE2eScheduleSettings'

const INTERVAL_OPTIONS = [
  { value: 2, label: '2h' },
  { value: 6, label: '6h' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
]

export const E2eSchedulePanel = () => {
  const [expanded, setExpanded] = useState(false)
  const { settings, isLoading, save, isSaving } = useE2eScheduleSettings()
  const [draft, setDraft] = useState<typeof settings | null>(null)

  const current = draft ?? settings

  const handleSave = async () => {
    if (!draft) return
    await save(draft)
    setDraft(null)
  }

  if (isLoading || !current) return null

  return (
    <div className="border border-border/50 rounded-lg bg-muted/20 mb-2">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-xs">Agendamento Automático</span>
          <Badge variant="outline" className="text-[10px] px-1">
            a cada {current.intervalHours}h
          </Badge>
          {current.whatsappEnabled && (
            <Badge variant="secondary" className="text-[10px] px-1 gap-0.5">
              <Bell className="w-2.5 h-2.5" />WhatsApp
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50">
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs">Frequência de execução automática</Label>
            <div className="flex gap-1.5">
              {INTERVAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDraft(d => ({ ...(d ?? current!), intervalHours: opt.value }))}
                  className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                    current.intervalHours === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              O pg_cron executa a cada 6h. O guard interno respeita o intervalo configurado aqui.
            </p>
          </div>

          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa saudável (%)</Label>
              <Input
                type="number" min={50} max={100}
                value={current.healthyPassRate}
                onChange={e => setDraft(d => ({ ...(d ?? current!), healthyPassRate: parseInt(e.target.value) || 80 }))}
                className="w-20 h-7 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Limiar de regressão (pts)</Label>
              <Input
                type="number" min={5} max={30}
                value={current.regressionThreshold}
                onChange={e => setDraft(d => ({ ...(d ?? current!), regressionThreshold: parseInt(e.target.value) || 10 }))}
                className="w-20 h-7 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="whatsapp-alert"
              checked={current.whatsappEnabled}
              onCheckedChange={v => setDraft(d => ({ ...(d ?? current!), whatsappEnabled: v }))}
            />
            <Label htmlFor="whatsapp-alert" className="text-xs">Alerta WhatsApp em falhas/regressão</Label>
          </div>

          {draft && (
            <Button size="sm" className="h-7 text-xs w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
