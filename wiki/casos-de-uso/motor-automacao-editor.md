---
title: Motor de Automacao — Editor Visual e CRUD de Regras
tags: [automacao, editor, ui, crud, hooks, regras, detalhado]
sources: [src/components/funnels/AutomationRuleEditor.tsx, src/hooks/useAutomationRules.ts]
updated: 2026-05-04
---

# Motor de Automacao — Editor e CRUD (2 Sub-Funcionalidades)

> Esta sub-wiki cobre a **interface de gerenciamento** das regras de automacao: o dialog visual para criar/editar regras (AutomationRuleEditor) e os 4 hooks React Query que fazem o CRUD via Supabase. Inclui tambem a arvore de componentes e tabelas do banco.
>
> Voltar ao indice: [[wiki/casos-de-uso/motor-automacao-detalhado]]

---

## 9.5 Editor Visual de Regras (AutomationRuleEditor)

**O que e:** Dialog no FunnelDetail (tab Automacoes) para criar e editar regras visualmente. Tem 4 secoes: nome, QUANDO (gatilho), SE (condicao), ENTAO (acao).

**Layout:**
1. **Nome da regra** + toggle ativado/desativado
2. **QUANDO** (dropdown de gatilho) + campos condicionais:
   - Card movido → campo UUID da coluna
   - Formulario → campo slug do formulario
   - Tag adicionada → campo texto da tag
   - Etiqueta → campo texto da etiqueta
   - Demais → sem campos extras
3. **SE** (dropdown de condicao) + campos condicionais:
   - Sempre → sem campos
   - Tag contem → campo texto da tag
   - Horario comercial → dropdown "Dentro/Fora"
   - Funil e → sem campos (nao exposto na UI)
4. **ENTAO** (dropdown de acao) + campos condicionais:
   - Enviar mensagem → textarea
   - Mover card → campo UUID da coluna
   - Adicionar tag → campo texto
   - Ativar IA → sem campos
   - Transferir → campo UUID do departamento
   - Enviar enquete → pergunta + lista de opcoes dinamica (2-12)

> **Tecnico:** Componente `AutomationRuleEditor.tsx`. Dialog max-w-lg, max-h-90vh, overflow-y-auto. Estado local com useState. Config builders: `buildTriggerConfig()`, `buildConditionConfig()`, `buildActionConfig()` serializam estado para JSONB. Save: `useCreateAutomationRule()` (novo) ou `useUpdateAutomationRule()` (editar). Toast success/error. Poll options: array dinamico com add/remove, min 2 max 12.

---

## 9.6 CRUD de Regras (Hooks)

**O que e:** 4 hooks React para gerenciar regras de automacao via Supabase.

| Hook | Acao | Query |
|------|------|-------|
| `useAutomationRules(funnelId)` | Listar regras do funil | SELECT * WHERE funnel_id ORDER BY position |
| `useCreateAutomationRule()` | Criar nova regra | INSERT com defaults (enabled=true, position=0) |
| `useUpdateAutomationRule()` | Editar regra existente | UPDATE WHERE id |
| `useDeleteAutomationRule()` | Excluir regra | DELETE WHERE id |

Todos invalidam o cache React Query `['automation_rules', funnelId]` apos mutacao.

> **Tecnico:** Hook `useAutomationRules.ts`. Tipos: `AutomationRule` interface com todos os campos. `CreateAutomationRuleInput` para criacao. TanStack React Query: useQuery + useMutation. Invalidacao: `queryClient.invalidateQueries(['automation_rules', funnelId])`. Toast: sonner.

---

## Arvore de Componentes

```
FunnelDetail.tsx → Tab "Automacoes"
+-- Lista de regras (useAutomationRules)
|   +-- Card por regra: nome, toggle, gatilho→condicao→acao
|   +-- Botoes: editar, excluir
+-- AutomationRuleEditor.tsx (dialog)
    +-- Nome + toggle ativado
    +-- QUANDO: Select gatilho + sub-campos condicionais
    +-- SE: Select condicao + sub-campos condicionais
    +-- ENTAO: Select acao + sub-campos condicionais
    +-- Botoes: cancelar, salvar
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `automation_rules` | Regras (funnel_id FK, trigger/condition/action type+config JSONB, enabled, position) |
| `notifications` | Notificacoes para gerentes (NPS ruim) |

---

## Links Relacionados

- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Indice das 9 sub-funcionalidades
- [[wiki/casos-de-uso/motor-automacao-componentes]] — Gatilhos, condicoes, acoes
- [[wiki/casos-de-uso/motor-automacao-execucao]] — Fluxo de execucao, NPS, erros
- [[wiki/casos-de-uso/funis-detalhado]] — Funis onde as regras vivem (tab Automacoes)

---

*Rev 1 (2026-05-04): Sub-wiki tematica criada a partir do particionamento de motor-automacao-detalhado.md (regra 14, max 200 linhas).*
