import type { BioTemplate } from '@/types/bio'
import { cn } from '@/lib/utils'

interface TemplateSelectorProps {
  value: BioTemplate
  onChange: (t: BioTemplate) => void
}

const TEMPLATES: Array<{
  id: BioTemplate
  label: string
  desc: string
  preview: React.ReactNode
}> = [
  {
    id: 'simples',
    label: 'Simples',
    desc: 'Fundo escuro, botões verdes, limpo',
    preview: (
      <div className="w-full h-24 bg-[#0f0f0f] rounded-lg flex flex-col items-center justify-center gap-1.5 p-2">
        <div className="w-6 h-6 rounded-full bg-white/20" />
        <div className="w-20 h-5 rounded-full bg-[#25D366]" />
        <div className="w-20 h-5 rounded-full bg-[#25D366]" />
      </div>
    ),
  },
  {
    id: 'shopping',
    label: 'Shopping',
    desc: 'Fundo colorido, botões outline, featured link',
    preview: (
      <div className="w-full h-24 bg-[#780016] rounded-lg flex flex-col items-center justify-center gap-1.5 p-2">
        <div className="w-6 h-6 rounded-full bg-white/30" />
        <div className="w-20 h-9 rounded-[28px] border border-white/80 bg-transparent" />
        <div className="w-20 h-5 rounded-[28px] border border-white/80 bg-transparent" />
      </div>
    ),
  },
  {
    id: 'negocio',
    label: 'Negócio',
    desc: 'Gradiente escuro, botões soft, avatar quadrado',
    preview: (
      <div
        className="w-full h-24 rounded-lg flex flex-col items-center justify-center gap-1.5 p-2"
        style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}
      >
        <div className="w-6 h-6 rounded-lg bg-white/20" />
        <div className="w-20 h-5 rounded-2xl bg-white/15 border border-white/20" />
        <div className="w-20 h-5 rounded-2xl bg-white/15 border border-white/20" />
      </div>
    ),
  },
]

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'flex flex-col gap-2 p-2 rounded-xl border-2 transition-all duration-150 text-left',
            value === t.id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/50'
          )}
        >
          {t.preview}
          <div className="px-1">
            <p className="text-xs font-semibold">{t.label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
