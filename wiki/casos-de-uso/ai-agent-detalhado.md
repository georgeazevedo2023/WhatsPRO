---
title: AI Agent — Documentação Detalhada (Índice)
tags: [ai-agent, indice, funcionalidades, detalhado]
sources: [supabase/functions/ai-agent/, src/components/ai-agent/]
updated: 2026-04-30
---

# AI Agent — Vendedor Robô Inteligente (15 Sub-Funcionalidades)

> O AI Agent e um **vendedor robô** que atende os clientes pelo WhatsApp automaticamente, 24 horas por dia, 7 dias por semana. Não é um chatbot burro com respostas fixas — é um agente inteligente que **pensa**, **decide** e **age**: lê o que o cliente mandou, entende a intenção, busca produtos no catálogo, envia fotos, monta carrosséis, qualifica o lead, extrai dados, e quando não consegue resolver, transfere para um humano.
>
> Pense nele como um funcionário júnior que trabalha sem parar: recebe o cliente, pergunta o que precisa, mostra os produtos, responde preço, e quando o assunto fica complexo ("quero desconto", "quero falar com o gerente"), chama o vendedor sênior.

---

## Índice — 4 sub-wikis particionados

Esta documentação foi particionada em 2026-04-30 (de 492 linhas → 4 sub-wikis sob 200 linhas cada). Cada sub-wiki cobre um grupo lógico de sub-funcionalidades:

| Sub-wiki | Sub-funcionalidades | Quando ler |
|---|---|---|
| [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] | **2.1** Cérebro (LLM gpt-4.1-mini + circuit breaker) · **2.2** As 9 Ferramentas (search_products, send_carousel, send_media, handoff_to_human, assign_label, set_tags, move_kanban, update_lead_profile, send_poll) | Para entender o que o agente FAZ |
| [[wiki/casos-de-uso/ai-agent-sdr-shadow-detalhado]] | **2.3** Fluxo SDR (qualificação inteligente com Service Categories + stages + score) · **2.4** Shadow Mode (extração silenciosa pós-handoff) | Para entender como o agente PENSA |
| [[wiki/casos-de-uso/ai-agent-validator-prompt-detalhado]] | **2.5** Validator Agent (supervisor de qualidade) · **2.6** TTS (resposta por voz) · **2.7** Prompt Studio (personalização) | Para entender QUALIDADE e CUSTOMIZAÇÃO |
| [[wiki/casos-de-uso/ai-agent-recursos-extras-detalhado]] | **2.8** Perfis · **2.9** NPS · **2.10** Knowledge Base · **2.11** Debounce · **2.12** Greeting · **2.13** Memória do Lead · **2.14** Contexto de Canal · Sequência Correção · Painel Admin (9 tabs) | Para os recursos AUXILIARES |

## Sub-wikis relacionados

- [[wiki/casos-de-uso/excluded-products-detalhado]] — **D28** (2026-04-30) — Lista de produtos que a tenant NÃO vende, configurável via UI

---

## Por que 4 sub-wikis?

A documentação original tinha 492 linhas — fora do limite de 200 (Regra 14 do CLAUDE.md). Particionamento mantém a navegabilidade (cada arquivo é digerível em 1 leitura) e facilita atualizações pontuais sem recarregar todo o conteúdo.

A divisão segue grupos lógicos:
1. **Núcleo** (cérebro + ações)
2. **Fluxo** (qualificação + escuta silenciosa)
3. **Qualidade** (validador + voz + customização)
4. **Recursos extras** (perfis, NPS, KB, atalhos de comportamento)

---

## Links Relacionados

- [[wiki/ai-agent]] — Referência técnica resumida do AI Agent
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Central de atendimento (5 sub-páginas)
- [[wiki/modulos]] — Todos os 18 módulos do sistema (M1-M19)
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rápido de funcionalidades
- [[wiki/historico-planos/plano-enquetes-polls]] — Plano histórico de enquetes (M17)
- [[wiki/decisoes-chave]] — D10 (Agent Profiles), D26 (Service Categories), D28 (Excluded Products)
- [[wiki/erros-e-licoes]] — Regras preventivas R1-R89

---

*Originalmente documentado em: 2026-04-09 — Sessão de documentação detalhada com George Azevedo*
*Particionado em 2026-04-30 — 492 linhas → 4 sub-wikis (regra 14: max 200 linhas/MD)*
