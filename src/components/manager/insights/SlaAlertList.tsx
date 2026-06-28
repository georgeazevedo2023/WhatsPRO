// R115 F3: lista de leads com 1ª msg sem resposta há mais de 30min
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AlarmClock } from 'lucide-react'
import { ConversationModal } from '@/components/leads/ConversationModal'
import type { SlaSemRespostaItem } from '@/hooks/useDashboardInsights'

interface SlaAlertListProps {
  items: SlaSemRespostaItem[]
  isLoading?: boolean
}

function formatPhone(p: string): string {
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  if (digits.length === 13) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
  if (digits.length === 12) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`
  return p
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h < 24) return r > 0 ? `${h}h ${r}min` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export default function SlaAlertList({ items, isLoading }: SlaAlertListProps) {
  // Conversa selecionada → abre no ConversationModal (in-app, sem sair do dashboard).
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <CardTitle className="text-sm font-display font-semibold">Sem resposta há +30min</CardTitle>
            {!isLoading && items.length > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5">{items.length}</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Conversas com 1ª mensagem do lead sem resposta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              🎉 Todos os leads tiveram resposta dentro do SLA
            </p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {items.slice(0, 10).map(item => {
                const name = item.contact_name || formatPhone(item.contact_phone)
                const open = () => setSelected({ id: item.conversation_id, name })
                return (
                  <li
                    key={item.conversation_id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/50 hover:bg-secondary/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={open}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
                    title="Abrir conversa"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {formatPhone(item.contact_phone)}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                      {formatMinutes(item.minutos_sem_resposta)}
                    </Badge>
                  </li>
                )
              })}
              {items.length > 10 && (
                <li className="pt-1 text-[10px] text-muted-foreground italic text-center">
                  + {items.length - 10} outros
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConversationModal
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null) }}
        conversationId={selected?.id ?? null}
        contactName={selected?.name ?? ''}
      />
    </>
  )
}
