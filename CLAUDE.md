# WhatsPRO - CRM Multi-Tenant WhatsApp

> Plataforma multi-tenant de atendimento WhatsApp (helpdesk), CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automacao. React + Supabase + UAZAPI. Producao: crm.wsmart.com.br

## Arquivos de Suporte (carregar sob demanda)

| Arquivo | Quando ler | O que contem |
|---------|-----------|--------------|
| `RULES.md` | Antes de implementar qualquer feature | Regras obrigatorias, integridade, sequencia de correcao AI Agent, entrega 6 passos, SYNC RULE 8 itens, CORS, AI Agent, qualidade, documentacao |
| `ARCHITECTURE.md` | Quando precisa entender a stack | Tech stack, edge functions, deploy, modulos, roles |
| `PATTERNS.md` | Antes de codificar | Padroes por area (UAZAPI, AI Agent, Helpdesk, Leads, Campanhas, DB) |
| `AGENTS.md` | Onboarding rapido / contexto resumido | Versao concisa em ingles para agentes externos: stack, features, edge functions, padroes |
| `PRD.md` | Apos cada feature ou consulta de versao | Fonte de verdade — modulos, changelog versionado, roadmap. Atualizar com nova entrada de versao apos shipar feature |
| `wiki/protocolo-subagentes.md` | Antes de tarefas nao-triviais | Como dividir em ondas paralelas, regras de conflito |
| `wiki/deploy-checklist.md` | Antes de qualquer DEPLOY | Checklist obrigatorio de pre-deploy |
| `wiki/casos-de-uso/*-detalhado.md` | Quando precisa detalhe de funcionalidade | 19 wikis dual (didatico + tecnico) cobrindo modulos do produto |
| `wiki/fluxos-*.md` | Quando trabalhar no Fluxos v3.0 (M18) | Visao, params (atendimento, inteligencia, entrada, biolink), servicos, detector intents, wireframes |

---

## Vault Obsidian — Cerebro Persistente

Este projeto usa um vault Obsidian como memoria de longo prazo. A IA DEVE usar o vault para ler, consultar e manter as paginas wiki atualizadas. Vault root = raiz do projeto. Configurado em `.obsidian/` (filtra src/, supabase/, planning/, claude/).

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
5. **Atualizar `PRD.md`** — Se shipou feature, adicionar entrada no Changelog
6. **Atualizar `index.md`** — Se criou wiki nova
7. **Informar o usuario** — Resumo do que foi documentado + nota 0-10

### COMANDOS DO USUARIO

| O usuario diz | O que fazer |
|---------------|-------------|
| "leia o vault" / "contexto" | Protocolo de inicio (5 passos) → resumo do estado |
| "contexto geral" | Ler index + visao-produto + arquitetura + roadmap → resumo completo |
| "roadmap" / "status" | Ler roadmap + log → fases, progresso, bloqueios |
| "o que falta?" | Ler roadmap → listar so pendente por fase |
| "documentou?" | Auditar vault (200 linhas, refs cruzadas) + corrigir gaps |
| "fim de sessao" | Protocolo de fim (7 passos + nota) |
| "fluxos" / "design" | Ler wiki/fluxos-visao-arquitetura + params relevantes |
| "parametros" | Ler wiki/fluxos-params-* (atendimento, inteligencia, entrada, biolink) |

### QUANDO ATUALIZAR O VAULT

- **Apos COMMIT:** log.md + wiki/roadmap.md
- **Apos FEATURE:** wiki relevante + index (se nova pagina) + log.md + **PRD.md changelog**
- **Apos BUG:** wiki/erros-e-licoes.md (causa + correcao + regra) + log.md
- **Apos DECISAO:** wiki/decisoes-chave.md + log.md
- **Antes de DEPLOY:** seguir [[wiki/deploy-checklist]] → registrar em log.md

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
- Datas absolutas: `2026-04-26` (formato YYYY-MM-DD). Portugues (Brasil)

---

## Regras de Ouro (resumo — detalhes em RULES.md)

### Mentalidade
1. **SEMPRE ser critico** — questionar premissas, verificar dados, nao assumir que funciona sem testar
2. **SEMPRE planejar antes de executar** — criar plano, avaliar paralelizacao com subagentes ([[wiki/protocolo-subagentes]]), obter aprovacao
3. **SEMPRE auto-avaliar** — dar nota honesta para o proprio trabalho, identificar gaps

### Protecao
4. **NUNCA quebrar codigo em producao** — testar localmente antes de deploy. Se nao tem certeza, perguntar
5. **NUNCA reportar dados falsos** — so confirmar apos teste E2E completo
6. **HIGH RISK** — Nunca tocar ai-agent/index.ts, types.ts, e2e-test/index.ts, ai-agent-playground/index.ts sem aprovacao explicita

### Qualidade
7. **NUNCA pular etapas de entrega** — Implementar → TypeScript (0 erros) → Testes (100%) → Auditoria → Commit → Documentar → Deploy
8. **NUNCA pular etapas de correcao AI Agent** — Codigo → Validator → FAQ → Handoff (4 niveis, nunca pular)
9. **SYNC RULE** — Toda alteracao no AI Agent sincroniza 8 locais (ver RULES.md)

### Tecnico
10. **CORS** — Usar `getDynamicCorsHeaders(req)`. `ALLOWED_ORIGIN` secret obrigatorio
11. **Tags** — NUNCA tags vazias []. NUNCA opcoes numeradas. NUNCA magic strings
12. **Documentar** — Vault e parte do trabalho. Codigo sem documentacao e trabalho incompleto

### Documentacao e Orquestracao
13. **SEMPRE dar nota 0-10** apos documentar: (a) qualidade do conteudo, (b) orquestracao entre arquivos, (c) estado do vault. Identificar gaps
14. **Max 200 linhas/MD** — particionar em arquivos por grupo funcional se ultrapassar
15. **SEMPRE verificar referencias cruzadas** — index.md, log.md, decisoes-chave.md devem estar sincronizados
16. **log.md max 200 linhas** — arquivar entradas antigas em wiki/log-arquivo-{periodo}.md
17. **Apos FEATURE: atualizar PRD.md** com nova entrada no Changelog (semver) — fonte de verdade do projeto

## Commands

- `/prd` — PRD completo (modulos, tasks, roadmap, changelog)
- `/uazapi` — UAZAPI WhatsApp API reference

## PRD

`PRD.md` na raiz e a fonte de verdade para funcionalidades e versionamento. SEMPRE adicionar entrada no Changelog apos shipar feature (regra 17).
