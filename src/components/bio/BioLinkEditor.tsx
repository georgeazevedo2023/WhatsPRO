import { useState } from 'react'
import { GripVertical, ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
