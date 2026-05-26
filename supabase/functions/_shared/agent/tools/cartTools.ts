/**
 * Premium #2 Cart Engine (2026-05-25) — dispatch da tool set_cart.
 *
 * Estado do pedido vive em conversations.cart_items (JSONB), mesmo padrão runtime
 * do shown_product_ids. set_cart SUBSTITUI o pedido inteiro pela lista que o LLM
 * manda (idempotente) — design escolhido após E2E: o modelo re-declara o pedido
 * completo a cada turno, então SET (replace) elimina o double-count que a semântica
 * ADD (merge) causava. Retorna o resumo pro LLM ecoar ao lead. Helpers puros em
 * ../cart.ts (testados isoladamente).
 */

import type { Logger } from '../context.ts'
import { type CartItem, normalizeCart, formatCartSummary } from '../cart.ts'

export interface CartToolsCtx {
  supabase: any
  agent_id: string
  conversation: { cart_items?: unknown } & Record<string, any>
  conversation_id: string
}

async function persistCart(ctx: CartToolsCtx, items: CartItem[], log: Logger): Promise<void> {
  ;(ctx.conversation as Record<string, unknown>).cart_items = items
  const { error } = await ctx.supabase
    .from('conversations')
    .update({ cart_items: items })
    .eq('id', ctx.conversation_id)
  if (error) log.warn?.('Cart persist failed', { error: error.message })
}

export async function dispatchCartTool(
  name: string,
  args: Record<string, any>,
  ctx: CartToolsCtx,
  log: Logger,
): Promise<string | null> {
  if (name !== 'set_cart') return null

  const items = normalizeCart(Array.isArray(args?.items) ? args.items : [])
  await persistCart(ctx, items, log)
  log.info('Cart: pedido definido (set_cart)', { cart_size: items.length })

  if (items.length === 0) return 'Pedido limpo — não há mais itens.'
  return `Pedido atualizado.\n${formatCartSummary(items)}\n\nConfirme o resumo com o lead e pergunte se quer adicionar mais ou fechar o pedido.`
}
