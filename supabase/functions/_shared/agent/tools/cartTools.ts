/**
 * Premium #2 Cart Engine (2026-05-25) — dispatch das tools add_to_cart / update_cart.
 *
 * Estado do pedido vive em conversations.cart_items (JSONB), mesmo padrão runtime
 * do shown_product_ids (lê do objeto conversation em memória, escreve no DB e
 * sincroniza de volta). Retorna string de confirmação com o resumo do pedido pro
 * LLM ecoar ao lead. Helpers puros em ../cart.ts (testados isoladamente).
 */

import type { Logger } from '../context.ts'
import {
  type CartItem,
  type CartUpdate,
  normalizeCart,
  mergeCartItems,
  applyCartUpdate,
  formatCartSummary,
} from '../cart.ts'

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
  const current = normalizeCart((ctx.conversation as Record<string, unknown>).cart_items)

  if (name === 'add_to_cart') {
    const incoming = Array.isArray(args?.items) ? args.items : []
    if (incoming.length === 0) return 'Nenhum item informado para adicionar ao pedido.'
    const merged = mergeCartItems(current, incoming)
    await persistCart(ctx, merged, log)
    log.info('Cart: itens adicionados', { added: incoming.length, cart_size: merged.length })
    return `Item(ns) adicionado(s) ao pedido.\n${formatCartSummary(merged)}\n\nConfirme o resumo com o lead e pergunte se quer adicionar mais ou fechar o pedido.`
  }

  if (name === 'update_cart') {
    const update: CartUpdate = {
      action: args?.action,
      target: args?.target ?? null,
      qty: typeof args?.qty === 'number' ? args.qty : null,
    }
    const next = applyCartUpdate(current, update)
    await persistCart(ctx, next, log)
    log.info('Cart: pedido editado', { action: update.action, cart_size: next.length })
    if (next.length === 0) return 'Pedido limpo — não há mais itens.'
    return `Pedido atualizado.\n${formatCartSummary(next)}`
  }

  return null
}
