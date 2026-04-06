import { Bot, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { FormField, FieldType } from '@/types/forms'

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftField = Omit<FormField, 'id' | 'form_id' | 'created_at'>

interface FormPreviewProps {
  welcomeMessage: string
  fields: DraftField[]
  completionMessage: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIELD_TYPE_HINT: Record<FieldType, string> = {
  short_text:   'Digite sua resposta…',
  long_text:    'Digite sua resposta…',
  number:       'Digite um número…',
  email:        'exemplo@email.com',
  phone:        '(11) 99999-9999',
  cpf:          '000.000.000-00',
  cep:          '00000-000',
  date:         'DD/MM/AAAA',
  time:         'HH:MM',
  select:       'Escolha uma opção…',
  multi_select: 'Escolha uma ou mais opções…',
  yes_no:       'Sim  /  Não',
  scale:        '1 — 2 — 3 — 4 — 5 — 6 — 7 — 8 — 9 — 10',
  file:         'Envie um arquivo…',
  location:     'Compartilhe sua localização…',
  signature:    'Digite para confirmar…',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BotBubble({
  children,
  timestamp = '12:00',
}: {
  children: React.ReactNode
  timestamp?: string
}) {
  return (
    <div className="flex items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white mb-1">
        <Bot size={14} />
      </div>
      <div className="max-w-[78%]">
        <div className="rounded-2xl rounded-bl-none bg-white px-3 py-2 shadow-sm">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{children}</p>
          <p className="mt-0.5 text-right text-[10px] text-gray-400">{timestamp}</p>
        </div>
      </div>
    </div>
  )
}

function InputBubble({ hint }: { hint: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[72%] rounded-2xl rounded-br-none border border-dashed border-white/40 bg-green-700/30 px-3 py-2">
        <p className="text-xs italic text-white/60">{hint}</p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-white/40">
      <Bot size={32} />
      <p className="text-sm">Adicione campos para visualizar</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FormPreview({ welcomeMessage, fields, completionMessage }: FormPreviewProps) {
  const hasContent = welcomeMessage || fields.length > 0 || completionMessage

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 bg-green-800 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white shadow">
          <Bot size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Bot Formulário</p>
          <p className="text-xs text-green-300">online</p>
        </div>
      </div>

      {/* Chat area */}
      <ScrollArea className="max-h-96 bg-[#0b1f13]">
        <div className="space-y-3 px-3 py-4">
          {!hasContent && <EmptyState />}

          {/* Welcome message */}
          {welcomeMessage && (
            <BotBubble>{welcomeMessage}</BotBubble>
          )}

          {/* Fields */}
          {fields.map((field, idx) => (
            <div key={idx} className="space-y-1.5">
              <BotBubble timestamp="12:00">
                <span>{field.label}</span>
                {!field.required && (
                  <Badge
                    variant="secondary"
                    className="ml-2 inline-flex text-[10px] px-1.5 py-0 align-middle"
                  >
                    opcional
                  </Badge>
                )}
              </BotBubble>
              <InputBubble hint={FIELD_TYPE_HINT[field.field_type]} />
            </div>
          ))}

          {/* Completion message */}
          {completionMessage && (
            <BotBubble>
              <span className="flex items-start gap-2">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-green-400"
                />
                <span>{completionMessage}</span>
              </span>
            </BotBubble>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
