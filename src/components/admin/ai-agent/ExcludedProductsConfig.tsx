import { useMemo, useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Ban, Plus, Trash2, AlertCircle } from 'lucide-react'

export interface ExcludedProduct {
  id: string
  keywords: string[]
  message?: string  // R112 rev: opcional novamente. Runtime gera fallback dinâmico via suggested_categories.
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

/**
 * Sub-componente isolado pra keywords com estado local de texto.
 * Resolve bug onde `.trim()` em onChange impedia digitar espaço.
 * O texto raw fica em useState local; o array parsed só atualiza no onBlur ou quando limpa via , .
 */
function KeywordsInput({
  initialValue,
  onSave,
  hasError,
  itemId,
}: {
  initialValue: string[]
  onSave: (kws: string[]) => void
  hasError: boolean
  itemId: string  // pra detectar mudança de item externo (ex: troca de agente)
}) {
  const [text, setText] = useState(() => (initialValue || []).join(', '))
  const lastItemIdRef = useRef(itemId)

  // Sync quando o ITEM externo muda (troca de agente, novo item adicionado)
  // Não sincroniza quando initialValue muda por causa do nosso próprio onChange
  useEffect(() => {
    if (lastItemIdRef.current !== itemId) {
      lastItemIdRef.current = itemId
      setText((initialValue || []).join(', '))
    }
  }, [itemId, initialValue])

  const handleChange = (newText: string) => {
    setText(newText)
    // Parse e propaga: split por vírgula, trim cada elemento, remove vazios
    const keywords = newText.split(',').map((k) => k.trim()).filter(Boolean)
    onSave(keywords)
  }

  return (
    <Input
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="caixa de correio, correio, mailbox"
      className={hasError ? 'border-destructive' : ''}
    />
  )
}

export function ExcludedProductsConfig({ config, onChange }: ExcludedProductsConfigProps) {
  const items: ExcludedProduct[] = useMemo(() => {
    const raw = config.excluded_products
    if (Array.isArray(raw)) return raw as ExcludedProduct[]
    return []
  }, [config.excluded_products])

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
    // R112 rev: deixa message vazio — runtime gera fallback dinâmico via suggested_categories
    updateItems([
      ...items,
      {
        id,
        keywords: [],
        message: '',
        suggested_categories: [],
      },
    ])
  }

  const updateItem = (index: number, patch: Partial<ExcludedProduct>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    updateItems(next)
  }

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Ban className="w-4 h-4 text-destructive" />
          Produtos que NÃO vendemos
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {items.length} cadastrado{items.length === 1 ? '' : 's'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Liste produtos ou serviços que sua loja não trabalha. Quando o lead perguntar sobre algum,
          a IA responde <strong>sem fazer transbordo</strong> e sugere alternativas que você vende.
          Preencha as <strong>"Categorias alternativas"</strong> — a IA monta automaticamente a resposta no formato:
          <em>"Infelizmente não trabalhamos com [item], mas temos [alternativas]. Posso te ajudar em algo mais?"</em>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Nenhum produto excluído cadastrado.
              <br />
              <span className="text-xs">
                Exemplo: "caixa de correio" / "ar condicionado" / "móveis planejados"
              </span>
            </p>
            <Button onClick={addItem} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar primeiro produto
            </Button>
          </div>
        ) : (
          <>
            {items.map((item, index) => {
              const idDup = duplicateIds.has(item.id)
              const noKeywords = !item.keywords || item.keywords.length === 0
              // R112 rev: message agora é OPCIONAL — quando vazio, runtime gera fallback dinâmico com suggested_categories
              const hasError = idDup || noKeywords
              const firstKeyword = item.keywords?.[0] || '[palavra-chave]'
              const previewMessage = buildDefaultMessage(firstKeyword, item.suggested_categories)

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 space-y-3 ${
                    hasError ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-3">
                      <Label className="text-xs text-muted-foreground">
                        Identificador (gerado automaticamente)
                      </Label>
                      <Input
                        value={item.id}
                        onChange={(e) =>
                          updateItem(index, { id: slugify(e.target.value) || `produto_${index + 1}` })
                        }
                        placeholder="caixa_correio"
                        className={`mt-1 font-mono text-sm ${idDup ? 'border-destructive' : ''}`}
                      />
                      {idDup && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Identificador duplicado
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => removeItem(index)}
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 self-start"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Palavras-chave que o lead pode usar
                      <span className="text-muted-foreground ml-1">(separadas por vírgula)</span>
                    </Label>
                    <KeywordsInput
                      initialValue={item.keywords || []}
                      onSave={(kws) => updateItem(index, { keywords: kws })}
                      hasError={noKeywords}
                      itemId={item.id}
                    />
                    {noKeywords && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Adicione ao menos uma palavra-chave
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      A IA detecta a primeira palavra-chave que aparecer na mensagem do lead
                      (case-insensitive, ignora acentos).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Categorias alternativas que você vende
                      <span className="text-muted-foreground ml-1">(separadas por vírgula — usadas no fallback automático)</span>
                    </Label>
                    <Input
                      value={(item.suggested_categories || []).join(', ')}
                      onChange={(e) => {
                        const cats = e.target.value.split(',').map((c) => c.trim()).filter(Boolean)
                        updateItem(index, { suggested_categories: cats })
                      }}
                      placeholder="acessórios para quarto, cadeiras, mesa de cabeceira"
                      className="text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Quando lead perguntar sobre <strong>{firstKeyword}</strong>, IA dirá: <em>"Infelizmente não trabalhamos com {firstKeyword}, mas temos {item.suggested_categories?.length ? item.suggested_categories.join(', ') : 'outros materiais relacionados'}. Posso te ajudar em algo mais? 😊"</em>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">
                        Resposta personalizada da IA
                        <span className="text-muted-foreground ml-1">(opcional — sobrescreve o fallback automático)</span>
                      </Label>
                      <Button
                        type="button"
                        onClick={() => updateItem(index, { message: previewMessage })}
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px]"
                      >
                        Usar mensagem padrão
                      </Button>
                    </div>
                    <Textarea
                      value={item.message || ''}
                      onChange={(e) => updateItem(index, { message: e.target.value })}
                      placeholder={previewMessage}
                      className="min-h-[70px] text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {item.message && item.message.trim() !== ''
                        ? 'Mensagem personalizada ativa — sobrescreve o fallback automático acima.'
                        : 'Em branco, IA usa o fallback automático mostrado acima (gerado das categorias alternativas).'}
                    </p>
                  </div>
                </div>
              )
            })}

            <Button onClick={addItem} variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar produto excluído
            </Button>
          </>
        )}

        <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
          <p className="font-medium">Como funciona?</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>A IA verifica a mensagem do lead antes de qualquer outra regra</li>
            <li>Match exato em palavra-inteira (não casa partes — "correio" não casa "correios")</li>
            <li>Se casar, IA responde e <strong>NÃO faz transbordo</strong> nem incrementa contador de mensagens</li>
            <li>IA monta resposta automática a partir das <strong>categorias alternativas</strong> — quanto mais relevantes, melhor o cross-sell</li>
            <li>Resposta personalizada é opcional — preencha só se quiser sobrescrever o fallback automático</li>
            <li>Se o lead insistir ou pedir vendedor depois, fluxo normal de transbordo se aplica</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
