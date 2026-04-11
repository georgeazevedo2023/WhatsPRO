---
title: Fluxos — 4 Servicos de Infraestrutura (Memory + Audio + Validator + Metrics)
tags: [servicos, memoria, audio, stt, tts, validador, metricas, infraestrutura]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-11
---

# 4 Servicos de Infraestrutura

> Servicos NAO sao subagentes — nao falam com o lead. Sao camadas que alimentam, validam e medem cada subagente.
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-params-atendimento]], [[wiki/fluxos-params-inteligencia]], [[wiki/fluxos-params-entrada]]

---

## Pipeline por Mensagem

```
Lead envia (texto ou audio)
  |
  Metrics.start() ← cronometro inicia
  → Audio.STT (se audio → transcreve)
  → Memory.load (curta + longa)
  → Reconhecimento + Rota
  → Subagente.execute()
  → Validator.check()
  → Audio.TTS (se ativo → converte pra audio)
  → Envio UAZAPI
  Metrics.end() ← cronometro para + registra breakdown
```

---

## S1 — Memory Service (contexto ANTES de cada subagente)

### Memoria Curta (sessao atual)

- **Onde vive:** Cache (rapido, volatil)
- **Duracao:** Morre apos re_engagement_days sem contato
- **Atualiza:** A cada mensagem (IA resume incrementalmente)
- **Conteudo:**
  - summary: resumo da conversa atual (gerado por LLM)
  - sentiment: estado emocional atual
  - products_shown: produtos vistos nesta sessao + reacao
  - qualification: respostas coletadas
  - intents: intencoes detectadas
  - unanswered: perguntas que IA nao soube responder

### Memoria Longa (cross-session, permanente)

- **Onde vive:** Tabela no banco (persistente)
- **Duracao:** Permanente (nunca apaga)
- **Atualiza:** Ao final de cada sessao (LLM resume)
- **Conteudo:**
  - profile: personalidade, horario preferido, estilo de resposta
  - sessions: resumo de cada sessao passada + outcome + score
  - purchases: historico de compras
  - preferences: marcas, faixa de preco, padrao de decisao, deal breakers
  - issues: reclamacoes passadas
  - referrals: indicacoes feitas/recebidas

### Ganho

Sem memoria: subagente recebe 20 mensagens brutas (~2000 tokens).
Com memoria: subagente recebe resumo focado (~100 tokens). 95% mais barato, mais preciso.

---

## S2 — Audio Service (STT entrada + TTS saida)

### Entrada (STT — Speech to Text)

- **Modelo:** Whisper / ElevenLabs Scribe
- **Fluxo:** Audio recebido → transcreve → texto vai pro subagente
- **Metadados extraidos:** duracao, idioma, sentimento pela voz
- **Params:** max_audio_duration(120s), language("pt"), save_transcription(true)
- **Edge case:** Audio inaudivel → msg "Pode repetir ou enviar por texto?"

### Saida (TTS — Text to Speech)

- **Modelo:** ElevenLabs / Kokoro TTS
- **Modos:**
  - "always": toda resposta vira audio
  - "mirror": responde no mesmo formato (audio→audio, texto→texto)
  - "never": sempre texto
  - "ask": pergunta preferencia na primeira vez
- **Params:** tts_mode("mirror"), voice_id(string), max_tts_length(500 chars), fallback_text(true)
- **Edge case:** Msg longa (>500 chars) → envia texto mesmo com TTS ativo

### Inteligencia

- Audio longo (>60s): transcreve → resume → passa pro subagente
- Deteccao de idioma: responde no idioma correto ou avisa limitacao

---

## S3 — Validator Service (quality gate ANTES de enviar)

### Verificacoes automaticas (sem LLM, rapido)

| Verificacao | Acao se falha |
|---|---|
| Msg muito curta (<5 chars) | Bloqueia (IA travou) |
| Msg muito longa (>1000 chars) | Resume |
| Idioma errado | Bloqueia → regera |
| Contem prompt do sistema | Bloqueia |
| Contem dados de outro lead | Bloqueia |
| Preco incorreto (vs catalogo) | Bloqueia → corrige |
| Emojis demais (>5) | Remove excesso |
| Markdown/codigo | Limpa |
| Resposta identica a anterior | Bloqueia |
| Saudacao repetida | Remove |
| Nome do lead repetido na msg | Remove excesso (max 1x) |

### Verificacao por LLM (qualidade profunda)

- **Score 0-10:** Tom, relevancia, fato correto, fluencia
- **Acao:** 8-10 envia, 5-7 envia+flag, 0-4 bloqueia→regera, 3 falhas→handoff humano
- **Custo:** ~100 tokens (~R$0,001) — previne respostas ruins que custam leads

### Brand voice check

- Admin configura tom da marca (amigavel, formal, descontraido)
- Validador checa se resposta bate com o tom configurado

### Fact-checking com catalogo

- IA mencionou produto → verifica existencia, preco, disponibilidade
- IA inventou produto → bloqueia → tag "alucinacao-detectada" → metrica

### Modo shadow (fluxos novos)

- IA gera resposta → validador analisa → NAO envia → mostra pro admin
- Admin aprova/rejeita/edita → so entao envia
- Para: testar fluxos novos, treinar subagentes

---

## S4 — Metrics Service (envolve TUDO, cronometra CADA camada)

### Metricas do Lead (por lead individual)

- **Jornada:** tempo no fluxo, etapas completadas, ponto abandono, sessoes
- **Engajamento:** msgs enviadas, tempo medio resposta, taxa followup, sentimento
- **Conversao:** score evolucao, produtos vistos/clicados, orcamentos, compras

### Metricas da IA (por subagente e por fluxo)

- **Performance:** msgs/dia, tempo resposta, custo/conversa, tokens/msg
- **Qualidade:** taxa handoff, resolucao sem humano, NPS medio, perguntas sem resposta
- **Por subagente:** greeting(tempo, sucesso), qualification(media perguntas), sales(carrosseis, taxa orcamento)
- **Seguranca:** injection attempts, bots detectados, rate limits triggered
- **Comparativo:** IA vs Humano (tempo, satisfacao, custo, resolucao)

### Metricas do Atendente (por humano)

- **Produtividade:** conversas/dia, tempo resposta, tempo resolucao, simultaneas
- **Qualidade:** NPS, resolucao primeiro contato, reincidencia, escalacoes
- **Handoff:** tempo aceitar, conversas recusadas, feedback sobre briefing

### Breakdown por mensagem

Cada mensagem registra tempo de cada camada:
```
{ reconhecimento: 50ms, memoria: 100ms, rota: 10ms,
  llm: 800ms, validador: 200ms, tts: 500ms, envio: 100ms,
  total: 1760ms }
```

---

## Resumo

| Servico | Quando roda | O que faz | LLM? |
|---|---|---|---|
| Memory | ANTES de cada subagente | Monta contexto (curta+longa) | Parcial (resumo) |
| Audio | ANTES (STT) e DEPOIS (TTS) | Transcreve entrada, converte saida | Nao (modelos STT/TTS) |
| Validator | DEPOIS do subagente, ANTES de enviar | Checa qualidade, bloqueia ruim | Parcial (score) |
| Metrics | ENVOLVE tudo (cronometro) | Mede tempo, coleta dados, alerta | Nao |
