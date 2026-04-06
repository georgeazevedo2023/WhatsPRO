import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { uploadBioImage } from '@/lib/uploadBioImage'
import { useToast } from '@/hooks/use-toast'
import { useCatalogProductsForBio } from '@/hooks/useBioPages'
import type { BioButton, BioButtonType, BioButtonLayout, SocialPlatform, CreateBioButtonInput } from '@/types/bio'
import { SOCIAL_LABELS } from '@/types/bio'

type ButtonDraft = Omit<CreateBioButtonInput, 'bio_page_id' | 'position'>

interface BioButtonEditorProps {
  initial?: Partial<BioButton>
  onSave: (data: ButtonDraft) => void
  onCancel: () => void
  saving?: boolean
  instanceId?: string
}

const BUTTON_TYPES: Array<{ value: BioButtonType; label: string }> = [
  { value: 'url', label: 'URL / Link' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'form', label: 'Formulário' },
  { value: 'social', label: 'Rede Social' },
  { value: 'catalog', label: 'Produto Catálogo' },
]

const LAYOUT_OPTIONS: Array<{ value: BioButtonLayout; label: string; desc: string }> = [
  { value: 'stack', label: 'Padrão (pill)', desc: 'Botão horizontal com texto' },
  { value: 'featured', label: 'Destaque (imagem 16:9)', desc: 'Imagem grande + texto na parte inferior' },
  { value: 'social_icon', label: 'Ícone social', desc: 'Exibido na linha de ícones acima dos botões' },
]

export function BioButtonEditor({ initial, onSave, onCancel, saving, instanceId }: BioButtonEditorProps) {
  const { toast } = useToast()
  const [type, setType] = useState<BioButtonType>(initial?.type ?? 'url')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [formSlug, setFormSlug] = useState(initial?.form_slug ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [preMessage, setPreMessage] = useState(initial?.pre_message ?? '')
  const [whatsappTag, setWhatsappTag] = useState(initial?.whatsapp_tag ?? '')
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform | ''>(initial?.social_platform ?? '')
  const [layout, setLayout] = useState<BioButtonLayout>(initial?.layout ?? 'stack')
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnail_url ?? '')
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initial?.featured_image_url ?? '')
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [uploadingFeatured, setUploadingFeatured] = useState(false)

  // Fase 2: catalog + scheduling
  const [catalogProductId, setCatalogProductId] = useState(initial?.catalog_product_id ?? '')
  const [startsAt, setStartsAt] = useState(initial?.starts_at ? toDatetimeLocal(initial.starts_at) : '')
  const [endsAt, setEndsAt] = useState(initial?.ends_at ? toDatetimeLocal(initial.ends_at) : '')

  const { data: catalogProducts = [] } = useCatalogProductsForBio(type === 'catalog' ? (instanceId ?? null) : null)

  function toDatetimeLocal(iso: string): string {
    // Converte ISO string para formato datetime-local (sem segundos)
    try {
      return iso.slice(0, 16)
    } catch {
      return ''
    }
  }

  async function handleUpload(
    file: File,
    setter: (url: string) => void,
    setLoading: (v: boolean) => void
  ) {
    setLoading(true)
    try {
      const publicUrl = await uploadBioImage(file)
      setter(publicUrl)
    } catch (e) {
      toast({ variant: 'destructive', description: `Erro ao fazer upload: ${(e as Error).message}` })
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    if (!label.trim()) {
      toast({ variant: 'destructive', description: 'Informe um texto para o botão.' })
      return
    }
    const data: ButtonDraft = {
      label: label.trim(),
      type,
      layout,
      url: url || undefined,
      form_slug: formSlug || undefined,
      phone: phone || undefined,
      pre_message: preMessage || undefined,
      whatsapp_tag: whatsappTag || undefined,
      social_platform: (socialPlatform as SocialPlatform) || undefined,
      thumbnail_url: thumbnailUrl || undefined,
      featured_image_url: featuredImageUrl || undefined,
      catalog_product_id: catalogProductId || undefined,
      starts_at: startsAt || undefined,
      ends_at: endsAt || undefined,
    }
    onSave(data)
  }

  const selectedProduct = catalogProducts.find((p) => p.id === catalogProductId)

  return (
    <div className="flex flex-col gap-4">
      {/* Tipo */}
      <div className="space-y-1.5">
        <Label>Tipo de botão</Label>
        <div className="grid grid-cols-2 gap-2">
          {BUTTON_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                type === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label htmlFor="btn-label">Texto do botão</Label>
        <Input
          id="btn-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={type === 'catalog' && selectedProduct ? selectedProduct.title : 'Ex: Fale conosco no WhatsApp'}
        />
      </div>

      {/* Campos por tipo */}
      {type === 'url' && (
        <div className="space-y-1.5">
          <Label htmlFor="btn-url">URL</Label>
          <Input
            id="btn-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com"
          />
        </div>
      )}

      {type === 'whatsapp' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="btn-phone">Número (com DDD e DDI)</Label>
            <Input
              id="btn-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5581999999999"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="btn-msg">Mensagem pré-preenchida</Label>
            <Textarea
              id="btn-msg"
              value={preMessage}
              onChange={(e) => setPreMessage(e.target.value)}
              placeholder="Olá! Vim pelo link da bio..."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="btn-tag">Tag da conversa (opcional)</Label>
            <Input
              id="btn-tag"
              value={whatsappTag}
              onChange={(e) => setWhatsappTag(e.target.value)}
              placeholder="bio_link:instagram"
            />
            <p className="text-xs text-muted-foreground">Tag aplicada automaticamente quando o lead clicar</p>
          </div>
        </>
      )}

      {type === 'form' && (
        <div className="space-y-1.5">
          <Label htmlFor="btn-form">Slug do formulário</Label>
          <Input
            id="btn-form"
            value={formSlug}
            onChange={(e) => setFormSlug(e.target.value)}
            placeholder="cadastro-clientes"
          />
        </div>
      )}

      {type === 'social' && (
        <>
          <div className="space-y-1.5">
            <Label>Plataforma</Label>
            <Select value={socialPlatform} onValueChange={(v) => setSocialPlatform(v as SocialPlatform)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a plataforma" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOCIAL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="btn-social-url">URL do perfil</Label>
            <Input
              id="btn-social-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/seuperfil"
            />
          </div>
        </>
      )}

      {/* Seletor de produto do catálogo */}
      {type === 'catalog' && (
        <div className="space-y-2">
          <Label>Produto do catálogo</Label>
          {selectedProduct ? (
            <div className="flex items-center gap-3 p-3 border rounded-xl">
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedProduct.title}</p>
                {selectedProduct.price != null && (
                  <p className="text-xs text-muted-foreground">
                    {selectedProduct.currency === 'BRL' ? 'R$' : (selectedProduct.currency ?? '')} {selectedProduct.price.toFixed(2)}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCatalogProductId('')}
                type="button"
              >
                Trocar
              </Button>
            </div>
          ) : catalogProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              {instanceId ? 'Nenhum produto encontrado no catálogo do agente desta instância.' : 'Instância não identificada.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto border rounded-xl p-2">
              {catalogProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setCatalogProductId(product.id)
                    if (!label.trim()) setLabel(product.title)
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.title}</p>
                    {product.price != null && (
                      <p className="text-xs text-muted-foreground">
                        {product.currency === 'BRL' ? 'R$' : (product.currency ?? '')} {product.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Campo de URL para fallback/link do produto */}
          <div className="space-y-1">
            <Label htmlFor="btn-catalog-url" className="text-xs text-muted-foreground">URL do produto (opcional)</Label>
            <Input
              id="btn-catalog-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://loja.com/produto"
              className="text-xs"
            />
          </div>
          {/* Número WhatsApp para contato sobre o produto */}
          <div className="space-y-1">
            <Label htmlFor="btn-catalog-phone" className="text-xs text-muted-foreground">WhatsApp para contato (opcional)</Label>
            <Input
              id="btn-catalog-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5581999999999"
              className="text-xs"
            />
          </div>
        </div>
      )}

      {/* Layout (só para url/whatsapp/form/catalog) */}
      {type !== 'social' && type !== 'catalog' && (
        <div className="space-y-1.5">
          <Label>Layout</Label>
          <div className="flex flex-col gap-1.5">
            {LAYOUT_OPTIONS.map((lo) => (
              <button
                key={lo.value}
                type="button"
                onClick={() => setLayout(lo.value)}
                className={`flex flex-col px-3 py-2 rounded-lg border text-left text-sm transition-all ${
                  layout === lo.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <span className="font-medium">{lo.label}</span>
                <span className="text-xs text-muted-foreground">{lo.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Imagem thumbnail (stack) */}
      {layout === 'stack' && type !== 'social' && type !== 'catalog' && (
        <div className="space-y-1.5">
          <Label>Imagem miniatura (opcional)</Label>
          {thumbnailUrl ? (
            <div className="flex items-center gap-2">
              <img src={thumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setThumbnailUrl('')}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 w-fit cursor-pointer">
              <Button variant="outline" size="sm" type="button" disabled={uploadingThumb} asChild>
                <span>
                  {uploadingThumb ? <Loader2 size={14} className="animate-spin mr-1" /> : <ImageIcon size={14} className="mr-1" />}
                  Enviar imagem
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file, setThumbnailUrl, setUploadingThumb)
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Imagem featured */}
      {layout === 'featured' && type !== 'catalog' && (
        <div className="space-y-1.5">
          <Label>Imagem de destaque (16:9)</Label>
          {featuredImageUrl ? (
            <div className="flex flex-col gap-2">
              <img src={featuredImageUrl} alt="" className="w-full aspect-video rounded-xl object-cover" />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive self-start"
                onClick={() => setFeaturedImageUrl('')}
              >
                <Trash2 size={14} className="mr-1" /> Remover
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 w-fit cursor-pointer">
              <Button variant="outline" size="sm" type="button" disabled={uploadingFeatured} asChild>
                <span>
                  {uploadingFeatured ? <Loader2 size={14} className="animate-spin mr-1" /> : <ImageIcon size={14} className="mr-1" />}
                  Enviar imagem
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file, setFeaturedImageUrl, setUploadingFeatured)
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Agendamento (para todos exceto social) */}
      {type !== 'social' && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Agendamento (opcional)
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="starts-at" className="text-xs">Início</Label>
              <Input
                id="starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ends-at" className="text-xs">Fim</Label>
              <Input
                id="ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Deixe em branco para sempre visível</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} className="flex-1" type="button">
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1" type="button">
          {saving && <Loader2 size={14} className="animate-spin mr-1" />}
          Salvar botão
        </Button>
      </div>
    </div>
  )
}
