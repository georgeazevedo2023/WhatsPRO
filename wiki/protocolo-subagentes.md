---
title: Protocolo de Subagentes (Paralelização de Tarefas)
tags: [protocolo, subagentes, paralelizacao, planejamento]
sources: [RULES.md (extraído 2026-04-26)]
updated: 2026-04-26
---

# Protocolo de Subagentes — Paralelização de Tarefas

> Antes de executar qualquer tarefa não-trivial, SEMPRE avaliar se pode ser dividida em subagentes paralelos para agilizar. Apresentar ao usuário ANTES de executar.

## Passo 1 — Analisar a tarefa

- Quebrar a tarefa em sub-tarefas independentes
- Identificar dependências entre sub-tarefas (A depende de B? Ou são independentes?)
- Verificar se sub-tarefas podem **conflitar** (tocar no mesmo arquivo, mesma tabela, mesma função)

## Passo 2 — Propor plano ao usuário

Apresentar em formato tabela:

```
| # | Sub-tarefa | Subagente | Depende de | Conflita com | Tempo estimado |
|---|-----------|-----------|-----------|--------------|----------------|
| 1 | Explorar módulo X | Explore | Nenhum | Nenhum | ~30s |
| 2 | Explorar módulo Y | Explore | Nenhum | Nenhum | ~30s |
| 3 | Implementar X | Executor | 1 | 4 (mesmo arquivo) | ~2min |
| 4 | Implementar Y | Executor | 2 | 3 (mesmo arquivo) | ~2min |

Execução: Onda 1 (paralelo): #1 + #2. Onda 2 (sequencial): #3 depois #4.
Tempo total estimado: ~3min (vs ~5min sequencial = 40% mais rápido)
```

## Passo 3 — Regras de conflito

- **NUNCA** 2 subagentes editando o mesmo arquivo ao mesmo tempo
- **NUNCA** 2 subagentes fazendo migration no mesmo banco ao mesmo tempo
- Subagentes de **leitura** (Explore) podem rodar em paralelo sem limite
- Subagentes de **escrita** (Edit/Write) devem ser sequenciais se tocam mesmos arquivos
- Se houver conflito, organizar em **ondas**: Onda 1 (paralelo) → Onda 2 (paralelo) → ...

## Passo 4 — Reportar durante execução

- Informar início/fim de cada onda com tempo
- NÃO usar subagentes em tarefas triviais (<3 passos) ou 100% sequenciais

## Quando usar

| Cenário | Subagentes? |
|---------|-------------|
| Investigar 3+ áreas distintas do código | ✅ paralelo |
| Implementar 2 features independentes | ✅ ondas |
| Corrigir 1 bug em 1 arquivo | ❌ direto |
| Revisar PR | ❌ direto |
| Auditar codebase amplamente | ✅ paralelo |
| Refatorar 1 hook | ❌ direto |

## Links

- [[CLAUDE.md]] — orquestrador principal
- [[RULES.md]] — outras regras detalhadas
