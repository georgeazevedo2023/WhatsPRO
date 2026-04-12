import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

// ── Draft flow schema (retornado pela edge function guided-flow-builder) ──────

export interface DraftFlowStep {
  position: number
  name: string
  subagent_type: string
  step_config: Record<string, unknown>
  exit_rules: unknown[]
}

export interface DraftFlowTrigger {
  trigger_type: string
  trigger_config: Record<string, unknown>
  priority: number
}

export interface DraftFlow {
  name: string
  description: string
  steps: DraftFlowStep[]
  triggers: DraftFlowTrigger[]
}

// ── Mensagem do chat ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GuidedFlowBuilderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ID da instância (obrigatório para contextualizar o fluxo) */
  instanceId: string
  onApply: (draft: DraftFlow) => void
}

// ── Componente ────────────────────────────────────────────────────────────────

export function GuidedFlowBuilderModal({
  open,
  onOpenChange,
  instanceId,
  onApply,
}: GuidedFlowBuilderModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [draft, setDraft] = useState<DraftFlow | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mensagem inicial do assistente ao abrir
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content:
            'Olá! Vou te ajudar a criar um fluxo de atendimento WhatsApp. Me conte: qual é o objetivo do seu fluxo? Ex: captar leads, mostrar produtos, dar suporte técnico...',
          timestamp: new Date().toISOString(),
        },
      ])
      setSuggestions([
        'Quero uma vitrine de produtos',
        'Quero qualificar leads com BANT',
        'Quero dar suporte técnico automatizado',
      ])
    }
  }, [open])

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput('')
      setSessionId(undefined)
      setDraft(null)
      setSuggestions([])
    }
  }, [open])

  // Scroll para o fim a cada nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('guided-flow-builder', {
        body: {
          session_id: sessionId,
          message: text,
          instance_id: instanceId,
        },
      })

      if (error) throw error

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.assistant_message as string,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setSessionId(data.session_id as string | undefined)
      setSuggestions((data.suggestions as string[] | undefined) ?? [])

      if (data.draft_flow) {
        setDraft(data.draft_flow as DraftFlow)
      }
    } catch (err) {
      toast.error('Erro ao conectar com a IA. Tente novamente.')
      console.error('[GuidedFlowBuilderModal] error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Criar fluxo com IA
          </DialogTitle>
        </DialogHeader>

        {/* Área de chat */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preview do rascunho do fluxo gerado */}
        {draft && (
          <div className="px-6 py-3 border-t border-b bg-muted/30 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{draft.name}</p>
                <p className="text-xs text-muted-foreground">
                  {draft.steps.length} steps · {draft.triggers.length} gatilhos
                  {draft.steps.length > 0 && (
                    <> · {draft.steps.map((s) => s.subagent_type).join(' → ')}</>
                  )}
                </p>
              </div>
              <Button size="sm" onClick={() => onApply(draft)} className="shrink-0">
                Usar este fluxo
              </Button>
            </div>
          </div>
        )}

        {/* Sugestões rápidas */}
        {suggestions.length > 0 && !loading && (
          <div className="px-6 py-2 flex gap-2 flex-wrap shrink-0">
            {suggestions.slice(0, 3).map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-xs rounded-full border px-3 py-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input de mensagem */}
        <div className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva o que você precisa..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

