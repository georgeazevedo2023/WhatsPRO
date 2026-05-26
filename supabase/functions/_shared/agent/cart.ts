/**
 * Premium #2 Cart Engine (2026-05-25) — helpers PUROS de pedido estruturado.
 *
 * O ai-agent monta o pedido do lead via tools add_to_cart/update_cart; o estado
 * vive em conversations.cart_items (JSONB), mesmo padrão runtime do
 * shown_product_ids (v7.49.0). Estes helpers são puros (sem I/O) → fáceis de
 * testar e reusar no dispatch (index.ts) e no resumo do handoff (businessHours).
 *
 * Contexto SDR: monta o pedido e entrega itemizado ao vendedor no transbordo.
 * NÃO é checkout — sem pagamento/frete/cupom (isso é o M11 T11.11 separado).
 */

export interface CartItem {
  product_id: string | null
  name: string
  qty: number
  unit_price: number | null
  added_at: string
}

export interface CartUpdate {
  action: 'set_qty' | 'remove' | 'clear'
  target: string | null
  qty: number | null
}

const norm = (s: string): string => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Mesma identidade: product_id igual (quando ambos têm) OU nome normalizado igual. */
function sameItem(
  a: { product_id: string | null; name: string },
  b: { product_id: string | null; name: string },
): boolean {
  if (a.product_id && b.product_id) return a.product_id === b.product_id
  return norm(a.name) === norm(b.name)
}

/** Sanitiza um item cru (vindo da tool) num CartItem válido. Retorna null se inválido. */
function sanitizeIncoming(raw: Partial<CartItem>, nowIso: string): CartItem | null {
  const name = (raw?.name ?? '').toString().trim()
  if (!name) return null
  const qty = Math.max(1, Math.floor(Number(raw?.qty) || 1))
  const unit_price =
    typeof raw?.unit_price === 'number' && isFinite(raw.unit_price) && raw.unit_price >= 0
      ? raw.unit_price
      : null
  const product_id = raw?.product_id ? String(raw.product_id) : null
  return { product_id, name, qty, unit_price, added_at: nowIso }
}

/** Normaliza um array vindo do DB (defensivo contra lixo/legacy). */
export function normalizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  const out: CartItem[] = []
  for (const r of raw) {
    const item = sanitizeIncoming(r as Partial<CartItem>, (r as CartItem)?.added_at || new Date().toISOString())
    if (item) out.push(item)
  }
  return out
}

/** Adiciona itens, somando qty de itens iguais. Retorna NOVO array (imutável). */
export function mergeCartItems(
  existing: CartItem[],
  incoming: Array<Partial<CartItem>>,
  nowIso: string = new Date().toISOString(),
): CartItem[] {
  const out = (existing || []).map((i) => ({ ...i }))
  for (const raw of incoming || []) {
    const item = sanitizeIncoming(raw, nowIso)
    if (!item) continue
    const match = out.find((o) => sameItem(o, item))
    if (match) {
      match.qty += item.qty
      if (match.unit_price === null && item.unit_price !== null) match.unit_price = item.unit_price
      if (!match.product_id && item.product_id) match.product_id = item.product_id
    } else {
      out.push(item)
    }
  }
  return out
}

/** Aplica edição (set_qty/remove/clear). Retorna NOVO array. */
export function applyCartUpdate(existing: CartItem[], update: CartUpdate): CartItem[] {
  const items = existing || []
  if (!update) return items
  if (update.action === 'clear') return []
  const target = update.target ? norm(update.target) : ''
  if (!target) return items
  const isTarget = (i: CartItem) => norm(i.name) === target || (!!i.product_id && i.product_id === update.target)
  if (update.action === 'remove') {
    return items.filter((i) => !isTarget(i))
  }
  if (update.action === 'set_qty') {
    const qty = Math.floor(Number(update.qty) || 0)
    const out: CartItem[] = []
    for (const i of items) {
      if (isTarget(i)) {
        if (qty > 0) out.push({ ...i, qty }) // qty<=0 → remove
      } else {
        out.push(i)
      }
    }
    return out
  }
  return items
}

/** {total, hasUnpriced} — soma qty*unit_price dos itens com preço conhecido. */
export function cartSubtotal(items: CartItem[]): { total: number; hasUnpriced: boolean } {
  let total = 0
  let hasUnpriced = false
  for (const i of items || []) {
    if (i.unit_price === null) {
      hasUnpriced = true
      continue
    }
    total += i.unit_price * i.qty
  }
  return { total, hasUnpriced }
}

const brl = (n: number): string => `R$ ${n.toFixed(2).replace('.', ',')}`

/**
 * Resumo legível do pedido. Vazio → ''.
 *   • {qty}x {nome} — R$ {subtotal}
 * Total estimado quando há preços; "(+ itens a confirmar)" se algum sem preço.
 */
/** Versão compacta de 1 linha pro texto ao lead: "2x Tinta Branca, 1x Rolo 23cm". */
export function formatCartOneLine(items: CartItem[], maxLen = 160): string {
  const list = (items || []).filter((i) => i && i.name)
  if (list.length === 0) return ''
  const s = list.map((i) => `${i.qty}x ${i.name}`).join(', ')
  return s.length > maxLen ? `${s.slice(0, maxLen - 1).trimEnd()}…` : s
}

export function formatCartSummary(items: CartItem[]): string {
  const list = (items || []).filter((i) => i && i.name)
  if (list.length === 0) return ''
  const lines = list.map((i) => {
    const priced = i.unit_price !== null ? ` — ${brl(i.unit_price * i.qty)}` : ''
    return `• ${i.qty}x ${i.name}${priced}`
  })
  const { total, hasUnpriced } = cartSubtotal(list)
  const count = list.reduce((s, i) => s + i.qty, 0)
  const header = `Pedido (${count} ${count === 1 ? 'item' : 'itens'}):`
  const totalLine =
    total > 0 ? `\nTotal estimado: ${brl(total)}${hasUnpriced ? ' (+ itens a confirmar)' : ''}` : ''
  return `${header}\n${lines.join('\n')}${totalLine}`
}
