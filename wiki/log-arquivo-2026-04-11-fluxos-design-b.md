---
title: Log Arquivo — Fluxos v3.0 Design Phase (2026-04-11 parte B)
tags: [log, arquivo, fluxos]
updated: 2026-04-11
---

# Log Arquivo — Fluxos v3.0 Design Phase (parte B)

> Entradas arquivadas de log.md em 2026-04-11 por ultrapassar 200 linhas.

### Parametro 9 Bio Link EXPANDIDO — 15 sub-params + 10 modelos + midia + Nano Banana
- **Tipo:** Discussao detalhada de parametro + analise de 10 modelos profissionais
- **Wiki criada:** `wiki/fluxos-params-biolink.md` (~100 linhas)
- **Wikis atualizadas:** `wiki/fluxos-params-entrada.md` (P9 atualizado), index.md
- **Fonte:** `10 MODELOS DE LINK NA BIO.html` (corretor, advogada, personal, fotografo, nutricionista, dentista, confeiteira, designer, psiquiatra, professor)
- **Evolucao:** 6 sub-params → 15 sub-params. Nota: 7.0 → 9.0 (+modelos) → 9.5 (+sugestoes)
- **Novidades:** 12+ templates por segmento, 13 blocos de secao, social proof REAIS, WhatsApp preview, media_library cross-sistema, Nano Banana (5 geracoes), animacoes (entrance/avatar/button)
- **Total sistema:** 92 sub-parametros (era 83)

### Arquitetura: Detector Unificado de Intents + 3 Camadas + Normalizacao BR
- **Tipo:** Decisao arquitetural — detector de intents unificado
- **Wiki criada:** `wiki/fluxos-detector-intents.md` (~160 linhas)
- **Decisoes (D15):** Keywords+Intents unificados em 1 detector com 3 camadas. 13 intents, prioridade. Normalizacao 50+ abreviacoes BR. Fuzzy: Levenshtein+Soundex. Semantico LLM: 20% msgs. 80% resolve sem IA.

### Arquitetura: 4 Servicos de Infraestrutura (Memory + Audio + Validator + Metrics)
- **Tipo:** Decisao arquitetural — servicos de infraestrutura
- **Wiki criada:** `wiki/fluxos-servicos.md` (120 linhas)
- **Decisoes (D14):** Memory (curta cache + longa banco, 95% menos tokens), Audio (STT+TTS, 4 modos), Validator (10 checks auto + score LLM + brand voice + fact-check), Metrics (breakdown por camada, 3 dimensoes)

### Doc: Reorganizacao Wiki Fluxos — 2 arquivos grandes → 4 arquivos por grupo funcional
- **Tipo:** Reorganizacao documentacao
- **Removidos:** `wiki/plano-fluxos-unificados.md` (514 linhas), `wiki/fluxos-parametros-detalhados.md` (265 linhas)
- **Criados:** fluxos-visao-arquitetura.md (140) + fluxos-params-atendimento.md (116) + fluxos-params-inteligencia.md (95) + fluxos-params-entrada.md (135) — total 486 linhas em 4 arquivos

### Parametros Novos: Gatilhos(6) + Condicoes(4) + Bio(6) + UTM(6) + QR(5) + Forms(6) + Webhooks(3) + Lead Score(6)
- **Total do sistema:** 14 grupos, 83 sub-parametros. 7 discutidos em profundidade, 7 pendentes.

### Parametros Detalhados: Saudacao + Produtos + Exit Rules + Transbordo Distribuido
- **Tipo:** Discussao arquitetural — detalhamento de parametros
- **Decisoes tomadas (D13):** Transbordo NAO e etapa separada — cada subagente tem exit_rules. Saudacao: 6 sub-params, extract_name, context_depth 3 niveis. Produtos: 8 sub-params. Exit rule: trigger+message+action, 8 destinos.

### Arquitetura: Orquestrador + Subagentes + Parametro Qualificacao
- **Tipo:** Discussao arquitetural — aprofundamento
- **Novidades:** Monolito (~2600 linhas) → orquestrador (~300) + subagentes (~200 cada). Estrutura: orchestrator/ com subagents/, tools/, config/. Ciclo: receiveMessage → resolveFlow → buildContext → executeAgent → processResult → advanceFlow. Qualificacao: 7 sub-params, score, perguntas condicionais, 16 tipos resposta.
