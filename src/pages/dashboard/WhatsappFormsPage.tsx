import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormsTab } from '@/components/admin/forms/FormsTab'

interface AIAgent {
  id: string
  name: string
}

export default function WhatsappFormsPage() {
  const { isSuperAdmin } = useAuth()
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const { data: agents = [] } = useQuery<AIAgent[]>({
    queryKey: ['ai-agents-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name')
        .order('name')
      if (error) throw error
      return (data ?? []) as AIAgent[]
    },
  })

  // Auto-select first agent (useEffect to avoid setState during render)
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id)
    }
  }, [agents, selectedAgentId])

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/10 rounded-xl shrink-0 border border-[#25D366]/20">
            <FileText className="w-6 h-6 text-[#25D366]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Formulários WhatsApp</h1>
            <p className="text-muted-foreground text-sm">Crie formulários para coletar dados via conversa WhatsApp</p>
          </div>
        </div>
        {agents.length > 1 && (
          <Select value={selectedAgentId ?? ''} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Selecionar agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selectedAgentId
        ? <FormsTab agentId={selectedAgentId} />
        : <div className="text-center text-muted-foreground py-12">Nenhum Agente IA configurado. Configure um agente primeiro.</div>
      }
    </div>
  )
}
