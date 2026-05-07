---
title: Plano Testes Sandbox v3 — Bloco N (Natural/Humano) + Bloco M (Mídia)
tags: [sandbox, testes, e2e, ai-agent, humanizacao, midia, audio, fuzzy, debounce]
sources: [wiki/plano-testes-sandbox-v2, wiki/relatorio-testes-sandbox-sessao1]
updated: 2026-05-07
---

# Bloco N — Comportamento Humano Real

> Sessão 1 testou cenários "limpos" (msg curta, sem typo, sem emoji, sem áudio). Lead real do WhatsApp brasileiro NÃO conversa assim. Bloco N força a IA a lidar com fragmentação, typos, áudio, divagação.

## Pré-requisito: R110 fix shipado (guard <=1 + stop-words)

Sem R110, queries naturais geram tags falsas `marca_indisponivel:*`. Aplicar antes do bloco N.

---

## N1 — Mensagens fragmentadas (debounce)

| | |
|---|---|
| **Você manda (3 msgs em ~5s)** | `oi` → 2s → `bom dia` → 2s → `vocês têm tinta acrílica branca?` |
| **IA esperada** | UMA resposta consolidada (debounce 10s coalesce) |
| **Caso real** | Cliente digitando no celular fragmenta naturalmente |
| **Pass criteria** | exatamente **1 chamada** ao `ai-agent` em `ai_agent_logs` (não 3). 1 msg outbound (não 3) |
| **Implementação** | 3 cURLs em sequência rápida + sleep 22s antes de auditar |

## N2 — Erros de digitação (fuzzy)

| | |
|---|---|
| **Você manda** | `tem tnta acrilca pra parde da sla?` (4 typos) |
| **IA esperada** | reconhecer "tinta acrílica para parede da sala" (fuzzy + LLM tolerance) |
| **Pass criteria** | tags `interesse:tinta`, `tipo_tinta:acrilica`, `ambiente:parede interna` ou similar |
| **Caso real** | Pintor digitando rápido sem corrigir |

## N3 — Áudio em vez de texto

| | |
|---|---|
| **Você manda** | áudio (`POST /send/media` `type: ptt` com arquivo base64): "preciso de uma tinta acrílica branca pra parede da sala" |
| **IA esperada** | transcrever via `transcribe-audio` fn → processar texto |
| **Valido** | `conversation_messages.media_type = audio` + `transcription` populado + ai-agent processou |
| **Pass criteria** | tags geradas como se fosse texto + IA respondeu coerente |
| **Caso real** | 60-70% dos leads brasileiros mandam áudio |

## N4 — Emojis e abreviações

| | |
|---|---|
| **Você manda** | `bom dia 🙏 td bem? vcs tem tnta acrilica branca? eh pra parede da sala 🏠 mt obg` |
| **IA esperada** | tolerar emojis + abreviações (vc, td, vcs, eh, mt, obg) sem confundir |
| **Pass criteria** | qualificação correta (mesmo com texto poluído) |

## N5 — Mistura de assuntos

| | |
|---|---|
| **Você manda** | `tem tinta? aliás vocês entregam? quanto custa? aceita pix?` |
| **IA esperada** | priorizar qualificação (tinta) MAS responder info genérica (entrega/pix) ou redirecionar elegantemente |
| **Pass criteria** | sem ignorar perguntas + sem alucinação sobre entrega |

## N6 — Mudança de ideia / divagação

| | |
|---|---|
| **Setup** | conversa qualificada com `interesse:tinta, ambiente:interno, tipo_tinta:acrilica` |
| **Você manda** | `pera aí, esquece tinta. quero é uma fechadura digital pra porta de entrada` |
| **IA esperada** | resetar fluxo, mudar `interesse:fechadura`, perguntar fields da nova categoria |
| **Pass criteria** | tags antigas removidas/marcadas substituídas, nova categoria detectada |
| **Risco** | IA pode misturar tags das duas categorias |

## N7 — Tempo realista (retention)

| | |
|---|---|
| **Setup** | 4 turnos qualificando tinta |
| **Você** | sumir por 25-30 minutos |
| **Volta com** | `voltei` |
| **IA esperada** | preservar contexto (tags + lead_profile) + retomar de onde parou OU oferecer recap |
| **Pass criteria** | sem reset não-solicitado de tags |

---

## Bônus N8-N13 (se sobrar tempo)

- **N8** — `você é robô?` → testa transparency policy (RULES.md tem regra explícita?)
- **N9** — Lead manda foto de tinta de outra loja: `vocês têm parecida?` → testa vision multimodal
- **N10** — Tom emocional: `tô na pressa, minha obra parou` → testa empatia + handoff
- **N11** — Comparação preço: `concorrente cobra R$ 350, vocês cobrem?` → handoff via "preço"
- **N12** — Compartilhar localização: `entregam aqui?` + share location → parsing de geo
- **N13** — Múltiplos itens: `quero tinta, parafuso M6 e lixa 100` → multi-product

---

# Bloco M — Mídia/Produtos

## M1 — Carrossel com 1 produto (send_media)

| | |
|---|---|
| **Você manda** | `tem manta líquida?` (catálogo Eletropiso tem só 1) |
| **IA esperada** | usar `send_media` (foto única + caption) em vez de carrossel |
| **Pass criteria** | `media_type=image` (não carousel) |

## M2 — Filtro de preço

| | |
|---|---|
| **Você manda** | `quero tinta acrílica branca até 500 reais` |
| **IA esperada** | `search_products(query="tinta acrilica branca", max_price=500)` → retorna só Coral 16L (R$ 427) |
| **Valido** | Coral 18L (R$ 792) NÃO aparece |

## M3 — Botão REPLY do carrossel

| | |
|---|---|
| **Setup** | carrossel de M2 enviado |
| **Você** | clicar no botão "Eu quero!" do Coral 16L (gera msg `Tinta Acrílica Fosco Standard 16L Tubarão Branco Rende Muito - Coral`) |
| **IA esperada** | reconhecer interesse → enriquecer (quantidade/area) → handoff |

## M4 — Lead envia foto de produto

| | |
|---|---|
| **Você** | foto de tinta concorrente (Suvinil branca) com caption: `vocês têm parecida com essa?` |
| **IA esperada** | reconhecer imagem (vision do gpt-4.1-mini) → search "tinta branca" → mostrar Coral |
| **Caso real** | cliente fotografa tinta da concorrência |

## M5 — Lead envia áudio (igual N3)

## M6 — Lead envia comprovante (foto pix)

| | |
|---|---|
| **Setup** | conversa em shadow após handoff |
| **Você** | foto qualquer com caption: `segue o comprovante` |
| **IA esperada** | tagear `venda:fechada` ou `intencao:compra` (se tiver feature) |

## M7 — Produto excluído (D28)

| | |
|---|---|
| **Pré** | conferir `ai_agents.excluded_products` Eletropiso |
| **Você manda** | item da lista (ex: `tem caixa de correio?`) |
| **IA esperada** | usar fallback configurado, NÃO handoff, NÃO incrementar contador |
| **Pass criteria** | tag `excluded_product_match:caixa_correio` |

## M8 — Search com 5+ produtos

| | |
|---|---|
| **Você manda** | termo amplo (ex: `tem cabo elétrico?`) |
| **IA esperada** | carrossel limitado a 4-5 cards (UAZAPI limita visualmente) |

## M9 — Imagem quebrada (404)

| | |
|---|---|
| **Pré** | inserir produto teste com URL imagem inválida |
| **Valido** | UAZAPI retorna erro? IA usa fallback? carrossel quebra? |

## M10 — Filtros combinados

| | |
|---|---|
| **Você** | `tinta acrílica branca da Coral até 500 reais` |
| **IA esperada** | search com query + max_price |

---

## Métricas adicionais sessão 2 (J expandido)

- Tempo médio até qualificação completa (do "oi" ao primeiro search) — meta < 2min
- % de mensagens com áudio vs texto
- % de mensagens com erros de digitação que ainda foram processadas
- Custo por bloco (N vs M)

## Cross-refs

- [[wiki/plano-testes-sandbox]] — v1 (A/B/C/D/E)
- [[wiki/plano-testes-sandbox-v2]] — v2 (F/G/H/J)
- [[wiki/relatorio-testes-sandbox-sessao1]] — sessão 1 results
- [[wiki/erros-e-licoes]] — R107, R108, R109, R110
