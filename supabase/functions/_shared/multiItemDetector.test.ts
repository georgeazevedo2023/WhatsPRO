import { describe, it, expect } from 'vitest'
import { detectMultiItem } from './multiItemDetector.ts'

const mockConfig = {
  categories: [
    { id: 'tintas', label: 'Tintas', interesse_match: 'tinta|esmalte|verniz', fields: [] },
    { id: 'pias', label: 'Pias', interesse_match: 'pia|cuba', fields: [] },
    { id: 'portas', label: 'Portas', interesse_match: 'porta', fields: [] },
  ],
  default: 'tintas',
}

describe('detectMultiItem (R136)', () => {
  // 1. Repro Paloma exato
  it('repro Paloma: numbered_list 3 itens com mixed (tintas + 2 orphans)', () => {
    const result = detectMultiItem({
      text: '1 massa PVA\n1 Latão de tinta branco neve\n15 lixas d` água N° 150',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items).toHaveLength(3)
    expect(result.mixed).toBe(true)
    expect(result.orphanCount).toBe(2)
    expect(result.reason).toBe('numbered_list')
    // O item 2 deve matchar tintas
    const matched = result.items.find(it => it.matchedCategoryId !== null)
    expect(matched?.matchedCategoryId).toBe('tintas')
    // E os outros 2 ficam órfãos
    const orphans = result.items.filter(it => it.matchedCategoryId === null)
    expect(orphans).toHaveLength(2)
  })

  // 2. Lista com 1 item só
  it('não detecta com 1 item só', () => {
    const result = detectMultiItem({
      text: '1 lata de tinta',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(false)
    expect(result.items).toHaveLength(0)
  })

  // 3. Saudação
  it('não detecta saudação simples', () => {
    const result = detectMultiItem({
      text: 'Boa tarde',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(false)
  })

  // 4. Frase normal sem multi-item
  it('não detecta frase comum com 1 produto', () => {
    const result = detectMultiItem({
      text: 'Quero tinta acrílica branca',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(false)
  })

  // 5. Numbered list todos matched (sem orphans)
  it('3 tintas matched, mixed=false, orphanCount=0', () => {
    const result = detectMultiItem({
      text: '1 tinta acrílica\n1 verniz\n1 esmalte',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items).toHaveLength(3)
    expect(result.mixed).toBe(false)
    expect(result.orphanCount).toBe(0)
    expect(result.items.every(it => it.matchedCategoryId === 'tintas')).toBe(true)
  })

  // 6. 2 itens, ambos matched em categorias diferentes
  it('2 itens em categorias diferentes, mixed=false', () => {
    const result = detectMultiItem({
      text: '1 cuba inox\n1 porta alumínio',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items).toHaveLength(2)
    expect(result.mixed).toBe(false)
    expect(result.orphanCount).toBe(0)
    const ids = result.items.map(it => it.matchedCategoryId).sort()
    expect(ids).toEqual(['pias', 'portas'])
  })

  // 7. 3 itens, 1 matched + 2 orphans
  it('1 cuba + 2 orphans = mixed', () => {
    const result = detectMultiItem({
      text: '1 cuba\n1 produto X qualquer\n1 item Y diferente',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items).toHaveLength(3)
    expect(result.mixed).toBe(true)
    expect(result.orphanCount).toBe(2)
  })

  // 8. comma_separated
  it('comma_separated com 4 itens', () => {
    const result = detectMultiItem({
      text: 'tinta, verniz, esmalte, lixa',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items).toHaveLength(4)
    expect(result.reason).toBe('comma_separated')
    // 3 matched (tintas) + 1 orphan (lixa)
    expect(result.orphanCount).toBe(1)
  })

  // 9. Quantidade extraída
  it('extrai quantidade de prefixo numérico', () => {
    const result = detectMultiItem({
      text: '5 latões de tinta\n3 vernizes',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    const qtys = result.items.map(it => it.quantity)
    expect(qtys).toContain(5)
    expect(qtys).toContain(3)
  })

  // 10. Sem quantidade quando item não tem prefixo numérico
  it('quantity null em comma_separated', () => {
    const result = detectMultiItem({
      text: 'tinta branca, verniz brilhante, esmalte fosco, lixa fina',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.reason).toBe('comma_separated')
    expect(result.items.every(it => it.quantity === null)).toBe(true)
  })

  // 11. Case-insensitive
  it('match case-insensitive', () => {
    const result = detectMultiItem({
      text: '1 TINTA branca\n1 VERNIZ acabamento',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items.every(it => it.matchedCategoryId === 'tintas')).toBe(true)
  })

  // 12. Accent-insensitive
  it('match sem acento', () => {
    const result = detectMultiItem({
      text: '1 porta de aluminio\n1 cuba grande',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items[0].matchedCategoryId).toBe('portas')
    expect(result.items[1].matchedCategoryId).toBe('pias')
  })

  // 13. Vazio/null/undefined
  it('vazio/null/undefined → detected=false', () => {
    expect(detectMultiItem({ text: '', categoriesConfig: mockConfig }).detected).toBe(false)
    expect(detectMultiItem({ text: '   ', categoriesConfig: mockConfig }).detected).toBe(false)
    // @ts-expect-error testar comportamento defensivo
    expect(detectMultiItem({ text: null, categoriesConfig: mockConfig }).detected).toBe(false)
    // @ts-expect-error testar comportamento defensivo
    expect(detectMultiItem({ text: undefined, categoriesConfig: mockConfig }).detected).toBe(false)
    expect(
      detectMultiItem({ text: '', categoriesConfig: mockConfig }).items,
    ).toEqual([])
  })

  // 14. Categoria id preservada exatamente como veio no config
  it('matchedCategoryId preserva case do config', () => {
    const customConfig = {
      categories: [
        { id: 'Tintas_VIP', label: 'Tintas VIP', interesse_match: 'tinta', fields: [] },
      ],
      default: 'Tintas_VIP',
    }
    const result = detectMultiItem({
      text: '1 tinta branca\n1 tinta cinza',
      categoriesConfig: customConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items[0].matchedCategoryId).toBe('Tintas_VIP')
    expect(result.items[1].matchedCategoryId).toBe('Tintas_VIP')
  })

  // Extra: newline_separated (3+ linhas sem prefixo numérico, sem saudação)
  it('newline_separated quando sem prefixo numérico', () => {
    const result = detectMultiItem({
      text: 'tinta acrílica branca\nverniz para madeira\nlixa fina 150',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.reason).toBe('newline_separated')
    expect(result.items).toHaveLength(3)
  })

  // Extra: productHint usa label quando matched, senão raw sem qtd
  it('productHint usa label da categoria quando matched', () => {
    const result = detectMultiItem({
      text: '1 tinta branca\n1 chave de fenda',
      categoriesConfig: mockConfig,
    })
    expect(result.detected).toBe(true)
    expect(result.items[0].productHint).toBe('Tintas')
    expect(result.items[1].productHint).toBe('chave de fenda')
  })
})
