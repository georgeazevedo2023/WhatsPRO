---
title: Fluxos Unificados — Visao e Arquitetura
tags: [arquitetura, fluxos, orquestrador, subagentes, templates]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-12
---

# Fluxos Unificados — Visao e Arquitetura

> Parte 1/4 do plano v3.0. Visao geral, arquitetura do fluxo, orquestrador, subagentes, templates e mapeamento.
> Docs relacionados: [[wiki/fluxos-params-atendimento]], [[wiki/fluxos-params-inteligencia]], [[wiki/fluxos-params-entrada]]

---

## 1. Problema

Admin precisa navegar 8+ telas para montar um unico fluxo de negocio. UX fragmentada ("painel de aviao"): Bio Link numa tela, Campanha UTM noutra, Formulario noutra, Perfil IA noutra, Motor Automacao noutra.

## 2. Visao

Tudo e um fluxo. Admin pensa "o que acontece quando o lead chega?" e configura em interface unica.

## 3. Arquitetura — 4 Etapas + Reconhecimento

```
[Etapa 0: Reconhecimento — banco SQL, sem LLM, ~50ms, sempre roda]
     |
GATILHO → CONDICAO → ACAO/SUBAGENTES (exit rules embutidos) → METRICAS
```

> Decisao D13: Transbordo nao e etapa separada. Cada subagente tem exit_rules (trigger+msg+destino). `final_handoff` e fallback.

## 4. Modos de Criacao

| Modo | Ideal para | Como funciona |
|---|---|---|
| Conversa Guiada | Admin iniciante | IA pergunta, sugere, configura. Admin aprova |
| Formulario Direto | Admin experiente | 4 etapas com selects/inputs |
| Templates Prontos | Qualquer um | Fluxo pre-configurado, 1 clique + customiza |

**Regra:** 3 modos geram o mesmo objeto Flow. Admin alterna livremente.

## 5. Templates Pre-Configurados (12)

| # | Template | Gatilho | Acao-chave | Categoria |
|---|----------|---------|------------|-----------|
| 1 | Vitrine de Produtos | Bio/QR | Catalogo + Carrossel | Vendas |
| 2 | Lancamento de Produto | UTM Ads | Teaser + Lista espera | Vendas |
| 3 | Recuperacao Carrinho | Webhook | Cupom + Lembrete | Vendas |
| 4 | Cardapio Digital | QR Code | Catalogo + Pedido | Vendas |
| 5 | Sorteio / Promocao | Bio + UTM | Form + Confirmacao | Captacao |
| 6 | Lead Qualificado SDR | UTM Ads | BANT + Enquete | Captacao |
| 7 | Evento / Inscricao | Bio + QR | Inscricao + Agenda | Captacao |
| 8 | Suporte Tecnico | Keyword | Diagnostico + FAQ | Atendimento |
| 9 | Agendamento Consulta | Bio/Keyword | Form data/hora | Atendimento |
| 10 | Pos-Venda Onboarding | Tag/Webhook | Tutorial + Enquete | Atendimento |
| 11 | Campanha Politica | QR+Bio+UTM | Enquete + Mobilizacao | Nicho |
| 12 | Imobiliaria Alto Ticket | UTM+Bio | Perfil + Matching | Nicho |

Todos genericos — funcionam para qualquer segmento via parametros configuraveis.

## 6. Orquestrador

### De Monolito a Microservicos de IA

**Antes:** ai-agent ~2600 linhas, faz tudo. **Depois:** Orquestrador ~300 linhas + subagentes ~200 linhas cada.

### Estrutura de Arquivos

```
orchestrator/
├── index.ts              # Entry point (~300 linhas)
├── subagents/
│   ├── greeting.ts       # Saudacao
│   ├── qualification.ts  # Qualificacao + score
│   ├── sales.ts          # Vendas (catalogo + carrossel)
│   ├── support.ts        # Suporte (FAQ + diagnostico)
│   ├── handoff.ts        # Transbordo (assign + notify)
│   ├── followup.ts       # Follow-up (re-engajamento)
│   ├── survey.ts         # Enquete/NPS
│   └── custom.ts         # Prompt livre do admin
├── tools/                # 9 tools compartilhadas
└── config/
    ├── flowResolver.ts   # Resolve qual fluxo ativar
    ├── contextBuilder.ts # Monta contexto com parametros
    └── stateManager.ts   # Estado do fluxo no banco
```

### Ciclo de Vida

```
Mensagem chega → Reconhecimento (banco) → Decisao de Rota
  → Fluxo ativo? Retoma ponto onde parou
  → Sem fluxo? Verifica gatilhos → Match? Inicia fluxo → Sem match? Agente Padrao
  → Monta contexto → Executa subagente → Processa resultado → Persiste estado
```

### Ganhos

| Aspecto | Monolito | Orquestrador |
|---|---|---|
| Codigo | ~2600 linhas em 1 | ~300 + ~200/sub |
| Mudar comportamento | Deploy | Parametro no admin |
| Prompt LLM | ~3000 palavras | ~300-500 (focado) |
| Custo/msg | Alto | ~80% menor |

## 7. Agente Padrao vs Subagentes

- **Agente Padrao:** ai-agent atual vira "Default". Roda quando nenhum fluxo bate.
- **Subagentes:** Herdam do Padrao, sobrescrevem prompt, tools, qualificacao, handoff.
- **Hierarquia:** Lead chega → Bate com Fluxo? SIM → subagente do fluxo. NAO → Agente Padrao.

## 8. Mapeamento — Modulos Atuais → Novo Modelo

| Modulo atual | Papel no novo modelo |
|---|---|
| Bio Link | Tipo de Gatilho |
| Campanhas UTM | Tipo de Gatilho |
| Formularios | Tool do Subagente |
| Catalogo | Tool do Subagente |
| Enquetes/NPS | Tool do Subagente + Metrica |
| Agent Profiles | Subagente (contexto + prompt) |
| Motor Automacao | Motor por tras dos fluxos |
| Funis (wizard) | Template que pre-cria um fluxo |
| Kanban | Visualizacao do estagio |
| Broadcast | Tipo de Acao |
| Helpdesk | Tela de Transbordo |
| Dashboard | Aba Metricas |

## 9. Detector Unificado de Intents

13 intents detectados por 3 camadas progressivas (normalizacao → fuzzy match → semantico LLM).
Roda ANTES da rota de fluxo. Prioridade sobre qualquer gatilho.
Detalhes completos: [[wiki/fluxos-detector-intents]]

| Camada | Tempo | Custo | Resolve |
|---|---|---|---|
| 1. Normalizacao (abreviacoes, acentos, dedup) | ~5ms | R$0 | 50% |
| 2. Fuzzy Match (Levenshtein + Soundex + sinonimos) | ~10ms | R$0 | 30% |
| 3. Semantico LLM (so se ambiguo) | ~200ms | R$0,001 | 20% |

Pipeline atualizado:
```
Msg → STT → Memory → Reconhecimento → DETECTOR INTENT → Rota → Subagente → Validator → TTS → Envio
```

Intents diretos (bypass fluxo): Pessoa, Produto, Suporte, Status, Orcamento, Agendamento, FAQ, Promocao, B2B, Cancelamento, Reclamacao, Continuacao, Generico.

## 10. 4 Modos de Operacao

| Modo | IA fala? | IA coleta? | Quem atende |
|---|---|---|---|
| IA Ativa | Sim | Sim | IA (subagentes) |
| IA Assistente | Sugere | Sim | Vendedor (IA sugere) |
| Shadow | Nao | Sim | Vendedor (IA observa) |
| Desligado | Nao | Nao | Vendedor (sem IA) |

Shadow Mode: 7 dimensoes (Lead, Vendedor, Objecao, Produto, Gestor, Resposta, Follow-up).
Detalhes: [[wiki/fluxos-shadow-mode]]

## 11. 5 Servicos de Infraestrutura

Servicos NAO falam com o lead. Sao camadas que alimentam, validam e medem cada subagente.
Detalhes completos: [[wiki/fluxos-servicos]]

| Servico | Quando | Funcao |
|---|---|---|
| Memory | ANTES de cada subagente | Monta contexto (memoria curta + longa) |
| Audio | ANTES (STT) e DEPOIS (TTS) | Transcreve audio entrada, converte saida |
| Validator | DEPOIS subagente, ANTES enviar | Quality gate, brand voice, fact-check |
| Metrics | ENVOLVE tudo (cronometro) | Mede tempo, coleta dados, breakdown |
| Shadow Analyzer | MODO SHADOW (passivo) | Extrai lead, objecoes, produtos, follow-up |

Pipeline IA Ativa: Metrics.start → STT → Memory → Rota → Subagente → Validator → TTS → Envio → Metrics.end
Pipeline Shadow: Metrics.start → STT → Memory → Shadow Analyzer → Metrics.end (nao responde)

## 12. Geracao Visual — Nano Banana

Unico modelo: Nano Banana (Gemini 3 Pro Image). API Gemini ja configurada.
Edge Function `generate-image`. Casos: banner bio, arte carrossel, post campanha.

## 13. Ordem de Implementacao

1. Formulario direto (base)
2. Templates prontos (form pre-preenchido)
3. Conversa guiada (depende dos anteriores)
Estrategia: fatias verticais (cada entrega = fluxo completo funcionando).
