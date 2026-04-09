---
title: Decisões-Chave
tags: [decisoes, regras, padroes, seguranca, funis]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-09
tags: [decisoes, regras, padroes, seguranca, funis, automacao, polls, perfis, nps]
---

# Decisões-Chave

## Regras de Integridade

- NUNCA reportar dados falsos ou inconsistentes
- NUNCA dar nota/score parcial e depois mudar para pior
- NUNCA dizer que algo funciona baseado em teste parcial
- NUNCA quebrar código em produção
- Se resultado contradiz anterior → explicar POR QUE mudou

## Protocolo de Entrega (6 passos — NUNCA pular)

1. **Implementar** — código funcional, sem `as any`, sem magic strings
2. **TypeScript** — `npx tsc --noEmit` = 0 erros
3. **Testes** — `npx vitest run` = 100%
4. **Auditoria** — arquivos proibidos, dados legados, RLS
5. **Commit** — mensagem descritiva (feat/fix/chore + módulo)
6. **Documentar** — CLAUDE.md + PRD.md + vault

## SYNC RULE (8 locais)

Ao alterar feature do AI Agent, sincronizar:
1. Banco (coluna + migration)
2. Types.ts (gen types)
3. Admin UI (campo editável)
4. ALLOWED_FIELDS (AIAgentTab.tsx)
5. Backend (ai-agent/index.ts)
6. Prompt (prompt_sections)
7. system_settings defaults
8. Documentação (CLAUDE.md + PRD.md)

## Padrões de Código

- `handleError()` para erros user-facing (nunca só console.error)
- CSS variables para cores (nunca hardcoded HSL)
- Hooks reutilizáveis quando padrão repete 2+ vezes
- `edgeFunctionFetch` para chamar edge functions
- STATUS_IA constantes — NUNCA magic strings
- `leadHelper.ts` para criar leads — NUNCA duplicar FIELD_MAP ou upsert de lead_profiles
- Tags de origem: sempre `origem:X` (campanha/formulario/bio) — padronizado em todos os sistemas
- `lead_profiles.origin` deve ser setado na criação do lead (bio/campanha/formulario/funil)
- Tag `funil:SLUG` — setada automaticamente por form-public, bio-public, whatsapp-webhook quando recurso pertence a um funil
- Handoff priority: profile > funnel > agent (D10) — profileData.handoff_message > funnelData.handoff_message > agent.handoff_message
- Funis sao camada de orquestracao — NUNCA duplicar logica dos modulos internos (campaigns, bio, forms). Funil aponta via FK.
- `funnelTemplates.ts` define defaults por tipo — kanban columns, bio buttons, campaign UTM, form template. Centralizado.
- `funnelData` carregado early (antes dos handoff triggers) no ai-agent para estar disponivel em todos os paths de handoff

## Segurança

- Token UAZAPI NUNCA no frontend
- Auth manual em todas edge functions
- Supabase Vault para secrets
- Media URLs diretas do UAZAPI (sem re-upload)

## CORS — Edge Functions (2026-04-08)

- **`getDynamicCorsHeaders(req)`** — CORS dinâmico que checa Origin vs whitelist + aceita `localhost:*` automaticamente
- **`browserCorsHeaders`** — CORS estático (backward-compatible), usa primeiro origin do `ALLOWED_ORIGIN`
- **`webhookCorsHeaders`** — wildcard `*` para webhooks (UAZAPI, n8n)
- Edge functions admin-* DEVEM usar `getDynamicCorsHeaders(req)` e `verify_jwt=false`
- `ALLOWED_ORIGIN` suporta comma-separated: `https://crm.wsmart.com.br,https://app.whatspro.com.br`

## Formato de Discussão de Decisões (2026-04-08)

Ao apresentar questões para o usuário decidir, SEMPRE usar:
1. **Contexto** — O que é e por que importa (didático)
2. **Problema** — O que decidir e implicações
3. **Solução** — Como funciona com exemplo concreto
4. **Casos de uso** — 4 exemplos reais
5. **Opções** — Alternativas + **recomendação** destacada
6. **Documentação** — Resposta documentada imediatamente no vault

## Arquitetura de UI — Funil é o Cockpit (D9, 2026-04-08)

- Motor de Automação + Funis Agênticos = ambos dentro do FunnelDetail
- AI Agent page = config GLOBAL (personalidade, catálogo, regras gerais, voz, validator)
- Funil page = config POR FUNIL (canais, formulário, automações, IA, config)
- Analogia: cérebro (AI Agent) é um só, mas cada situação (funil) tem seus próprios instintos e reflexos
- FunnelDetail: 5 tabs — Canais, Formulário, Automações (reflexos), IA (instintos), Config

## Motor de Automação — Regras (D8, 2026-04-08)

- **Modelo:** Gatilho > Condição > Ação (inspirado em Chatwoot/n8n)
- **UI:** Tab "Automações" dentro do FunnelDetail (NÃO é página separada)
- **7 gatilhos MVP:** card movido, enquete respondida, formulário completo, lead criado, conversa resolvida, tag adicionada, etiqueta aplicada
- **4 condições:** sempre, tag contém, funil é, horário comercial
- **5 ações:** enviar enquete, enviar mensagem, mover card, adicionar tag, ativar IA/transbordo
- Tabela: `automation_rules` (funnel_id FK, trigger_type, condition_type, action_type, configs JSONB)
- Backend: `automationEngine.ts` shared — chamado por webhook, ai-agent, form-bot, kanban move

## Regras de Formatação de Opções (D7, 2026-04-08)

- **NUNCA** enviar opções numeradas ("1-Casa, 2-Apto, 3-Comercial")
- **SEMPRE** listar nomes limpos: "Casa, Apartamento, Sala Comercial"
- Vale para enquetes nativas, campos select do form-bot, e qualquer listagem de opções

## Agent Profiles — Perfis de Atendimento (D10, 2026-04-09)

- **Conceito:** Pacote reutilizável de prompt + regras de handoff. Substitui sub-agents + funnel_prompt.
- **Tabela:** `agent_profiles` (agent_id FK, name, slug, prompt, handoff_rule, handoff_max_messages, handoff_department_id, handoff_message, is_default, enabled)
- **Prioridade:** `profileData > funnelData > agent` em TODOS os paths de handoff (trigger, message_limit, department)
- **Injeção no prompt:** `<profile_instructions>` como ÚLTIMA seção (prioridade máxima)
- **Roteamento:** funil.profile_id → perfil do funil. Sem funil → perfil is_default=true do agente.
- **Backward compat:** Sub-agents (TAG_TO_MODE) só rodam quando `!profileData`. funnel_prompt é fallback quando perfil não tem prompt.
- **Admin:** ProfilesConfig na tab Inteligência. FunnelDetail tab IA = dropdown de perfil.
- **Inspiração:** Intercom Fin (Roles + Procedures)

## Arquivos HIGH RISK (nunca tocar sem aprovação)

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts`

## Links

- [[wiki/erros-e-licoes]] — Erros para não repetir
- [[wiki/ai-agent]] — Regras do agente
- [[wiki/arquitetura]] — Stack
