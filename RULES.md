# WhatsPRO — Regras Detalhadas

> Arquivo de regras comportamentais para o Claude Code. Carregado sob demanda pelo CLAUDE.md.
> Se uma regra esta aqui, e OBRIGATORIA — nao e sugestao.

---

## Mentalidade e Postura

- **SEMPRE ser critico** — questionar premissas, verificar dados, nao assumir que funciona sem testar. Desconfiar do proprio resultado ate ter evidencia
- **SEMPRE planejar antes de executar** — criar plano detalhado e obter aprovacao do usuario ANTES de qualquer tarefa ou sprint. NUNCA comecar a codar sem plano aprovado. Ver "Protocolo de Subagentes" abaixo
- **SEMPRE auto-avaliar** — dar nota honesta para o proprio trabalho. Se fez 8/10, dizer 8/10 e explicar o que falta. NUNCA inflar notas
- **SEMPRE documentar automaticamente** — apos cada bug fix, feature ou decisao, atualizar o vault SEM esperar o usuario pedir. Documentacao e parte do trabalho, nao bonus
- **NUNCA quebrar codigo em producao** — se nao tem certeza que funciona, perguntar antes de deployar. Testar localmente quando possivel. Na duvida, nao deployar

---

## Protocolo de Subagentes (Paralelizacao de Tarefas)

Antes de executar qualquer tarefa nao-trivial, SEMPRE avaliar se pode ser dividida em subagentes paralelos para agilizar. Apresentar ao usuario ANTES de executar:

### Passo 1 — Analisar a tarefa
- Quebrar a tarefa em sub-tarefas independentes
- Identificar dependencias entre sub-tarefas (A depende de B? Ou sao independentes?)
- Verificar se sub-tarefas podem **conflitar** (tocar no mesmo arquivo, mesma tabela, mesma funcao)

### Passo 2 — Propor plano ao usuario
Apresentar em formato tabela:

```
| # | Sub-tarefa | Subagente | Depende de | Conflita com | Tempo estimado |
|---|-----------|-----------|-----------|--------------|----------------|
| 1 | Explorar modulo X | Explore | Nenhum | Nenhum | ~30s |
| 2 | Explorar modulo Y | Explore | Nenhum | Nenhum | ~30s |
| 3 | Implementar X | Executor | 1 | 4 (mesmo arquivo) | ~2min |
| 4 | Implementar Y | Executor | 2 | 3 (mesmo arquivo) | ~2min |

Execucao: Onda 1 (paralelo): #1 + #2. Onda 2 (sequencial): #3 depois #4.
Tempo total estimado: ~3min (vs ~5min sequencial = 40% mais rapido)
```

### Passo 3 — Regras de conflito
- **NUNCA** 2 subagentes editando o mesmo arquivo ao mesmo tempo
- **NUNCA** 2 subagentes fazendo migration no mesmo banco ao mesmo tempo
- Subagentes de **leitura** (Explore) podem rodar em paralelo sem limite
- Subagentes de **escrita** (Edit/Write) devem ser sequenciais se tocam mesmos arquivos
- Se houver conflito, organizar em **ondas**: Onda 1 (paralelo) → Onda 2 (paralelo) → ...

### Passo 4 — Reportar durante execucao
- Informar inicio/fim de cada onda com tempo. NAO usar subagentes em tarefas triviais (<3 passos) ou 100% sequenciais.

---

## Regras de Integridade de Dados

- NUNCA reportar dados falsos ou inconsistentes
- NUNCA dar nota/score parcial e depois mudar para pior — avaliar somente com dados completos
- NUNCA dizer que algo funciona baseado em teste parcial — so confirmar apos teste E2E completo
- NUNCA quebrar codigo em producao — testar localmente antes de deploy quando possivel
- Se um resultado contradiz resultado anterior, explicar POR QUE mudou antes de dar novo resultado
- Auditorias e notas devem ser baseadas no cenario mais completo e realista, nao em testes isolados

---

## Sequencia de Correcao de Erros do AI Agent (4 NIVEIS — NUNCA PULAR)

Quando um teste E2E detectar erro no comportamento do agente, corrigir NESTA ORDEM:

1. **Codigo + Prompt hardcoded** — bug no fluxo, logica errada, guard faltando. Fix no index.ts ou _shared/
2. **Instrucao no Validator Agent** — validator nao detectou o erro? Adicionar regra no validatorAgent.ts (leadQuestions, catalogPrices, nome exato). Validator REWRITE corrige antes de enviar
3. **FAQ/Q&A na Knowledge Base** — textos genericos, perguntas cotidianas, respostas que o LLM erra repetidamente. Inserir na ai_agent_knowledge como FAQ
4. **Fallback: Mensagem de transbordo + Handoff** — ULTIMO recurso. Lead NUNCA fica sem resposta

Regra especial: **frustracao + handoff no mesmo batch = handoff direto.** Nao tenta responder empatia + produto — transfere imediatamente.

NUNCA pular etapas. Se o erro e de codigo, nao resolver com FAQ. Handoff e o ULTIMO recurso.

---

## Protocolo Obrigatorio de Entrega (6 PASSOS — NUNCA PULAR)

Toda feature implementada DEVE seguir esta sequencia completa:

1. **Implementar** — codigo funcional, sem `as any`, sem magic strings
2. **TypeScript** — `npx tsc --noEmit` deve retornar 0 erros
3. **Testes** — escrever testes para o novo codigo. `npx vitest run` deve passar 100%
4. **Auditoria** — nenhum arquivo proibido tocado, dados legados preservados, RLS correto
5. **Commit** — mensagem descritiva com escopo (feat/fix/chore + modulo)
6. **Documentar** — atualizar vault (log.md + wikis afetadas + CLAUDE.md se necessario)

NUNCA reportar feature como concluida sem todos os 6 passos verificados.

---

## Regra de Consistencia (SYNC RULE — 8 ITENS)

Toda alteracao em campo configuravel, regra do agente, ou comportamento DEVE ser sincronizada em TODOS os 8 locais:

1. **Banco (coluna)** — campo existe em `ai_agents`? Default correto? Migration criada?
2. **Types.ts** — campo adicionado em Row, Insert e Update? (so via `npx supabase gen types`)
3. **Admin UI** — campo visivel e editavel no painel? Label e descricao claras?
4. **ALLOWED_FIELDS** — campo listado em `AIAgentTab.tsx` ALLOWED_FIELDS para auto-save?
5. **Backend (ai-agent)** — campo lido e usado no `index.ts`? Logica implementada?
6. **Prompt (prompt_sections)** — regra refletida no system prompt? Variavel template se aplicavel?
7. **system_settings defaults** — default atualizado para novos agentes?
8. **Documentacao** — vault atualizado?

Se QUALQUER um dos 8 itens nao estiver sincronizado, a feature esta INCOMPLETA.

---

## Arquivos HIGH RISK — Nunca Tocar Sem Aprovacao

- `supabase/functions/ai-agent/index.ts` (~2600 linhas)
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts` (so via `npx supabase gen types`, nunca editar manual)

---

## Regras de CORS e Deploy

- Edge functions browser-facing DEVEM usar `getDynamicCorsHeaders(req)` — NUNCA `browserCorsHeaders` (estatico)
- `ALLOWED_ORIGIN` DEVE existir nos Secrets do Supabase (atual: `https://crm.wsmart.com.br`)
- Sem `ALLOWED_ORIGIN`, CORS usa fallback errado e bloqueia TODAS as requisicoes do frontend
- `verify_jwt = false` apenas em: webhooks (whatsapp-webhook, fire-outgoing-webhook, go, health-check) e publicas (form-public)
- Functions internas (ai-agent, debounce, transcribe-audio) DEVEM ter `verify_jwt = false` (chamadas por process-jobs)
- WEBHOOK_SECRET NUNCA obrigatorio — UAZAPI nao suporta auth headers

---

## Regras do AI Agent

- status_ia: usar constantes STATUS_IA.LIGADA/DESLIGADA/SHADOW — NUNCA magic strings
- Clear context: tags = `['ia_cleared:TIMESTAMP']` — NUNCA `[]` (tags vazias quebra handoff counter)
- Greeting: enviar E continuar pro LLM se lead fez pergunta real. Parar se so "oi"
- Shadow mode: NUNCA sobrescrever full_name existente (protecao nome vendedor)
- Empty LLM response = silencio — NUNCA enviar fallback ao lead
- Handoff text discard: lead recebe so handoff_message, texto LLM descartado
- Debounce: NO RETRY em 500 (gateway timeout, funcao ainda roda)
- Media insert DEVE chamar broadcastEvent() — sem isso helpdesk nao exibe
- 1 produto = send_media (foto), 2+ = send_carousel
- NUNCA enviar opcoes numeradas ("1-Casa, 2-Apto") — sempre nomes limpos
- leadName: usar lead_profiles.full_name ONLY, nunca contact.name (WhatsApp pushName)
- Handoff so em: pedido explicito, sentimento negativo persistente, pergunta sem resposta. Preco/desconto/frete = agente responde
- NUNCA dizer "nao encontrei/nao temos/sem estoque" ao lead — tool returns marcados [INTERNO]
- leadHelper.ts compartilhado: NUNCA duplicar FIELD_MAP localmente
- Prioridade handoff: profileData > funnelData > agent

---

## Ciclo Obrigatorio de Qualidade (NUNCA PULAR NENHUMA ETAPA)

Toda tarefa segue este ciclo completo:

```
1. PLANEJAR → criar plano + obter aprovacao
2. IMPLEMENTAR → codigo funcional, sem as any, sem magic strings
3. VERIFICAR TIPOS → npx tsc --noEmit = 0 erros
4. TESTAR → npx vitest run = 100% passando
5. AUDITAR → arquivos proibidos? dados legados? RLS correto?
6. COMMITAR → mensagem descritiva (feat/fix/chore + modulo)
7. DOCUMENTAR → vault (log.md + wikis afetadas + erros-e-licoes se bug)
8. DEPLOY → se aplicavel, seguir wiki/deploy-checklist.md
```

- Etapa 1 pulavel em tarefas triviais. Etapas 2-7 SEMPRE obrigatorias. Etapa 8 so se pedido.
- Se QUALQUER etapa falhar, parar e corrigir. NUNCA reportar sem todas verificadas.

---

## Protocolo de Documentacao, Notas e Orquestracao

### Apos documentar no vault, SEMPRE:
1. **Nota conteudo (0-10):** Qualidade, completude, exemplos
2. **Nota orquestracao (0-10):** Referencias cruzadas, index/log/decisoes sincronizados
3. **Nota vault (0-10):** Arquivos < 200 linhas, dados atualizados, sem obsoleto
4. **Gaps:** O que falta, o que desatualizou

### Limites obrigatorios:
- **Max 200 linhas/arquivo** — ultrapassou? particionar por grupo funcional
- **log.md max 200** — arquivar antigo em `wiki/log-arquivo-{periodo}.md`
- **index.md** — agrupar wikis por categoria (produto, operacional, design)

### Checklist automatico (verificar apos cada documentacao):
- index.md referencia nova wiki? log.md tem entrada? decisoes registradas?
- CLAUDE.md precisa de atualizacao? Algum arquivo > 200 linhas? Dados desatualizados?
- Se qualquer item falha → corrigir ANTES de reportar

### Iniciativa proativa:
A IA deve corrigir ou sugerir melhorias SEM esperar o usuario pedir quando detectar: arquivo > 200 linhas, info desatualizada, falta de referencia cruzada, log crescendo.

---

## Convencoes de Codigo

- Wikilinks: `[[wiki/pagina]]`
- Frontmatter YAML: title, tags, sources, updated
- `log.md` e append-only (arquivar quando > 200 linhas)
- Fontes brutas (PRD.md, docs/) sao read-only
- Datas absolutas: `2026-04-05`
- Portugues (Brasil) com acentuacao correta
