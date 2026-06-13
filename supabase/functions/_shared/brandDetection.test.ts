import { describe, it, expect } from 'vitest'
import { detectBrand } from './brandDetection.ts'

describe('brandDetection', () => {
  it('detectBrand — match exato simples', () => {
    expect(detectBrand('quero tinta Coral branca')).toEqual('coral')
    expect(detectBrand('tem da Suvinil?')).toEqual('suvinil')
    expect(detectBrand('Tigre tem em estoque?')).toEqual('tigre')
    expect(detectBrand('manta da quartzolit')).toEqual('quartzolit')
  })

  it('detectBrand — case-insensitive', () => {
    expect(detectBrand('CORAL')).toEqual('coral')
    expect(detectBrand('cORaL')).toEqual('coral')
  })

  it('detectBrand — accent insensitive', () => {
    expect(detectBrand('aliança ferro')).toEqual('alianca')
    expect(detectBrand('Aliança Ferro')).toEqual('alianca')
  })

  it('detectBrand — multi-word brands', () => {
    expect(detectBrand('quero da Sherwin Williams')).toEqual('sherwin_williams')
    expect(detectBrand('La Fonte fechadura')).toEqual('la_fonte')
    expect(detectBrand('otto baumgart impermeabilizante')).toEqual('otto_baumgart')
  })

  it('detectBrand — não casa substring de outra palavra', () => {
    // "coralina" não deve virar "coral"
    expect(detectBrand('quero tinta coralina')).toEqual(null)
    // "tigrebr" não deve casar tigre
    expect(detectBrand('marca tigrebr')).toEqual(null)
  })

  it('detectBrand — null em texto sem marca', () => {
    expect(detectBrand('oi tudo bem')).toEqual(null)
    expect(detectBrand('tem tinta acrílica branca?')).toEqual(null)
    expect(detectBrand('')).toEqual(null)
  })

  it('detectBrand — lista customizada via segundo parâmetro', () => {
    const customBrands = ['Acme Tintas', 'Globex']
    expect(detectBrand('quero da acme tintas', customBrands)).toEqual('acme_tintas')
    expect(detectBrand('Globex disponível?', customBrands)).toEqual('globex')
    // Coral não está na lista custom
    expect(detectBrand('coral', customBrands)).toEqual(null)
  })

  it('detectBrand — primeira marca encontrada vence', () => {
    // Texto com 2 marcas — retorna a primeira na ordem da lista
    // Coral aparece antes de Suvinil em DEFAULT_BRANDS
    expect(detectBrand('comparando Suvinil com Coral')).toEqual('coral')
  })
})
