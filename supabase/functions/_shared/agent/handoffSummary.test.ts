import { describe, expect, it } from 'vitest'
import { buildPremiumHandoffSummary } from './handoffSummary.ts'

describe('buildPremiumHandoffSummary', () => {
  it('formata cenario 21.36 porcelanato sem catalogo digital', () => {
    const summary = buildPremiumHandoffSummary({
      leadName: 'Fernando',
      tags: [
        'interesse:porcelanato_marmorizado',
        'aplicacao:piso',
        'ambiente:residencial',
        'formato:120x120',
        'acabamento:brilhante',
        'cor:bege_claro',
        'local_aplicacao:sala_e_cozinha_integradas',
        'area:90',
        'catalog_result:empty',
        'lead_score:7',
        'physical_stock_required:true',
      ],
    })

    expect(summary).toContain('Cliente: Fernando')
    expect(summary).toContain('Categoria: porcelanato marmorizado')
    expect(summary).toContain('Aplicacao: piso')
    expect(summary).toContain('Formato: 120x120')
    expect(summary).toContain('Acabamento: brilhante')
    expect(summary).toContain('Cor: bege claro')
    expect(summary).toContain('Local de aplicacao: sala e cozinha integradas')
    expect(summary).toContain('Area: 90m2')
    expect(summary).toContain('Resultado catalogo: Nenhum produto localizado no catalogo digital')
    expect(summary).toContain('Necessita: Validacao humana de estoque fisico')
  })

  it('formata cenario 21.37 torneira gourmet sem catalogo digital', () => {
    const summary = buildPremiumHandoffSummary({
      leadName: 'Carlos',
      tags: [
        'interesse:torneira_gourmet',
        'ambiente_torneira:cozinha',
        'tipo_torneira:bancada',
        'modelo_torneira:ducha_flexivel',
        'acabamento_torneira:preto_fosco',
        'tipo_cuba:dupla',
        'perfil:premium',
        'catalog_result:empty',
      ],
    })

    expect(summary).toContain('Cliente: Carlos')
    expect(summary).toContain('Categoria: torneira gourmet')
    expect(summary).toContain('Instalacao: bancada')
    expect(summary).toContain('Modelo: ducha flexivel')
    expect(summary).toContain('Acabamento: preto fosco')
    expect(summary).toContain('Tipo de cuba: dupla')
    expect(summary).toContain('Perfil: premium')
    expect(summary).toContain('Necessita: Validacao humana de estoque fisico')
  })

  it('inclui Pedido original (descritor marmorizado) e nao duplica na linha Tags', () => {
    const summary = buildPremiumHandoffSummary({
      leadName: 'Fernando',
      tags: [
        'interesse:porcelanatos_revestimentos',
        'pedido_original:porcelanato marmorizado',
        'aplicacao:piso',
        'formato:120x120',
        'area:90',
        'catalog_result:empty',
      ],
    })

    expect(summary).toContain('Pedido original: porcelanato marmorizado')
    // pedido_original NAO deve poluir a linha "Tags:" (é meta, não atributo de qualif)
    const tagsLine = summary.split('\n').find((l) => l.startsWith('Tags:')) || ''
    expect(tagsLine).not.toContain('pedido_original')
  })

  it('tags esparsas (nao-premium) → anexa Resumo da conversa (digest pergunta→resposta)', () => {
    const summary = buildPremiumHandoffSummary({
      leadName: 'Marcos',
      tags: ['interesse:fechaduras'], // só categoria, sem atributos estruturados
      messages: [
        { direction: 'outgoing', content: 'Boa tarde! Bem-vindo a Eletropiso, com quem eu falo?' },
        { direction: 'incoming', content: 'Marcos' },
        { direction: 'outgoing', content: 'É para porta interna ou externa?' },
        { direction: 'incoming', content: 'Porta de entrada, externa' },
        { direction: 'outgoing', content: 'Você prefere rolete, tetra-chave ou digital?' },
        { direction: 'incoming', content: 'Digital' },
      ],
    })

    expect(summary).toContain('Resumo da conversa:')
    expect(summary).toContain('porta interna ou externa? → Porta de entrada, externa')
    expect(summary).toContain('rolete, tetra-chave ou digital? → Digital')
    // saudação/pedido de nome NÃO viram par
    expect(summary).not.toContain('com quem eu falo')
  })

  it('tags ricas (premium, >=3 atributos) → NAO anexa digest', () => {
    const summary = buildPremiumHandoffSummary({
      leadName: 'Carlos',
      tags: ['interesse:torneiras', 'ambiente_torneira:cozinha', 'tipo_torneira:bancada', 'acabamento_torneira:preto_fosco', 'tipo_cuba:dupla'],
      messages: [
        { direction: 'outgoing', content: 'Cozinha ou área gourmet?' },
        { direction: 'incoming', content: 'Cozinha' },
      ],
    })
    expect(summary).not.toContain('Resumo da conversa:')
  })

  it('inclui fallbackReason como observacao quando nao duplicado', () => {
    const summary = buildPremiumHandoffSummary({
      tags: ['interesse:tintas', 'cor:branca'],
      fallbackReason: 'Cliente pediu urgencia no orcamento.',
    })

    expect(summary).toContain('Categoria: tintas')
    expect(summary).toContain('Cor: branca')
    expect(summary).toContain('Observacao: Cliente pediu urgencia no orcamento.')
  })
})
