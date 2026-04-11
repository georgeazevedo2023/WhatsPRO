# WhatsPRO - CRM Multi-Tenant WhatsApp

> Plataforma multi-tenant de atendimento WhatsApp (helpdesk), CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automacao. React + Supabase + UAZAPI. Producao: crm.wsmart.com.br

## Arquivos de Suporte (carregar sob demanda)

| Arquivo | Quando ler | O que contem |
|---------|-----------|--------------|
| `RULES.md` | Antes de implementar qualquer feature | Regras obrigatorias, SYNC RULE, correcao de erros, entrega, CORS, AI Agent |
| `ARCHITECTURE.md` | Quando precisa entender a stack | Tech stack, edge functions, deploy, modulos, roles |
| `PATTERNS.md` | Antes de codificar | Padroes por area (UAZAPI, AI Agent, Helpdesk, Leads, Campanhas, DB) |
| `wiki/casos-de-uso/*-detalhado.md` | Quando precisa detalhe de funcionalidade | 17 wikis com 187 sub-funcionalidades (padrao dual: didatico + tecnico) |
| `wiki/fluxos-*.md` | Quando trabalhar no Fluxos v3.0 | 7 wikis: visao, params (atendimento, inteligencia, entrada, biolink), servicos, detector intents |

---

## Vault Obsidian — Cerebro Persistente

Este projeto usa um vault Obsidian como memoria de longo prazo. A IA DEVE usar o vault para ler, consultar e manter as paginas wiki atualizadas.

### REGRA ZERO — DOCUMENTACAO E OBRIGATORIA

> **NUNCA** terminar uma tarefa sem documentar no vault.
> Codigo sem documentacao no vault e trabalho incompleto.

### PROTOCOLO DE INICIO DE SESSAO (OBRIGATORIO)

1. **Ler `index.md`** — Mapa completo do projeto
2. **Ler `wiki/roadmap.md`** — Status atual e proximos passos
3. **Ler `wiki/erros-e-licoes.md`** — NAO repetir erros documentados
4. **Ler `log.md`** (ultimas 5 entradas) — O que mudou recentemente
5. **Ler `wiki/decisoes-chave.md`** — Regras e padroes vigentes

Se pular, PARE e volte ao passo 1.

### PROTOCOLO DE FIM DE SESSAO (OBRIGATORIO)

1. **Atualizar `log.md`** — Resumo de TUDO que foi feito
2. **Atualizar wikis afetadas** — Paginas que ficaram desatualizadas
3. **Atualizar `wiki/roadmap.md`** — Se progresso mudou
4. **Atualizar `wiki/erros-e-licoes.md`** — Se encontrou/corrigiu bugs
5. **Informar o usuario** — Resumo do que foi documentado

### COMANDOS DO USUARIO

| O usuario diz | O que fazer |
|---------------|-------------|
| "leia o vault" / "contexto" | Protocolo de inicio (5 passos) → resumo do estado |
| "contexto geral" | Ler index + visao-produto + arquitetura + roadmap → resumo completo |
| "roadmap" / "status" | Ler roadmap + log → fases, progresso, bloqueios |
| "o que falta?" | Ler roadmap → listar so pendente por fase |
| "documentou?" | Atualizar log + wikis afetadas |
| "fim de sessao" | Protocolo de fim (documentar tudo + resumo) |
| "fluxos" / "design" | Ler wiki/fluxos-visao-arquitetura + params relevantes |
| "parametros" | Ler wiki/fluxos-params-* (atendimento, inteligencia, entrada, biolink) |

### QUANDO ATUALIZAR O VAULT

- **Apos COMMIT:** log.md + wiki/roadmap.md
- **Apos FEATURE:** wiki relevante + index (se nova pagina) + log.md
- **Apos BUG:** wiki/erros-e-licoes.md (causa + correcao + regra) + log.md
- **Apos DECISAO:** wiki/decisoes-chave.md + log.md
- **Antes de DEPLOY:** seguir wiki/deploy-checklist.md → registrar em log.md

### FORMATO PARA DISCUSSAO DE DECISOES

1. **Contexto** — O que e e por que importa (1 paragrafo didatico)
2. **Problema** — O que precisa ser decidido (1 paragrafo)
3. **Solucao** — Como funciona na pratica com exemplo concreto
4. **Casos de uso** — 4 exemplos reais
5. **Opcoes** — Alternativas com pros/contras e **recomendacao** destacada
6. **Documentacao** — Resposta do usuario documentada imediatamente no vault

### CONVENCOES

- Wikilinks: `[[wiki/pagina]]`
- Frontmatter YAML: title, tags, sources, updated
- `log.md` e append-only. Fontes brutas (PRD.md, docs/) sao read-only
- Datas absolutas: `2026-04-05`. Portugues (Brasil)

---

## Regras de Ouro (resumo — detalhes em RULES.md)

### Mentalidade
1. **SEMPRE ser critico** — questionar premissas, verificar dados, nao assumir que funciona sem testar
2. **SEMPRE planejar antes de executar** — criar plano, avaliar paralelizacao com subagentes, obter aprovacao. Ver "Protocolo de Subagentes" em RULES.md
3. **SEMPRE auto-avaliar** — dar nota honesta para o proprio trabalho, identificar gaps

### Protecao
4. **NUNCA quebrar codigo em producao** — testar localmente antes de deploy. Se nao tem certeza, perguntar
5. **NUNCA reportar dados falsos** — so confirmar apos teste E2E completo
6. **HIGH RISK** — Nunca tocar ai-agent/index.ts, types.ts sem aprovacao explicita

### Qualidade
7. **NUNCA pular etapas de entrega** — Implementar → TypeScript (0 erros) → Testes (100%) → Auditoria → Commit → Documentar → Deploy
8. **NUNCA pular etapas de correcao** — Codigo → Validator → FAQ → Handoff (4 niveis, nunca pular)
9. **SYNC RULE** — Toda alteracao no AI Agent sincroniza 8 locais (ver RULES.md)

### Documentacao e Orquestracao
13. **SEMPRE dar nota** — Apos documentar, dar nota de 0-10 para: (a) qualidade do conteudo, (b) orquestracao entre arquivos, (c) estado do vault. Identificar gaps
14. **SEMPRE verificar limites** — Nenhum MD deve ter mais de 200 linhas. Se ultrapassar, particionar em arquivos por grupo funcional
15. **SEMPRE verificar referencias cruzadas** — index.md, log.md, decisoes-chave.md devem estar sincronizados. Dados desatualizados = bug de documentacao
16. **log.md max 200 linhas** — Ao ultrapassar, arquivar entradas antigas em wiki/log-arquivo-{periodo}.md

### Tecnico
10. **CORS** — Usar `getDynamicCorsHeaders(req)`. `ALLOWED_ORIGIN` secret obrigatorio
11. **Tags** — NUNCA tags vazias []. NUNCA opcoes numeradas. NUNCA magic strings
12. **Documentar** — Vault e parte do trabalho. Codigo sem documentacao e trabalho incompleto

## Commands

- `/prd` — PRD completo (modulos, tasks, roadmap, changelog)
- `/uazapi` — UAZAPI WhatsApp API reference

## PRD

`PRD.md` na raiz e a fonte de verdade para funcionalidades e versionamento.
