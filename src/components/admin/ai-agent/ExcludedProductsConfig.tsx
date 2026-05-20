import { useMemo, useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Ban,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  MessageSquareQuote,
  Tags,
  Info,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  SearchX,
  Pencil,
} from 'lucide-react'

export interface ExcludedProduct {
  id: string
  keywords: string[]
  message?: string
  suggested_categories?: string[]
}

/**
 * Template padrão usado quando admin clica "Usar mensagem padrão" OU quando
 * fica em branco (runtime gera o fallback dinâmico).
 *
 * R112 (rev): EXCEÇÃO da regra de ouro — para excluded_products é OK dizer
 * "não trabalhamos com" porque admin configurou intencionalmente E acompanha
 * alternativas (suggested_categories). Honestidade > eufemismo aqui.
 */
function buildDefaultMessage(matchedKeyword: string, suggestedCategories?: string[]): string {
  const validCats = (suggestedCategories || [])
    .map(c => (c || '').trim())
    .filter(c => c.length > 0)

  let alternatives: string
  if (validCats.length === 0) {
    alternatives = 'outros materiais relacionados'
  } else if (validCats.length === 1) {
    alternatives = validCats[0]
  } else if (validCats.length === 2) {
    alternatives = `${validCats[0]} e ${validCats[1]}`
  } else {
    alternatives = `${validCats.slice(0, -1).join(', ')} e ${validCats[validCats.length - 1]}`
  }

  return `Infelizmente não trabalhamos com ${matchedKeyword}, mas temos ${alternatives}. Posso te ajudar em algo mais? 😊`
}

interface ExcludedProductsConfigProps {
  config: Record<string, any>
  onChange: (updates: Record<string, any>) => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 40) || 'item'
}

type ExcludedSort = 'order' | 'name_asc' | 'most_keywords' | 'no_alts'
const PAGE_SIZE = 12

/**
 * Sub-componente isolado pra CSVs (keywords/alternativas) com estado local.
 * Resolve bug onde `.trim()` em onChange impedia digitar espaço.
 */
function CsvInput({
  initialValue,
  onSave,
  hasError,
  itemId,
  placeholder,
}: {
  initialValue: string[]
  onSave: (values: string[]) => void
  hasError?: boolean
  itemId: string
  placeholder: string
}) {
  const [text, setText] = useState(() => (initialValue || []).join(', '))
  const lastItemIdRef = useRef(itemId)

  useEffect(() => {
    if (lastItemIdRef.current !== itemId) {
      lastItemIdRef.current = itemId
      setText((initialValue || []).join(', '))
    }
  }, [itemId, initialValue])

  const handleChange = (newText: string) => {
    setText(newText)
    const values = newText.split(',').map((k) => k.trim()).filter(Boolean)
    onSave(values)
  }

  return (
    <Input
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      className={`h-9 text-sm ${hasError ? 'border-destructive' : ''}`}
    />
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ProductTile — visual compacto no grid
// ────────────────────────────────────────────────────────────────────────────

interface ProductTileProps {
  product: ExcludedProduct
  hasError: boolean
  onClick: () => void
}

function ProductTile({ product, hasError, onClick }: ProductTileProps) {
  const kwCount = product.keywords?.length || 0
  const altCount = product.suggested_categories?.length || 0
  const firstKw = product.keywords?.[0] || ''
  const remaining = Math.max(0, kwCount - 3)
  const previewKws = (product.keywords || []).slice(0, 3)
  const hasCustom = !!product.message?.trim()
  const previewMessage = hasCustom
    ? product.message!.trim()
    : buildDefaultMessage(firstKw || '[palavra-chave]', product.suggested_categories)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left w-full rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-destructive/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 ${
        hasError ? 'border-destructive/60 bg-destructive/[0.03]' : 'border-border'
      }`}
    >
      {hasError && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" aria-hidden />
      )}

      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        {/* Header: avatar Ban + ID + pencil */}
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-sm font-semibold truncate text-foreground">
              {product.id}
            </div>
            {kwCount === 0 ? (
              <div className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5 sm:mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Sem palavras-chave
              </div>
            ) : (
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1 flex items-baseline gap-1 flex-wrap line-clamp-1 sm:line-clamp-none">
                <span className="opacity-60">quando diz:</span>
                <span className="text-foreground/80 font-medium">
                  {previewKws.join(', ')}
                  {remaining > 0 && (
                    <span className="text-muted-foreground"> +{remaining}</span>
                  )}
                </span>
              </div>
            )}
          </div>
          <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-destructive transition-colors shrink-0" />
        </div>

        {/* Preview da mensagem */}
        <div className="rounded-md bg-emerald-500/[0.06] border border-emerald-500/15 p-2 sm:p-2.5">
          <div className="text-[9px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5 sm:mb-1 flex items-center gap-1">
            <MessageSquareQuote className="h-2.5 w-2.5" />
            Resposta da IA
            {!hasCustom && (
              <span className="text-muted-foreground font-normal normal-case tracking-normal ml-0.5">
                (automática)
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] italic leading-snug text-foreground/85 line-clamp-2">
            “{previewMessage}”
          </p>
        </div>

        {/* Footer: counts */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Tags className="h-3 w-3" />
            <strong className="text-foreground/90">{kwCount}</strong>
            <span className="hidden sm:inline">palavra{kwCount !== 1 ? 's' : ''}</span>
            <span className="sm:hidden">pal</span>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <strong className="text-foreground/90">{altCount}</strong>
            <span className="hidden sm:inline">alternativa{altCount !== 1 ? 's' : ''}</span>
            <span className="sm:hidden">alt</span>
          </span>
          {altCount === 0 && kwCount > 0 && (
            <Badge variant="outline" className="text-[9px] gap-1 h-5 ml-auto border-amber-500/40 text-amber-700 dark:text-amber-400">
              sem alt
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ProductEditor — conteúdo do Sheet (3 inputs + preview)
// ────────────────────────────────────────────────────────────────────────────

interface ProductEditorProps {
  product: ExcludedProduct
  idDup: boolean
  noKeywords: boolean
  onChange: (patch: Partial<ExcludedProduct>) => void
  onRemove: () => void
}

function ProductEditor({ product, idDup, noKeywords, onChange, onRemove }: ProductEditorProps) {
  const firstKw = product.keywords?.[0] || '[palavra-chave]'
  const previewMessage = product.message?.trim() || buildDefaultMessage(firstKw, product.suggested_categories)
  const hasCustom = !!product.message?.trim()

  return (
    <div className="space-y-5">
      {/* ID */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
          Identificador
          <span className="opacity-60 normal-case tracking-normal">(gerado automaticamente)</span>
        </Label>
        <Input
          value={product.id}
          onChange={(e) => onChange({ id: slugify(e.target.value) || 'produto' })}
          placeholder="caixa_correio"
          className={`font-mono text-sm ${idDup ? 'border-destructive' : ''}`}
        />
        {idDup && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Identificador duplicado
          </p>
        )}
      </div>

      {/* Keywords */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
          <Tags className="h-3 w-3" />
          Palavras que o lead pode usar
        </Label>
        <CsvInput
          initialValue={product.keywords || []}
          onSave={(kws) => onChange({ keywords: kws })}
          hasError={noKeywords}
          itemId={product.id}
          placeholder="geladeira, refrigerador, freezer"
        />
        {noKeywords ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Adicione ao menos uma palavra-chave
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Separe por vírgula. A IA detecta a primeira que aparecer (case-insensitive, ignora acentos).
          </p>
        )}
      </div>

      {/* Alternatives */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
          <Sparkles className="h-3 w-3" />
          Alternativas que você vende
        </Label>
        <CsvInput
          initialValue={product.suggested_categories || []}
          onSave={(cats) => onChange({ suggested_categories: cats })}
          itemId={product.id}
          placeholder="cadeiras, mesa de cabeceira"
        />
        <p className="text-[11px] text-muted-foreground">
          Usadas no fallback automático pra fazer cross-sell.
        </p>
      </div>

      {/* Custom message */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
            <MessageSquareQuote className="h-3 w-3" />
            Resposta personalizada
            <span className="opacity-60 normal-case tracking-normal">(opcional)</span>
          </Label>
          <Button
            type="button"
            onClick={() => onChange({ message: previewMessage })}
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1"
          >
            <Sparkles className="h-2.5 w-2.5" />
            Usar padrão
          </Button>
        </div>
        <Textarea
          value={product.message || ''}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder={previewMessage}
          className="min-h-[80px] text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          {hasCustom
            ? 'Sobrescreve o fallback automático.'
            : 'Em branco = IA usa o preview abaixo.'}
        </p>
      </div>

      {/* Preview destacado */}
      <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
        <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <MessageSquareQuote className="h-3 w-3" />
          Pré-visualização
          {!hasCustom && (
            <span className="text-muted-foreground font-normal normal-case tracking-normal ml-1">
              (automática)
            </span>
          )}
        </div>
        <p className="text-sm italic leading-relaxed text-foreground/90">
          “{previewMessage}”
        </p>
      </div>

      {/* Remover */}
      <div className="pt-3 border-t">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remover produto
        </Button>
      </div>
    </div>
  )
}

export function ExcludedProductsConfig({ config, onChange }: ExcludedProductsConfigProps) {
  const items: ExcludedProduct[] = useMemo(() => {
    const raw = config.excluded_products
    if (Array.isArray(raw)) return raw as ExcludedProduct[]
    return []
  }, [config.excluded_products])

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<ExcludedSort>('order')
  const [page, setPage] = useState(0)

  const ids = useMemo(() => items.map((it) => it.id), [items])
  const duplicateIds = useMemo(() => {
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) dup.add(id)
      seen.add(id)
    }
    return dup
  }, [ids])

  const updateItems = (next: ExcludedProduct[]) => {
    onChange({ excluded_products: next })
  }

  const addItem = () => {
    const baseId = `produto_${items.length + 1}`
    let id = baseId
    let i = 1
    while (ids.includes(id)) {
      id = `${baseId}_${i++}`
    }
    updateItems([
      ...items,
      { id, keywords: [], message: '', suggested_categories: [] },
    ])
    setEditingIdx(items.length)
  }

  const updateItem = (index: number, patch: Partial<ExcludedProduct>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    updateItems(next)
  }

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index))
    setEditingIdx(null)
  }

  // ─── Filter + Sort + Paginate ───
  const indexedItems = useMemo(
    () => items.map((it, origIdx) => ({
      item: it,
      origIdx,
      hasError: duplicateIds.has(it.id) || !it.keywords?.length,
    })),
    [items, duplicateIds]
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return indexedItems
    return indexedItems.filter(({ item }) => {
      const hay = `${item.id} ${(item.keywords || []).join(' ')} ${(item.suggested_categories || []).join(' ')}`.toLowerCase()
      return hay.includes(normalizedQuery)
    })
  }, [indexedItems, normalizedQuery])

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems]
    switch (sortMode) {
      case 'name_asc':
        arr.sort((a, b) => a.item.id.localeCompare(b.item.id))
        break
      case 'most_keywords':
        arr.sort((a, b) => (b.item.keywords?.length || 0) - (a.item.keywords?.length || 0))
        break
      case 'no_alts':
        arr.sort((a, b) => Number(!a.item.suggested_categories?.length) - Number(!b.item.suggested_categories?.length))
        arr.reverse()
        break
    }
    return arr
  }, [filteredItems, sortMode])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pagedItems = sortedItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (page !== safePage) {
    setTimeout(() => setPage(safePage), 0)
  }

  // Stats
  const total = items.length
  const noAltsCount = items.filter(it => !it.suggested_categories?.length).length
  const withCustomMsg = items.filter(it => !!it.message?.trim()).length
  const errorsCount = items.filter(it => duplicateIds.has(it.id) || !it.keywords?.length).length

  const editingItem = editingIdx !== null ? items[editingIdx] : null
  const editingIdDup = editingItem ? duplicateIds.has(editingItem.id) : false
  const editingNoKeywords = editingItem ? !editingItem.keywords?.length : false

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive shrink-0" />
            Produtos que NÃO vendemos
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Liste produtos que sua loja não trabalha. A IA responde <strong>sem fazer transbordo</strong>{' '}
            e sugere alternativas que você vende.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats bar — 4 cols sempre, compacto */}
        {total > 0 && (
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <div className="rounded-lg border border-border bg-card px-2 py-2 sm:px-3 sm:py-2.5">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Cadastrados</div>
              <div className="text-base sm:text-lg font-bold text-foreground flex items-baseline gap-1">
                {total}
                <Ban className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive/60" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card px-2 py-2 sm:px-3 sm:py-2.5">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Custom</div>
              <div className="text-base sm:text-lg font-bold text-foreground flex items-baseline gap-1">
                {withCustomMsg}
                <MessageSquareQuote className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500/60" />
              </div>
            </div>
            <div className={`rounded-lg border px-2 py-2 sm:px-3 sm:py-2.5 ${noAltsCount > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'}`}>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Sem alt</div>
              <div className={`text-base sm:text-lg font-bold flex items-baseline gap-1 ${noAltsCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-foreground/60'}`}>
                {noAltsCount}
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </div>
            </div>
            <div className={`rounded-lg border px-2 py-2 sm:px-3 sm:py-2.5 ${errorsCount > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">Pendentes</div>
              <div className={`text-base sm:text-lg font-bold flex items-baseline gap-1 ${errorsCount > 0 ? 'text-destructive' : 'text-foreground/60'}`}>
                {errorsCount}
                <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </div>
            </div>
          </div>
        )}

        {/* Toolbar — compact mobile */}
        {total > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                placeholder="Buscar..."
                className="h-9 pl-8 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setPage(0) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={sortMode} onValueChange={(v) => { setSortMode(v as ExcludedSort); setPage(0) }}>
              <SelectTrigger className="h-9 w-[44px] sm:w-[180px] gap-1.5 px-2 sm:px-3">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue className="hidden sm:inline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Ordem original</SelectItem>
                <SelectItem value="name_asc">ID (A-Z)</SelectItem>
                <SelectItem value="most_keywords">Mais palavras-chave</SelectItem>
                <SelectItem value="no_alts">Sem alternativa primeiro</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addItem} size="sm" variant="destructive" className="h-9 gap-1.5 shrink-0 px-2 sm:px-3">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo produto</span>
            </Button>
          </div>
        )}

        {/* Resumo filtro */}
        {total > 0 && (normalizedQuery || sortMode !== 'order') && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>
              Mostrando <strong className="text-foreground">{sortedItems.length}</strong>
              {' de '}<strong className="text-foreground">{total}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => { setSearchQuery(''); setSortMode('order'); setPage(0) }}
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          </div>
        )}

        {/* Grid / empty states */}
        {total === 0 ? (
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
            <Ban className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Nenhum produto excluído</p>
            <p className="text-xs text-muted-foreground mb-4">
              Exemplo: "caixa de correio", "ar condicionado", "móveis planejados"
            </p>
            <Button onClick={addItem} variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Adicionar primeiro produto
            </Button>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed py-12 text-center">
            <SearchX className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Nenhum produto encontrado</p>
            <p className="text-xs text-muted-foreground mb-4">
              Não há resultados para "<strong className="text-foreground">{searchQuery}</strong>"
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSearchQuery(''); setSortMode('order'); setPage(0) }}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pagedItems.map(({ item, origIdx, hasError }) => (
                <ProductTile
                  key={`${item.id}-${origIdx}`}
                  product={item}
                  hasError={hasError}
                  onClick={() => setEditingIdx(origIdx)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="text-xs text-muted-foreground">
                  Página <strong className="text-foreground">{safePage + 1}</strong> de{' '}
                  <strong className="text-foreground">{totalPages}</strong>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => setPage(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                    disabled={safePage >= totalPages - 1}
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Como funciona */}
        <details className="rounded-md bg-muted/40 border border-border/50">
          <summary className="cursor-pointer text-xs font-medium px-3 py-2 flex items-center gap-1.5 hover:bg-muted/60 transition-colors list-none rounded-md">
            <Info className="h-3.5 w-3.5 text-primary" />
            Como funciona?
            <span className="ml-auto text-[10px] opacity-60">clique para abrir</span>
          </summary>
          <ul className="text-xs text-muted-foreground space-y-1 px-3 pb-3 pt-1 list-disc list-inside">
            <li>A IA verifica a mensagem do lead <strong>antes</strong> de qualquer outra regra</li>
            <li>Match exato em palavra-inteira (não casa partes — "correio" não casa "correios")</li>
            <li>Se casar, IA responde e <strong>NÃO faz transbordo</strong> nem incrementa contador</li>
            <li>A resposta é montada automaticamente a partir das <strong>alternativas</strong> — quanto mais relevantes, melhor o cross-sell</li>
            <li>A resposta personalizada é opcional — preencha só se quiser sobrescrever</li>
            <li>Se o lead insistir ou pedir vendedor depois, fluxo normal de transbordo se aplica</li>
          </ul>
        </details>

        {/* Sheet de edição */}
        <Sheet
          open={editingIdx !== null}
          onOpenChange={(open) => { if (!open) setEditingIdx(null) }}
        >
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
            {editingItem && editingIdx !== null && (
              <>
                <SheetHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <Ban className="h-4 w-4 text-destructive" />
                    <span className="font-mono">{editingItem.id}</span>
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Configure as palavras que detectam este produto e a resposta que a IA dará.
                  </SheetDescription>
                </SheetHeader>
                <div className="p-6">
                  <ProductEditor
                    product={editingItem}
                    idDup={editingIdDup}
                    noKeywords={editingNoKeywords}
                    onChange={(patch) => updateItem(editingIdx, patch)}
                    onRemove={() => removeItem(editingIdx)}
                  />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  )
}
