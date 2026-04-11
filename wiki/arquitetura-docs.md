---
title: Arquitetura de Documentacao — Como os Arquivos se Organizam
tags: [documentacao, claude, vault, regras, padroes, arquitetura]
updated: 2026-04-10
---

# Arquitetura de Documentacao

> Como os arquivos de documentacao do WhatsPRO se organizam e quando cada um e carregado.

## O Problema Anterior

O CLAUDE.md tinha **373 linhas / 40KB** com tudo misturado: protocolos, regras, stack tecnica, padroes de implementacao, lista de edge functions, roadmap. Isso causava:
- Consumo de ~12.000 tokens em TODA sessao (antes de qualquer tarefa)
- Informacao duplicada com wiki/ (stack, arquitetura, deploy ja existiam la)
- Dificil distinguir o que e REGRA obrigatoria do que e REFERENCIA de consulta

## A Solucao: 4 Arquivos Especializados

```
CLAUDE.md (ORQUESTRADOR — 96 linhas, 4KB)
├── Quem sou / O que e o projeto (3 linhas)
├── Tabela de arquivos de suporte (quando ler cada um)
├── Protocolos obrigatorios (inicio/fim sessao)
├── Comandos do usuario (tabela)
├── Quando atualizar o vault (triggers)
├── Formato de discussao de decisoes
├── Convencoes (wikilinks, frontmatter, datas)
├── Regras de ouro (7 regras resumidas — detalhes em RULES.md)
└── Comandos (/prd, /uazapi)

RULES.md (REGRAS DETALHADAS — 113 linhas, 6KB)
├── Regras de integridade de dados
├── Sequencia de correcao de erros (4 niveis)
├── Protocolo de entrega (6 passos)
├── SYNC RULE (8 checklist)
├── Arquivos HIGH RISK
├── Regras de CORS e deploy
├── Regras do AI Agent (15 regras especificas)
└── Convencoes de codigo

ARCHITECTURE.md (REFERENCIA TECNICA — 87 linhas, 4KB)
├── Tech stack (frontend, backend, AI, WhatsApp)
├── Diagrama de arquitetura
├── User roles (super_admin, gerente, user)
├── Edge Functions (31 total com verify_jwt)
├── Shared modules (17)
├── Deployment (Docker, CI/CD, Portainer)
├── Development commands (npm, tsc, vitest, supabase)
├── Modulos (17 — resumo com link pro wiki)
└── Documentacao detalhada (5 wikis com sub-funcionalidades)

PATTERNS.md (PADROES DE IMPLEMENTACAO — 150 linhas, 9KB)
├── UAZAPI / WhatsApp (7 padroes)
├── AI Agent / LLM (20 padroes)
├── Catalogo / Busca (11 padroes)
├── Validator (5 padroes)
├── TTS / Voz (4 padroes)
├── Prompt Studio (3 padroes)
├── SDR / Qualificacao (5 padroes)
├── Tags (4 padroes)
├── Helpdesk / Realtime (10 padroes)
├── Leads / CRM (6 padroes)
├── Campanhas / Funis / Forms / Bio (12 padroes)
├── Banco de Dados (5 padroes)
├── NPS / Enquetes (5 padroes)
└── Admin AI Agent / Playground (5 padroes)
```

## Fluxo de Carregamento

```
Sessao inicia
  ↓
CLAUDE.md lido automaticamente (96 linhas = ~4KB = ~1.200 tokens)
  ↓
Protocolo de inicio: ler index.md + roadmap + erros + log + decisoes
  ↓
Tarefa atribuida pelo usuario
  ↓
Se precisa implementar → ler PATTERNS.md (sob demanda)
Se precisa verificar regra → ler RULES.md (sob demanda)
Se precisa entender stack → ler ARCHITECTURE.md (sob demanda)
Se precisa detalhe de funcionalidade → ler wiki/casos-de-uso/*-detalhado.md
```

## Metricas

| Metrica | Antes | Depois | Reducao |
|---------|-------|--------|---------|
| Carregamento automatico por sessao | 40KB | 4KB | **90%** |
| Linhas lidas em toda sessao | 373 | 96 | **74%** |
| Tokens consumidos no startup | ~12.000 | ~1.200 | **90%** |
| Informacao total disponivel | 373 linhas | 446 linhas | **+20%** (mais organizado) |

## Regra de Manutencao

Ao atualizar qualquer regra, padrao ou referencia tecnica:

1. Identificar em QUAL arquivo pertence (RULES / ARCHITECTURE / PATTERNS)
2. Atualizar no arquivo correto
3. Se for regra critica nova, adicionar resumo nas "Regras de Ouro" do CLAUDE.md
4. Registrar no log.md

**NUNCA** voltar a inflar o CLAUDE.md com detalhes — ele e orquestrador, nao enciclopedia.

## Links

- [[CLAUDE.md]] — Orquestrador (96 linhas)
- [[RULES.md]] — Regras detalhadas (113 linhas)
- [[ARCHITECTURE.md]] — Referencia tecnica (87 linhas)
- [[PATTERNS.md]] — Padroes de implementacao (150 linhas)
- [[wiki/decisoes-chave]] — Decisoes arquiteturais do projeto

---

*Documentado em: 2026-04-10 — Reorganizacao CLAUDE.md (373→96 linhas) + criacao RULES/ARCHITECTURE/PATTERNS*
