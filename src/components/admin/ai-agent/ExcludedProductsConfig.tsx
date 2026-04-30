import { useMemo } from 'react'
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
  message: string
  suggested_categories?: string[]
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
    updateItems([
      ...items,
      {
        id,
        keywords: [],
        message: '',
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

  const setKeywords = (index: number, csv: string) => {
    const keywords = csv
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    updateItem(index, { keywords })
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
          a IA responde educadamente <strong>sem fazer transbordo</strong> e sugere alternativas.
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
              const noMessage = !item.message || item.message.trim() === ''
              const hasError = idDup || noKeywords || noMessage

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
                    <Input
                      value={(item.keywords || []).join(', ')}
                      onChange={(e) => setKeywords(index, e.target.value)}
                      placeholder="caixa de correio, correio, mailbox"
                      className={noKeywords ? 'border-destructive' : ''}
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
                    <Label className="text-xs">Resposta da IA quando o lead perguntar</Label>
                    <Textarea
                      value={item.message}
                      onChange={(e) => updateItem(index, { message: e.target.value })}
                      placeholder="Não trabalhamos com caixa de correio, mas posso te ajudar com cofres ou fechaduras se interessar."
                      className={`min-h-[70px] text-sm ${noMessage ? 'border-destructive' : ''}`}
                    />
                    {noMessage && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Mensagem obrigatória
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Dica: cite alternativas que você vende para reaproveitar o interesse do lead.
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
            <li>Se o lead insistir ou pedir vendedor depois, fluxo normal de transbordo se aplica</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
