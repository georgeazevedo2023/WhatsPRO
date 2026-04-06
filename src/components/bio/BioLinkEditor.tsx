import { useState } from 'react'
import { GripVertical, ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { TemplateSelector } from './TemplateSelector'
import { BioButtonEditor } from './BioButtonEditor'
import { BioLinkPreview } from './BioLinkPreview'
import { uploadBioImage } from '@/lib/uploadBioImage'
import {
  useCreateBioPage,
  useUpdateBioPage,
  useBioPageWithButtons,
  useCreateBioButton,
  useUpdateBioButton,
  useDeleteBioButton,
  useReorderBioButtons,
} from '@/hooks/useBioPages'
import type {
  BioPage,
  BioButton,
  BioTemplate,
  BioButtonStyle,
  BioButtonRadius,
  BioBgType,
  BioFontFamily,
  BioButtonSpacing,
  CreateBioButtonInput,
} from '@/types/bio'
import { TEMPLATE_DEFAULTS } from '@/types/bio'

interface BioLinkEditorProps {
  open: boolean
  onClose: () => void
  editPageId?: string | null
  instanceId: string
}

type ButtonDraft = Omit<CreateBioButtonInput, 'bio_page_id' | 'position'>

export function BioLinkEditor({ open, onClose, editPageId, instanceId }: BioLinkEditorProps) {
  const { toast } = useToast()
  const isEditing = !!editPageId

  // Load existing page data when editing
  const { data: existing } = useBioPageWithButtons(editPageId ?? null)
  const existingPage = existing?.page
  const existingButtons = existing?.buttons ?? []

  // Form state
  const [title, setTitle] = useState(existingPage?.title ?? '')
  const [slug, setSlug] = useState(existingPage?.slug ?? '')
  const [description, setDescription] = useState(existingPage?.description ?? '')
  const [avatarUrl, setAvatarUrl] = useState(existingPage?.avatar_url ?? '')
  const [template, setTemplate] = useState<BioTemplate>(existingPage?.template ?? 'simples')
  const [bgColor, setBgColor] = useState(existingPage?.bg_color ?? '#0f0f0f')
  const [bgType, setBgType] = useState<BioBgType>(existingPage?.bg_type ?? 'solid')
  const [bgGradientTo, setBgGradientTo] = useState(existingPage?.bg_gradient_to ?? '')
  const [buttonStyle, setButtonStyle] = useState<BioButtonStyle>(existingPage?.button_style ?? 'filled')
  const [buttonRadius, setButtonRadius] = useState<BioButtonRadius>(existingPage?.button_radius ?? 'full')
  const [buttonColor, setButtonColor] = useState(existingPage?.button_color ?? '#25D366')
  const [textColor, setTextColor] = useState(existingPage?.text_color ?? '#ffffff')

  // Fase 2: novos estados visuais
  const [coverUrl, setCoverUrl] = useState(existingPage?.cover_url ?? '')
  const [fontFamily, setFontFamily] = useState<BioFontFamily>(existingPage?.font_family ?? 'default')
  const [buttonSpacing, setButtonSpacing] = useState<BioButtonSpacing>(existingPage?.button_spacing ?? 'normal')
  const [uploadingCover, setUploadingCover] = useState(false)

  // Fase 3: captação de leads
  const [captureEnabled, setCaptureEnabled] = useState(existingPage?.capture_enabled ?? false)
  const [captureFields, setCaptureFields] = useState<string[]>(existingPage?.capture_fields ?? ['name', 'phone'])
  const [captureTitle, setCaptureTitle] = useState(existingPage?.capture_title ?? 'Preencha seus dados')
  const [captureButtonLabel, setCaptureButtonLabel] = useState(existingPage?.capture_button_label ?? 'Continuar')

  // Fase 3: contexto AI Agent
  const [aiContextEnabled, setAiContextEnabled] = useState(existingPage?.ai_context_enabled ?? false)
  const [aiContextTemplate, setAiContextTemplate] = useState(existingPage?.ai_context_template ?? '')

  // Button editing state
  const [editingButtonId, setEditingButtonId] = useState<string | null>(null)
  const [addingButton, setAddingButton] = useState(false)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const createPage = useCreateBioPage()
  const updatePage = useUpdateBioPage()
  const createButton = useCreateBioButton()
  const updateButton = useUpdateBioButton()
  const deleteButton = useDeleteBioButton()
  const reorderButtons = useReorderBioButtons()

  function applyTemplate(t: BioTemplate) {
    setTemplate(t)
    const defaults = TEMPLATE_DEFAULTS[t]
    if (defaults.bg_color) setBgColor(defaults.bg_color)
    if (defaults.bg_type) setBgType(defaults.bg_type)
    if (defaults.bg_gradient_to !== undefined) setBgGradientTo(defaults.bg_gradient_to ?? '')
    if (defaults.button_style) setButtonStyle(defaults.button_style)
    if (defaults.button_radius) setButtonRadius(defaults.button_radius)
    if (defaults.button_color) setButtonColor(defaults.button_color)
    if (defaults.text_color) setTextColor(defaults.text_color)
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function handleSavePage() {
    if (!title.trim()) {
      toast({ variant: 'destructive', description: 'Informe um título para a página.' })
      return
    }
    if (!slug.trim()) {
      toast({ variant: 'destructive', description: 'Informe um slug para a página.' })
      return
    }
    const pageData = {
      title: title.trim(),
      slug: slug.trim(),
      description: description || undefined,
      avatar_url: avatarUrl || undefined,
      bg_color: bgColor,
      bg_type: bgType,
      bg_gradient_to: bgGradientTo || undefined,
      button_style: buttonStyle,
      button_radius: buttonRadius,
      button_color: buttonColor,
      text_color: textColor,
      template,
      // Fase 2
      cover_url: coverUrl || undefined,
      font_family: fontFamily,
      button_spacing: buttonSpacing,
      // Fase 3 — captação
      capture_enabled: captureEnabled,
      capture_fields: captureFields,
      capture_title: captureTitle.trim() || 'Preencha seus dados',
      capture_button_label: captureButtonLabel.trim() || 'Continuar',
      // Fase 3 — contexto AI
      ai_context_enabled: aiContextEnabled,
      ai_context_template: aiContextTemplate.trim() || undefined,
    }
    try {
      if (isEditing && editPageId) {
        await updatePage.mutateAsync({ id: editPageId, ...pageData })
        toast({ description: 'Página atualizada!' })
      } else {
        await createPage.mutateAsync({ ...pageData, instance_id: instanceId })
        toast({ description: 'Página criada!' })
        onClose()
      }
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro: ${(e as Error).message}` })
    }
  }

  async function handleAddButton(data: ButtonDraft) {
    if (!editPageId) {
      toast({ variant: 'destructive', description: 'Salve a página primeiro.' })
      return
    }
    try {
      await createButton.mutateAsync({
        ...data,
        bio_page_id: editPageId,
        position: existingButtons.length,
      })
      setAddingButton(false)
      toast({ description: 'Botão adicionado!' })
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro: ${(e as Error).message}` })
    }
  }

  async function handleUpdateButton(id: string, data: ButtonDraft) {
    try {
      await updateButton.mutateAsync({ id, ...data })
      setEditingButtonId(null)
      toast({ description: 'Botão atualizado!' })
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro: ${(e as Error).message}` })
    }
  }

  async function handleDeleteButton(btn: BioButton) {
    try {
      await deleteButton.mutateAsync({ id: btn.id, pageId: btn.bio_page_id })
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro: ${(e as Error).message}` })
    }
  }

  async function handleMoveButton(btn: BioButton, dir: 'up' | 'down') {
    if (!editPageId) return
    const sorted = [...existingButtons].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex((b) => b.id === btn.id)
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === sorted.length - 1)) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    const newOrder = [...sorted]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    await reorderButtons.mutateAsync({ pageId: editPageId, orderedIds: newOrder.map((b) => b.id) })
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true)
    try {
      const url = await uploadBioImage(file)
      setAvatarUrl(url)
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro no upload: ${(e as Error).message}` })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true)
    try {
      const url = await uploadBioImage(file)
      setCoverUrl(url)
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro no upload: ${(e as Error).message}` })
    } finally {
      setUploadingCover(false)
    }
  }

  const previewPage: Partial<BioPage> = {
    title,
    description: description || null,
    avatar_url: avatarUrl || null,
    bg_color: bgColor,
    bg_type: bgType,
    bg_gradient_to: bgGradientTo || null,
    button_style: buttonStyle,
    button_radius: buttonRadius,
    button_color: buttonColor,
    text_color: textColor,
    template,
    // Fase 2
    cover_url: coverUrl || null,
    font_family: fontFamily,
    button_spacing: buttonSpacing,
    // Fase 3
    capture_enabled: captureEnabled,
    capture_fields: captureFields,
    capture_title: captureTitle,
    capture_button_label: captureButtonLabel,
    ai_context_enabled: aiContextEnabled,
    ai_context_template: aiContextTemplate || null,
  }

  const isSaving = createPage.isPending || updatePage.isPending

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{isEditing ? 'Editar página Bio' : 'Nova página Bio'}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="aparencia" className="flex flex-col h-full">
          <TabsList className="mx-6 mt-4 self-start rounded-full bg-muted/60 h-9">
            <TabsTrigger value="aparencia" className="rounded-full text-xs px-4">Aparência</TabsTrigger>
            <TabsTrigger value="botoes" className="rounded-full text-xs px-4">Botões</TabsTrigger>
            <TabsTrigger value="preview" className="rounded-full text-xs px-4">Preview</TabsTrigger>
          </TabsList>

          {/* ── Tab: Aparência ─────────────────────────────────────────── */}
          <TabsContent value="aparencia" className="px-6 pb-24 flex flex-col gap-5 mt-4">
            {/* Título + slug */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Título da página</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (!isEditing) setSlug(generateSlug(e.target.value))
                }}
                placeholder="Minha loja"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug (URL pública)</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">/bio/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="minha-loja"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Uma frase sobre você ou sua empresa"
                rows={2}
              />
            </div>

            {/* Avatar */}
            <div className="space-y-1.5">
              <Label>Logo / Foto de perfil</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                  style={{ backgroundColor: bgColor }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xl font-bold text-white/50">
                      {title.charAt(0).toUpperCase() || 'B'}
                    </span>
                  )}
                </div>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" type="button" disabled={uploadingAvatar} asChild>
                    <span>
                      {uploadingAvatar ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <ImageIcon size={14} className="mr-1" />
                      )}
                      Enviar imagem
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAvatarUpload(file)
                    }}
                  />
                </label>
                {avatarUrl && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setAvatarUrl('')}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>

            {/* Template */}
            <div className="space-y-2">
              <Label>Template</Label>
              <TemplateSelector value={template} onChange={applyTemplate} />
            </div>

            {/* Cores */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bg-color">Cor de fundo</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="bg-color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="text-color">Cor do texto</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="text-color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="btn-color">Cor dos botões</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    id="btn-color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              {bgType === 'gradient' && (
                <div className="space-y-1.5">
                  <Label htmlFor="bg-gradient">Cor gradiente (2ª cor)</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      id="bg-gradient"
                      value={bgGradientTo || '#000000'}
                      onChange={(e) => setBgGradientTo(e.target.value)}
                      className="w-9 h-9 rounded-lg border cursor-pointer"
                    />
                    <Input
                      value={bgGradientTo}
                      onChange={(e) => setBgGradientTo(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Capa / Banner */}
            <div className="space-y-1.5">
              <Label>Capa / Banner (opcional)</Label>
              <p className="text-xs text-muted-foreground">Imagem exibida no topo da página (antes do avatar)</p>
              {coverUrl ? (
                <div className="flex flex-col gap-2">
                  <img src={coverUrl} alt="cover" className="w-full aspect-[3/1] rounded-xl object-cover" />
                  <Button variant="ghost" size="sm" className="text-destructive self-start" type="button"
                    onClick={() => setCoverUrl('')}>
                    <Trash2 size={14} className="mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 w-fit cursor-pointer">
                  <Button variant="outline" size="sm" type="button" disabled={uploadingCover} asChild>
                    <span>
                      {uploadingCover ? <Loader2 size={14} className="animate-spin mr-1" /> : <ImageIcon size={14} className="mr-1" />}
                      Enviar capa
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCoverUpload(file) }} />
                </label>
              )}
            </div>

            {/* Fonte */}
            <div className="space-y-1.5">
              <Label>Fonte</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['default', 'serif', 'mono'] as const).map((val) => {
                  const labels: Record<typeof val, string> = { default: 'Padrão', serif: 'Serifada', mono: 'Mono' }
                  const classes: Record<typeof val, string> = { default: 'font-sans', serif: 'font-serif', mono: 'font-mono' }
                  return (
                    <button key={val} type="button"
                      onClick={() => setFontFamily(val)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all ${classes[val]} ${fontFamily === val ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}>
                      {labels[val]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Espaçamento */}
            <div className="space-y-1.5">
              <Label>Espaçamento entre botões</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'loose'] as const).map((val) => {
                  const labels: Record<typeof val, string> = { compact: 'Compacto', normal: 'Normal', loose: 'Espaçado' }
                  return (
                    <button key={val} type="button"
                      onClick={() => setButtonSpacing(val)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all ${buttonSpacing === val ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}>
                      {labels[val]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Captação de Leads (Fase 3) */}
            <div className="space-y-3 border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Captação de Leads</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exibe formulário antes de executar a ação do botão
                  </p>
                </div>
                <Switch
                  checked={captureEnabled}
                  onCheckedChange={setCaptureEnabled}
                />
              </div>

              {captureEnabled && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Campos do formulário</Label>
                    <div className="flex flex-col gap-2">
                      {(['name', 'phone', 'email'] as const).map((field) => {
                        const fieldLabels: Record<typeof field, string> = {
                          name: 'Nome (obrigatório)',
                          phone: 'WhatsApp (obrigatório)',
                          email: 'E-mail (opcional)',
                        }
                        return (
                          <div key={field} className="flex items-center gap-2">
                            <Checkbox
                              id={`capture-field-${field}`}
                              checked={captureFields.includes(field)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCaptureFields((prev) => [...prev, field])
                                } else {
                                  setCaptureFields((prev) => prev.filter((f) => f !== field))
                                }
                              }}
                            />
                            <label
                              htmlFor={`capture-field-${field}`}
                              className="text-sm cursor-pointer"
                            >
                              {fieldLabels[field]}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="capture-title-input" className="text-xs text-muted-foreground">
                      Título do formulário
                    </Label>
                    <Input
                      id="capture-title-input"
                      value={captureTitle}
                      onChange={(e) => setCaptureTitle(e.target.value)}
                      placeholder="Preencha seus dados"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="capture-btn-label" className="text-xs text-muted-foreground">
                      Label do botão
                    </Label>
                    <Input
                      id="capture-btn-label"
                      value={captureButtonLabel}
                      onChange={(e) => setCaptureButtonLabel(e.target.value)}
                      placeholder="Continuar"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Contexto AI Agent (Fase 3) */}
            <div className="space-y-3 border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Contexto AI Agent</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Injeta contexto na mensagem ao abrir WhatsApp
                  </p>
                </div>
                <Switch
                  checked={aiContextEnabled}
                  onCheckedChange={setAiContextEnabled}
                />
              </div>

              {aiContextEnabled && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-context-template" className="text-xs text-muted-foreground">
                      Template de contexto
                    </Label>
                    <Textarea
                      id="ai-context-template"
                      value={aiContextTemplate}
                      onChange={(e) => setAiContextTemplate(e.target.value)}
                      placeholder="Vim da página {page_title} e cliquei em {button_label}"
                      rows={3}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{page_title}'}</code>, <code className="bg-muted px-1 rounded">{'{button_label}'}</code>
                  </p>
                </div>
              )}
            </div>

            {/* Save button */}
            <Button onClick={handleSavePage} disabled={isSaving} className="w-full mt-2">
              {isSaving && <Loader2 size={14} className="animate-spin mr-1" />}
              {isEditing ? 'Salvar alterações' : 'Criar página'}
            </Button>
          </TabsContent>

          {/* ── Tab: Botões ──────────────────────────────────────────────── */}
          <TabsContent value="botoes" className="px-6 pb-24 flex flex-col gap-3 mt-4">
            {!isEditing && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                Crie a página na aba <strong>Aparência</strong> primeiro para adicionar botões.
              </p>
            )}

            {isEditing && (
              <>
                {/* Button list */}
                {[...existingButtons]
                  .sort((a, b) => a.position - b.position)
                  .map((btn, idx, arr) => (
                    <div key={btn.id}>
                      {editingButtonId === btn.id ? (
                        <div className="border rounded-xl p-4">
                          <BioButtonEditor
                            initial={btn}
                            onSave={(data) => handleUpdateButton(btn.id, data)}
                            onCancel={() => setEditingButtonId(null)}
                            saving={updateButton.isPending}
                            instanceId={instanceId}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                          <GripVertical size={14} className="text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{btn.label}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{btn.type}</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{btn.layout}</Badge>
                              <span className="text-[10px] text-muted-foreground">{btn.click_count} cliques</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === 0}
                              onClick={() => handleMoveButton(btn, 'up')}
                              title="Mover para cima"
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === arr.length - 1}
                              onClick={() => handleMoveButton(btn, 'down')}
                              title="Mover para baixo"
                            >
                              ↓
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingButtonId(btn.id)}
                            >
                              ✎
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteButton(btn)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                {/* Add button form */}
                {addingButton ? (
                  <div className="border rounded-xl p-4">
                    <BioButtonEditor
                      onSave={handleAddButton}
                      onCancel={() => setAddingButton(false)}
                      saving={createButton.isPending}
                      instanceId={instanceId}
                    />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setAddingButton(true)}
                  >
                    <Plus size={14} className="mr-1" /> Adicionar botão
                  </Button>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Tab: Preview ─────────────────────────────────────────────── */}
          <TabsContent value="preview" className="px-6 pb-6 mt-4">
            <div className="rounded-2xl border overflow-hidden">
              <BioLinkPreview page={previewPage} buttons={existingButtons} />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
