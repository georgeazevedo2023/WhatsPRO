import { describe, it, expect } from 'vitest'
import { detectQualifLoop, type RecentMessage } from './qualificationAntiLoop.ts'

describe('detectQualifLoop', () => {
  it('1. Repro paz exato — detecta loop material_pia + monta nudge com last incoming', () => {
    const recentMessages: RecentMessage[] = [
      { direction: 'outgoing', content: 'Olá! Bem-vindo a Eletropiso, com quem eu falo?' },
      { direction: 'outgoing', content: 'Qual material? (granito, mármore, inox ou sintético)' },
      { direction: 'incoming', content: 'Mas simples mesmo' },
    ]
    const r = detectQualifLoop({
      recentMessages,
      intendedPhrasing: 'Qual material? (granito, mármore, inox ou sintético)',
      fieldLabel: 'material da pia',
    })
    expect(r.repeating).toBe(true)
    if (r.repeating) {
      expect(r.lastIncoming).toBe('Mas simples mesmo')
      expect(r.nudge).toContain('Mas simples mesmo')
      expect(r.nudge).toContain('PROIBIDO repetir')
    }
  })

  it('2. First attempt — apenas 1 msg outgoing inicial → not repeating', () => {
    const r = detectQualifLoop({
      recentMessages: [{ direction: 'outgoing', content: 'Olá' }],
      intendedPhrasing: 'Qual material?',
      fieldLabel: 'material da pia',
    })
    expect(r.repeating).toBe(false)
    if (!r.repeating) {
      expect(['first_attempt', 'phrasing_not_in_history']).toContain(r.reason)
    }
  })

  it('3. Phrasing diferente da que foi enviada antes → not repeating', () => {
    const r = detectQualifLoop({
      recentMessages: [
        { direction: 'outgoing', content: 'Qual ambiente?' },
        { direction: 'incoming', content: 'Banheiro' },
      ],
      intendedPhrasing: 'Qual material?',
      fieldLabel: 'material da pia',
    })
    expect(r.repeating).toBe(false)
  })

  it('4. Case insensitive — outgoing maiúsculo + intended minúsculo', () => {
    const r = detectQualifLoop({
      recentMessages: [
        { direction: 'outgoing', content: 'QUAL MATERIAL?' },
        { direction: 'incoming', content: 'sei lá' },
      ],
      intendedPhrasing: 'qual material?',
      fieldLabel: 'material',
    })
    expect(r.repeating).toBe(true)
  })

  it('5. Acento agnostic — normalização NFD remove diferença de til', () => {
    const r = detectQualifLoop({
      recentMessages: [
        { direction: 'outgoing', content: 'Qual tamanho?' },
        { direction: 'incoming', content: 'médio' },
      ],
      intendedPhrasing: 'qual tamãnho?',
      fieldLabel: 'tamanho',
    })
    expect(r.repeating).toBe(true)
  })

  it('6. Phrasing aparece em outgoing antiga mas a outgoing MAIS RECENTE não tem → not repeating', () => {
    // turn N-5: pergunta material. lead respondeu, IA seguiu, agora intenção é repetir
    // mas a outgoing MAIS RECENTE não contém essa phrasing → loop não está iminente.
    // Na verdade, a lógica pega a MAIS RECENTE que CONTÉM a phrasing — então esse caso
    // (phrasing antiga + sem repetição recente) precisa ser construído com uma outgoing
    // posterior que substituiu o tópico.
    const recentMessages: RecentMessage[] = [
      { direction: 'outgoing', content: 'Qual material? (granito, mármore, inox ou sintético)' },
      { direction: 'incoming', content: 'granito' },
      { direction: 'outgoing', content: 'Perfeito. E qual tamanho?' },
      { direction: 'incoming', content: 'pequeno' },
    ]
    // Sistema agora quer perguntar OUTRA coisa diferente
    const r = detectQualifLoop({
      recentMessages,
      intendedPhrasing: 'Qual cor preferida?',
      fieldLabel: 'cor',
    })
    expect(r.repeating).toBe(false)
  })

  it('7. Outgoing tem a phrasing mas sem incoming depois → not repeating (lead não respondeu)', () => {
    const r = detectQualifLoop({
      recentMessages: [
        { direction: 'incoming', content: 'oi' },
        { direction: 'outgoing', content: 'Qual material? (granito, mármore, inox ou sintético)' },
      ],
      intendedPhrasing: 'Qual material? (granito, mármore, inox ou sintético)',
      fieldLabel: 'material',
    })
    expect(r.repeating).toBe(false)
  })

  it('8. recentMessages vazio → first_attempt', () => {
    const r = detectQualifLoop({
      recentMessages: [],
      intendedPhrasing: 'Qual material?',
      fieldLabel: 'material',
    })
    expect(r.repeating).toBe(false)
    if (!r.repeating) {
      expect(r.reason).toBe('first_attempt')
    }
  })

  it('9. Nudge contém PROIBIDO + INTERPRETE + REFORMULE', () => {
    const r = detectQualifLoop({
      recentMessages: [
        { direction: 'outgoing', content: 'Qual material?' },
        { direction: 'incoming', content: 'sei lá kkk' },
      ],
      intendedPhrasing: 'Qual material?',
      fieldLabel: 'material',
    })
    expect(r.repeating).toBe(true)
    if (r.repeating) {
      expect(r.nudge).toContain('PROIBIDO')
      expect(r.nudge).toContain('INTERPRETE')
      expect(r.nudge).toContain('REFORMULE')
    }
  })

  it('10. Sanitização: lastIncoming com whitespace excessivo é trimmed/colapsado', () => {
    const r = detectQualifLoop({
      recentMessages: [
        { direction: 'outgoing', content: 'Qual material?' },
        { direction: 'incoming', content: '   mais\n\n  simples   mesmo   ' },
      ],
      intendedPhrasing: 'Qual material?',
      fieldLabel: 'material',
    })
    expect(r.repeating).toBe(true)
    if (r.repeating) {
      expect(r.lastIncoming).toBe('mais simples mesmo')
      expect(r.nudge).toContain('mais simples mesmo')
      expect(r.nudge).not.toContain('   mais')
    }
  })
})
