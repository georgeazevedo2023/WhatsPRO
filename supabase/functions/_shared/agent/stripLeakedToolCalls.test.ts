import { describe, it, expect } from 'vitest'
import { stripLeakedToolCalls } from './dispatchResponse.ts'

const TOOL_NAMES = [
  'handoff_to_human', 'search_products', 'set_tags', 'send_carousel', 'send_media',
  'send_poll', 'update_lead_profile', 'assign_label', 'move_kanban', 'set_cart',
]

/** Garante que NENHUM resíduo de tool-call sobrou no texto limpo. */
function assertNoLeak(out: string) {
  for (const n of TOOL_NAMES) {
    expect(out.toLowerCase()).not.toContain(n)
  }
  expect(out).not.toContain('[[')
  expect(out).not.toMatch(/functions\./i)
  expect(out).not.toMatch(/reason\s*[:=]/i)
}

describe('stripLeakedToolCalls', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Casos REAIS de PROD (EletropisoV2, 2026-05-25 a 2026-05-31).
  // Taxonomia forense: 10 msgs `outgoing` vazaram em 30d; a regex ANTIGA pegava 0/10.
  // Cada teste abaixo é o conteúdo verbatim de uma conversation_messages.id real.
  // ───────────────────────────────────────────────────────────────────────────
  describe('formas reais observadas em produção (a regex antiga pegava 0/10)', () => {
    it('bare-name numa linha — 4 ocorrências (ex: id 18837bbd)', () => {
      const leaked =
        'Perfeito! Vou passar seu pedido completo para um vendedor, que vai conferir os valores mais econômicos e entrar em contato com você para finalizar o orçamento.\nhandoff_to_human'
      const out = stripLeakedToolCalls(leaked)
      expect(out).toBe(
        'Perfeito! Vou passar seu pedido completo para um vendedor, que vai conferir os valores mais econômicos e entrar em contato com você para finalizar o orçamento.',
      )
      assertNoLeak(out)
    })

    it('parens com valor SEM aspas — 3 ocorrências (ex: id 6289b44b)', () => {
      const leaked =
        'Perfeito, já vou passar seu atendimento para um vendedor especializado que irá te ajudar a encontrar a cuba de embutir na medida que você procura!\nhandoff_to_human(reason: Lead busca pia/cuba de embutir, especificando interesse por uma cuba de embutir com medidas específicas. Não tem interesse em cuba de apoio. Ainda não informou nome nem cidade.)'
      const out = stripLeakedToolCalls(leaked)
      expect(out).toBe(
        'Perfeito, já vou passar seu atendimento para um vendedor especializado que irá te ajudar a encontrar a cuba de embutir na medida que você procura!',
      )
      assertNoLeak(out)
      expect(out).not.toContain('cuba de apoio')
    })

    it('wikilink-pipe TRUNCADO (sem ]] de fechamento) — cenário 21.33 (id 7845737e)', () => {
      const leaked =
        'Ótimo, Fernando! Já vou te passar para um de nossos consultores, que vai finalizar seu pedido da Coral premium com rolo e bandeja, para entrega em Boa Viagem.\n[[handoff_to_human|reason=Lead: Fernando. Interesse: tinta acrílica branca premium (Coral premium), objetivo: reforma em ambiente interno, aplicação: parede, itens complementares: rolo e bandeja, modo de entrega: delivery para Boa Viagem, in'
      const out = stripLeakedToolCalls(leaked)
      expect(out).toBe(
        'Ótimo, Fernando! Já vou te passar para um de nossos consultores, que vai finalizar seu pedido da Coral premium com rolo e bandeja, para entrega em Boa Viagem.',
      )
      assertNoLeak(out)
    })

    it('newline-json (name + bloco JSON em linhas seguintes) — id 16b2efbe', () => {
      const leaked =
        'Ótimo, vou encaminhar sua solicitação para um de nossos vendedores especializados, que vai te passar todas as informações e opções de caixa de energia completa!\nhandoff_to_human\n{\n "reason": "Lead interessado em caixa de energia completa, ainda sem especificação de marca ou modelo. Nome: Fabiana. Encaminhar orçamento e opções disponíveis."\n}'
      const out = stripLeakedToolCalls(leaked)
      expect(out).toContain('opções de caixa de energia completa!')
      assertNoLeak(out)
      expect(out).not.toContain('{')
    })

    it('space-kv (set_tags com args por espaço, chave acentuada) — id 0a3b0376', () => {
      const leaked =
        'Perfeito, Fernando! Você prefere o porcelanato marmorizado com acabamento mais brilhante, acetinado ou fosco? set_tags nome:Fernando ambiente:interno aplicação:piso'
      const out = stripLeakedToolCalls(leaked)
      expect(out).toBe(
        'Perfeito, Fernando! Você prefere o porcelanato marmorizado com acabamento mais brilhante, acetinado ou fosco?',
      )
      assertNoLeak(out)
      expect(out).not.toContain('aplicação:piso')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Variantes de wrapper e payload
  // ───────────────────────────────────────────────────────────────────────────
  describe('variantes de wrapper e payload', () => {
    it('wikilink completo [[name]]', () => {
      expect(stripLeakedToolCalls('Perfeito!\n[[handoff_to_human]]')).toBe('Perfeito!')
    })
    it('wikilink com pipe e reason FECHADO', () => {
      expect(
        stripLeakedToolCalls('Perfeito!\n[[handoff_to_human|reason=Lead quer tinta Coral, entrega Boa Viagem]]'),
      ).toBe('Perfeito!')
    })
    it('single bracket [name]', () => {
      expect(stripLeakedToolCalls('Pronto! [handoff_to_human]')).toBe('Pronto!')
    })
    it('markdown bold **name**', () => {
      expect(stripLeakedToolCalls('Pronto! **handoff_to_human**')).toBe('Pronto!')
    })
    it('backtick `name`', () => {
      expect(stripLeakedToolCalls('Pronto! `handoff_to_human`')).toBe('Pronto!')
    })
    it('functions.NAME({...}) — caso histórico (R147)', () => {
      const out = stripLeakedToolCalls(
        'Já estou passando seu pedido pro vendedor, Carlos!\nfunctions.handoff_to_human({reason: "Lead quer tinta Coral fosca 16L, ambiente interno"})',
      )
      expect(out).toContain('Já estou passando seu pedido pro vendedor, Carlos!')
      assertNoLeak(out)
    })
    it('functions.NAME bare (sem parênteses) — caso E2E 2026-05-24', () => {
      const out = stripLeakedToolCalls(
        'Perfeito, Carlos! Já vou te passar para um de nossos vendedores finalizar seu pedido da tinta Fosco e da manta.\nfunctions.handoff_to_human',
      )
      expect(out).toContain('finalizar seu pedido da tinta Fosco e da manta.')
      assertNoLeak(out)
    })
    it('parens com objeto JSON inline', () => {
      expect(stripLeakedToolCalls('Ok! handoff_to_human({reason: "Lead X"})')).toBe('Ok!')
    })
    it('parens vazio', () => {
      expect(stripLeakedToolCalls('Já te encaminho!\nhandoff_to_human()')).toBe('Já te encaminho!')
    })
    it('parens multilinha (objeto quebrado em várias linhas)', () => {
      const out = stripLeakedToolCalls(
        'Pronto, já encaminhei!\nhandoff_to_human(\n  reason: "Lead quer caixa d\'água 1000L, entrega no Centro"\n)',
      )
      expect(out).toBe('Pronto, já encaminhei!')
    })
    it('wikilink no MEIO do texto', () => {
      expect(
        stripLeakedToolCalls('Vou te conectar [[handoff_to_human|reason=Lead X]] com o vendedor agora.'),
      ).toBe('Vou te conectar com o vendedor agora.')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Case-insensitive (flag i) — o LLM pode emitir o nome em maiúsculas/misto
  // ───────────────────────────────────────────────────────────────────────────
  describe('case-insensitive', () => {
    it('NAME em MAIÚSCULAS com parens', () => {
      expect(stripLeakedToolCalls('Pronto!\nHANDOFF_TO_HUMAN({reason: "Lead X"})')).toBe('Pronto!')
    })
    it('Functions.Handoff_To_Human (case misto)', () => {
      expect(stripLeakedToolCalls('Já passo pro vendedor.\nFunctions.Handoff_To_Human')).toBe('Já passo pro vendedor.')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Outras tools (não só handoff)
  // ───────────────────────────────────────────────────────────────────────────
  describe('outras tools', () => {
    it('search_products({...}) sem prefixo functions.', () => {
      expect(
        stripLeakedToolCalls('Vou buscar pra você! search_products({query: "tinta", category: "tintas"})'),
      ).toBe('Vou buscar pra você!')
    })
    it('send_carousel(product_ids: [...]) parens sem aspas', () => {
      expect(stripLeakedToolCalls('Confira! send_carousel(product_ids: ["a","b"])')).toBe('Confira!')
    })
    it('set_cart (nome novo na lista — antes nem constava em LEAKED_TOOL_NAMES)', () => {
      expect(stripLeakedToolCalls('Anotado! set_cart({items: [{name: "tinta", qty: 1}]})')).toBe('Anotado!')
    })
    it('update_lead_profile bare', () => {
      expect(stripLeakedToolCalls('Registrei!\nupdate_lead_profile')).toBe('Registrei!')
    })
    it('múltiplos vazamentos na mesma msg', () => {
      const out = stripLeakedToolCalls(
        'Ok! set_tags({tags:["cor:branco"]}) send_carousel({product_ids:["a"]}) pronto',
      )
      assertNoLeak(out)
      expect(out).toContain('Ok!')
      expect(out).toContain('pronto')
    })
    it('vazamento no MEIO seguido de texto legítimo', () => {
      const out = stripLeakedToolCalls('Vou registrar set_tags(cor:branco) e já te mostro as opções.')
      expect(out).toContain('Vou registrar')
      expect(out).toContain('e já te mostro as opções.')
      assertNoLeak(out)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Corpus adversarial de VAZAMENTO (gerado por agente do workflow).
  // Cada caso: o vazamento some + o trecho legítimo sobrevive.
  // ───────────────────────────────────────────────────────────────────────────
  describe('corpus adversarial — vazamentos somem, prosa sobrevive', () => {
    const cases: Array<{ label: string; input: string; mustContain?: string; mustEqualEmpty?: boolean }> = [
      { label: 'bare name + search_products', input: 'Deixa eu ver o que temos.\nsearch_products', mustContain: 'Deixa eu ver o que temos.' },
      { label: 'wikilink truncado com um único ] no fim', input: "Já vou te conectar com nosso vendedor.\n[[handoff_to_human|reason=Lead busca caixa d'água 1000L]", mustContain: 'Já vou te conectar com nosso vendedor.' },
      { label: 'wikilink pipe args set_tags fechado', input: 'Já registrei suas preferências.\n[[set_tags|tags=cor:branco,ambiente:interno]]', mustContain: 'Já registrei suas preferências.' },
      { label: 'JSON multilinha set_cart grande', input: 'Anotei seu pedido completo!\nset_cart\n{\n  "items": [\n    {"name": "porcelanato bege 60x60", "qty": 10},\n    {"name": "argamassa AC3", "qty": 5}\n  ],\n  "notes": "entrega Jaboatão"\n}', mustContain: 'Anotei seu pedido completo!' },
      { label: 'functions.prefix com parens multilinha', input: 'Já passo pro time comercial.\nfunctions.handoff_to_human(\n  { "reason": "Lead: João, interesse em piso vinílico" }\n)', mustContain: 'Já passo pro time comercial.' },
      { label: 'send_media com objeto', input: 'Olha a foto do produto.\nsend_media({"product_id": "abc123", "caption": "Cuba inox"})', mustContain: 'Olha a foto do produto.' },
      { label: 'send_poll com opções', input: 'Qual prazo prefere?\nsend_poll({question: "Prazo?", options: ["7 dias", "15 dias"]})', mustContain: 'Qual prazo prefere?' },
      { label: 'assign_label parens', input: 'Classifiquei seu atendimento.\nassign_label(label: "orçamento")', mustContain: 'Classifiquei seu atendimento.' },
      { label: 'move_kanban parens', input: 'Já movi sua negociação.\nmove_kanban(stage: "proposta")', mustContain: 'Já movi sua negociação.' },
      { label: 'dois vazamentos espaçados com texto entre eles', input: 'Já registrei set_tags({tags:["cor:azul"]}) e vou te conectar com o vendedor handoff_to_human({reason: "tinta azul"})', mustContain: 'e vou te conectar com o vendedor' },
      { label: 'set_tags space-args com vários acentos e maiúsculas', input: 'Anotei suas preferências, vamos lá!\nset_tags Nome:João Aplicação:Piso Ambiente:Área-externa', mustContain: 'Anotei suas preferências, vamos lá!' },
      { label: 'wikilink simples colado inline', input: 'Pronto! [[handoff_to_human]] Já vou te conectar.', mustContain: 'Já vou te conectar.' },
      { label: 'confirmação multilinha + vazamento no fim', input: 'Perfeito, Fernando!\nJá anotei seu pedido de tinta Coral.\nVou te passar pro nosso vendedor agora.\nhandoff_to_human({reason: "tinta Coral, Boa Viagem"})', mustContain: 'Vou te passar pro nosso vendedor agora.' },
      { label: 'vazamento colado sem newline após ponto', input: 'Vou te passar pro vendedor. handoff_to_human({reason: "tinta"})', mustContain: 'Vou te passar pro vendedor.' },
      { label: 'SÓ o vazamento — bare', input: 'handoff_to_human', mustEqualEmpty: true },
      { label: 'SÓ o vazamento — wikilink', input: '[[handoff_to_human|reason=Lead quer vendedor]]', mustEqualEmpty: true },
      { label: 'SÓ o vazamento — parens objeto', input: 'handoff_to_human({reason: "Lead X"})', mustEqualEmpty: true },
    ]
    for (const c of cases) {
      it(c.label, () => {
        const out = stripLeakedToolCalls(c.input)
        if (c.mustEqualEmpty) {
          expect(out.trim()).toBe('')
        } else {
          assertNoLeak(out)
          if (c.mustContain) expect(out).toContain(c.mustContain)
        }
      })
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Corpus de TEXTO LEGÍTIMO (52 msgs, gerado por agente adversarial do workflow).
  // NUNCA pode ser alterado — devolvido byte-a-byte (guarda `stripped === text`).
  // Nomes de tool são snake_case inglês → não existem em pt-BR voltado ao lead.
  // ───────────────────────────────────────────────────────────────────────────
  describe('texto legítimo permanece byte-a-byte intacto', () => {
    const legit = [
      'Bom dia! Tudo bem? Como posso te ajudar hoje na Eletropiso? 😊',
      'Temos tinta acrílica (uso interno) e esmalte sintético (uso externo). Qual você procura?',
      'O porcelanato 60x60 acetinado sai por R$ 129,90 o metro quadrado. Quer que eu separe?',
      'Essa tinta rende cerca de 80m² por galão de 3,6L em duas demãos.',
      'Temos a lata de 18L (cor branco neve) e a de 3,6L (cores especiais sob encomenda).',
      'Horário: seg a sex | 8h às 18h | sábado: 8h às 12h. Domingo não abrimos.',
      'Pode mandar a foto do ambiente? Assim eu te indico a quantidade certa de piso. 📸',
      'Posso te passar pra um atendente humano agora, ou prefere que eu mesmo resolva por aqui?',
      'Vou te transferir pra um especialista humano do nosso time, só um instante. 🙋',
      'Trabalhamos com as marcas: Suvinil, Coral, Sherwin-Williams e Eucatex.',
      'Pra calcular o frete preciso do seu CEP. Pode me enviar, por favor?',
      'Segue nosso catálogo completo: https://eletropiso.com.br/catalogo (atualizado hoje).',
      'Qualquer dúvida é só chamar aqui ou no e-mail contato@eletropiso.com.br 👍',
      'O rejunte vem em embalagens de 1kg, 5kg e 20kg. Qual metragem você vai assentar?',
      'Itens do seu pedido:\n1. Porcelanato 60x60 — 12 caixas\n2. Argamassa AC-III — 8 sacos\n3. Rejunte cinza — 4 unidades',
      'A cuba de apoio (modelo redondo) está com 15% de desconto essa semana! 🔥',
      'Você prefere acabamento fosco ou acetinado? Os dois têm o mesmo preço.',
      'O piso vinílico vem em réguas de 18x122cm, ideal pra quartos e salas.',
      'Temos pronta-entrega: piso, tinta, argamassa, rejunte e ferramentas. O que você precisa?',
      'A garantia do fabricante é de 5 anos contra defeitos de fabricação.',
      'Pra fechar o pedido eu preciso confirmar: nome completo, endereço e forma de pagamento.',
      'Aceitamos PIX, cartão (até 10x) e boleto. Qual fica melhor pra você?',
      'O metro quadrado do laminado eucafloor sai R$ 49,90 (caixa com 2,02m²).',
      'Bom dia, Maria! Que bom te ver de novo por aqui. Em que posso ajudar? 😄',
      'Esse modelo está em falta no momento, mas chega lote novo na terça-feira.',
      'Olha as opções que separei pra você:\n• Cinza concreto\n• Bege areia\n• Branco polar',
      'A tinta epóxi pra piso é própria pra garagem e área de tráfego pesado.',
      'Pra área externa eu recomendo o porcelanato antiderrapante (classe R11).',
      'Temos sim! São 3 cores disponíveis: branco, palha e cimento queimado.',
      'O assentamento de 60x60 pede argamassa AC-III; pra 90x90 recomendo a AC-III flex.',
      'Posso registrar seu interesse e te avisar assim que o produto chegar?',
      'A média de consumo é 1 saco de argamassa (20kg) a cada 4 a 5m².',
      'Show! Anotei aqui. Mais alguma coisa que você queira incluir no orçamento?',
      'Temos enquete rápida pra você: prefere receber novidades por WhatsApp ou e-mail?',
      "Coloquei a etiqueta de 'cliente preferencial' no seu cadastro. 🏷️ Obrigado pela parceria!",
      'O carrinho de obra reforçado (90L) está R$ 289,00 à vista.',
      'Esse produto é mídia expositora? Não, é a prateleira de aço galvanizado mesmo.',
      'A persiana rolô (1,20m x 1,60m) sai R$ 219,00 instalada.',
      'Você mencionou área de 25m². Pra essa metragem vão 7 caixas de porcelanato.',
      'Pra te enviar a localização da loja: Av. Brasil, 1234 — Centro. 📍',
      'Fechou! Seu pedido ficou em R$ 1.847,50 com o desconto à vista incluso.',
      'O esmalte secagem rápida fica seco ao toque em ~30 min (cura total em 24h).',
      'Temos disjuntor de 20A, 25A, 32A e 40A. Qual a amperagem do seu circuito?',
      'Pra piso aquecido a gente usa a manta específica + termostato. Quer que eu detalhe?',
      'Reservei 2 latas de 18L (branco neve) no seu nome até amanhã às 18h. Combinado? ✅',
      'Posso mover seu atendimento pra nossa equipe de projetos? Eles fazem o cálculo completo da obra.',
      'A diferença: o porcelanato é mais resistente; o cerâmico é mais barato. Pro seu caso, indico o porcelanato.',
      'Atenção: o valor pode mudar conforme a quantidade. Acima de 50m² tem preço especial. 💰',
      'Faltou só confirmar a cor. Você quer cinza-claro ou cinza-grafite?',
      'Pra dúvidas técnicas de instalação, deixo nosso vídeo: https://youtu.be/abc123 — vale assistir!',
      'Perfeito, George! Anotei seu pedido: 1 lâmpada LED amarela 12W. Vou chamar o vendedor pra finalizar. 🙌',
      'Esse acabamento (madeirado) imita réguas de madeira, fica lindo em quarto. Quer ver as cores?',
      'Não se preocupe, o atendimento continua por aqui mesmo, sem transferências.',
    ]
    for (const msg of legit) {
      it(`não altera: "${msg.slice(0, 36).replace(/\n/g, ' ')}…"`, () => {
        expect(stripLeakedToolCalls(msg)).toBe(msg)
      })
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Payload aninhado/truncado (balanced 1 nível) — achados pelo under-strip hunter.
  // ───────────────────────────────────────────────────────────────────────────
  describe('payload com parênteses/JSON aninhado e truncado', () => {
    it('parens com parênteses internos no reason', () => {
      expect(
        stripLeakedToolCalls('Vou aplicar a etiqueta: assign_label(label: "interesse (alto - urgente) cliente")'),
      ).toBe('Vou aplicar a etiqueta:')
    })
    it('JSON aninhado dentro de parens', () => {
      expect(
        stripLeakedToolCalls('Atualizando seu perfil. update_lead_profile({"interesse": {"categoria": "piso", "detalhe": "60x60"}})'),
      ).toBe('Atualizando seu perfil.')
    })
    it('array de objetos dentro de parens (set_cart)', () => {
      expect(
        stripLeakedToolCalls('Já registrei. SET_CART(items=[{nome:"piso",qtd:10}])'),
      ).toBe('Já registrei.')
    })
    it('parens TRUNCADO (stream cortou sem fechar)', () => {
      const out = stripLeakedToolCalls('Pronto, já encaminhei! handoff_to_human(reason: Lead quer tinta Coral (premium) e entrega')
      expect(out).toBe('Pronto, já encaminhei!')
    })
    it('JSON aninhado em bloco (newline) — set_cart', () => {
      const out = stripLeakedToolCalls('Anotei!\nset_cart\n{\n "items": [{"name":"piso","qtd":10}],\n "meta": {"entrega":"casa"}\n}')
      expect(out).toBe('Anotei!')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Anti over-strip: URL / e-mail / identificador que CONTÉM um nome de tool como
  // segmento NÃO pode ser tocado (achados pelo over-strip hunter da verificação
  // adversarial). O nome pelado só é removido fora de contexto de URL/e-mail/SKU.
  // ───────────────────────────────────────────────────────────────────────────
  describe('não corrompe URL/e-mail/identificador com nome de tool embutido', () => {
    const mustNotTouch = [
      'Veja todos os modelos aqui: https://eletropiso.com.br/search_products?q=cuba+granito',
      'Pra acompanhar o pedido entra em https://crm.wsmart.com.br/move_kanban/123 e olha o status.',
      'Qualquer dúvida manda no e-mail do nosso setor: send_media@eletropiso.com.br',
      'O código do produto no sistema é set_cart-2025, esse é o SKU que você vê na nota.',
      'Catálogo: eletropiso.com.br/loja/send_carousel.html (página de ofertas).',
      'Documentação da API: GET functions.list para listar os pisos disponíveis.',
    ]
    for (const msg of mustNotTouch) {
      it(`não altera: "${msg.slice(0, 40)}…"`, () => {
        expect(stripLeakedToolCalls(msg)).toBe(msg)
      })
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Bordas
  // ───────────────────────────────────────────────────────────────────────────
  describe('bordas', () => {
    it('string vazia', () => {
      expect(stripLeakedToolCalls('')).toBe('')
    })
    it('undefined-safe', () => {
      expect(stripLeakedToolCalls(undefined as unknown as string)).toBe(undefined as unknown as string)
    })
    it('mensagem que é SÓ o vazamento → vazia (dispatchResponse injeta confirmação segura)', () => {
      expect(stripLeakedToolCalls('handoff_to_human').trim()).toBe('')
    })
  })
})
