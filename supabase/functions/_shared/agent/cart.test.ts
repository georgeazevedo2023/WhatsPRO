import { describe, it, expect } from 'vitest'
import {
  type CartItem,
  normalizeCart,
  mergeCartItems,
  applyCartUpdate,
  cartSubtotal,
  formatCartSummary,
  formatCartOneLine,
} from './cart.ts'

const NOW = '2026-05-25T12:00:00.000Z'
const item = (over: Partial<CartItem> = {}): CartItem => ({
  product_id: null, name: 'Tinta', qty: 1, unit_price: null, added_at: NOW, ...over,
})

describe('normalizeCart', () => {
  it('retorna [] para não-array', () => {
    expect(normalizeCart(null)).toEqual([])
    expect(normalizeCart('x' as unknown)).toEqual([])
    expect(normalizeCart(undefined)).toEqual([])
  })
  it('descarta itens sem nome e sanitiza qty/preço', () => {
    const out = normalizeCart([
      { name: '', qty: 2 },
      { name: 'Rolo', qty: 0, unit_price: -5 },
      { name: 'Fita', qty: 3, unit_price: 4.5 },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ name: 'Rolo', qty: 1, unit_price: null }) // qty<1→1, preço<0→null
    expect(out[1]).toMatchObject({ name: 'Fita', qty: 3, unit_price: 4.5 })
  })
})

describe('mergeCartItems', () => {
  it('adiciona item novo', () => {
    const out = mergeCartItems([], [{ name: 'Tinta', qty: 2, product_id: null, unit_price: 89.9 }], NOW)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'Tinta', qty: 2, unit_price: 89.9 })
  })
  it('soma qty de item com mesmo nome (case/espaço-insensível)', () => {
    const out = mergeCartItems([item({ name: 'Tinta Branca', qty: 1 })], [{ name: '  tinta   branca ', qty: 2 } as Partial<CartItem>], NOW)
    expect(out).toHaveLength(1)
    expect(out[0].qty).toBe(3)
  })
  it('casa por product_id quando ambos têm (nome diferente não duplica)', () => {
    const out = mergeCartItems(
      [item({ product_id: 'p1', name: 'Tinta X', qty: 1 })],
      [{ name: 'Tinta Y', qty: 1, product_id: 'p1', unit_price: 10 } as Partial<CartItem>],
      NOW,
    )
    expect(out).toHaveLength(1)
    expect(out[0].qty).toBe(2)
    expect(out[0].unit_price).toBe(10) // preenche preço que faltava
  })
  it('preenche product_id/preço ausentes ao mergear', () => {
    const out = mergeCartItems([item({ name: 'Rolo', qty: 1 })], [{ name: 'Rolo', qty: 1, product_id: 'r9', unit_price: 12.9 } as Partial<CartItem>], NOW)
    expect(out[0]).toMatchObject({ product_id: 'r9', unit_price: 12.9, qty: 2 })
  })
  it('é imutável (não muta o array original)', () => {
    const orig = [item({ name: 'Tinta', qty: 1 })]
    mergeCartItems(orig, [{ name: 'Tinta', qty: 5 } as Partial<CartItem>], NOW)
    expect(orig[0].qty).toBe(1)
  })
})

describe('applyCartUpdate', () => {
  const base = [item({ name: 'Tinta', qty: 2 }), item({ name: 'Manta', qty: 1 })]
  it('remove item por nome', () => {
    const out = applyCartUpdate(base, { action: 'remove', target: 'manta', qty: null })
    expect(out.map((i) => i.name)).toEqual(['Tinta'])
  })
  it('set_qty muda quantidade', () => {
    const out = applyCartUpdate(base, { action: 'set_qty', target: 'Tinta', qty: 5 })
    expect(out.find((i) => i.name === 'Tinta')?.qty).toBe(5)
  })
  it('set_qty com qty<=0 remove o item', () => {
    const out = applyCartUpdate(base, { action: 'set_qty', target: 'Tinta', qty: 0 })
    expect(out.map((i) => i.name)).toEqual(['Manta'])
  })
  it('clear esvazia tudo', () => {
    expect(applyCartUpdate(base, { action: 'clear', target: null, qty: null })).toEqual([])
  })
  it('target inexistente é no-op', () => {
    const out = applyCartUpdate(base, { action: 'remove', target: 'inexistente', qty: null })
    expect(out).toHaveLength(2)
  })
})

describe('cartSubtotal', () => {
  it('soma qty*preço e sinaliza itens sem preço', () => {
    const { total, hasUnpriced } = cartSubtotal([
      item({ name: 'Tinta', qty: 2, unit_price: 100 }),
      item({ name: 'Manta', qty: 1, unit_price: null }),
    ])
    expect(total).toBe(200)
    expect(hasUnpriced).toBe(true)
  })
})

describe('formatCartSummary', () => {
  it('vazio → string vazia', () => {
    expect(formatCartSummary([])).toBe('')
  })
  it('itemiza com total quando há preços', () => {
    const s = formatCartSummary([
      item({ name: 'Tinta Branca Fosco', qty: 2, unit_price: 89.9 }),
      item({ name: 'Rolo 23cm', qty: 1, unit_price: 12.9 }),
    ])
    expect(s).toContain('Pedido (3 itens):')
    expect(s).toContain('• 2x Tinta Branca Fosco — R$ 179,80')
    expect(s).toContain('• 1x Rolo 23cm — R$ 12,90')
    expect(s).toContain('Total estimado: R$ 192,70')
  })
  it('marca "+ itens a confirmar" quando algum sem preço', () => {
    const s = formatCartSummary([
      item({ name: 'Tinta', qty: 1, unit_price: 50 }),
      item({ name: 'Lâmpada', qty: 2, unit_price: null }),
    ])
    expect(s).toContain('(+ itens a confirmar)')
  })
})

describe('formatCartOneLine', () => {
  it('compacta sem preço, separado por vírgula', () => {
    const s = formatCartOneLine([
      item({ name: 'Tinta Branca', qty: 2 }),
      item({ name: 'Rolo', qty: 1 }),
    ])
    expect(s).toBe('2x Tinta Branca, 1x Rolo')
  })
  it('trunca quando passa do limite', () => {
    const s = formatCartOneLine([item({ name: 'X'.repeat(200), qty: 1 })], 20)
    expect(s.length).toBeLessThanOrEqual(20)
    expect(s.endsWith('…')).toBe(true)
  })
})
