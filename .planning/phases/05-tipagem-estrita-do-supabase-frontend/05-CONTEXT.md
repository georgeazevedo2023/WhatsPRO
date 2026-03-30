# Phase 5: Tipagem Estrita do Supabase (Frontend) — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Substituir `any` explícitos nos 4 arquivos identificados no ROADMAP, criar interfaces tipadas para os campos Json das tabelas do agente (business_hours, extraction_fields, follow_up_rules, sub_agents), e habilitar `strict: true` no `tsconfig.app.json`.

Escopo estrito: `LeadDetail.tsx`, `Leads.tsx`, `UsersManagement.tsx`, `AIAgentPlayground.tsx` + `PlaygroundE2eTab.tsx` + campos Json do agente. Zero mudanças de comportamento. Zero mudanças de backend.

Os ~40 usos de `any` em outros arquivos (kanban, helpdesk, useCampaigns, KnowledgeConfig, etc.) ficam **fora** do escopo desta fase — serão abordados em fase futura.

</domain>

<decisions>
## Implementation Decisions

### Escopo dos Arquivos

- **D-01:** Escopo fixo nos 4 arquivos do ROADMAP:
  - `src/pages/dashboard/LeadDetail.tsx` — contact state, lead_profile, conversas, kanban
  - `src/pages/dashboard/Leads.tsx` — tag filter
  - `src/pages/dashboard/UsersManagement.tsx` — instance info
  - `src/pages/dashboard/AIAgentPlayground.tsx` — e2eResults, e2eLiveSteps, supabase as any
- **D-02:** `src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx` **incluído** — props `e2eResults: any[]` e `e2eLiveSteps: any[]` devem receber os novos tipos do Playground.
- **D-03:** Todos os outros arquivos com `any` (kanban, helpdesk, useCampaigns, LeadHistorySection, etc.) ficam **excluídos** desta fase.

### Tratamento de catch (err: any)

- **D-04:** `catch (err: any)` → `catch (err: unknown)` + type guard `if (err instanceof Error)`. Prática moderna do TypeScript. Aplica a TODOS os arquivos dentro do escopo (LeadDetail, AIAgentPlayground, etc.).

### Playground: E2e Types

- **D-05:** Criar interfaces `E2eResult` e `E2eLiveStep` em `src/types/playground.ts` (arquivo já criado na Fase 4). Essas interfaces tipam as respostas do endpoint `e2e-test`. Campos a inferir: `{ scenario_id, scenario_name, passed, tools_used, response_text, status }` para E2eResult; `{ id, status, message, ... }` para E2eLiveStep — executor deve verificar o payload real retornado por `e2e-test/index.ts`.
- **D-06:** `AIAgentPlayground.tsx` usa `useState<E2eResult[]>` e `useState<E2eLiveStep[]>`. Props correspondentes em `PlaygroundE2eTab` são atualizadas.

### Tipos para Campos Json do Supabase

- **D-07:** Criar 4 interfaces para os campos Json do agente:
  - `BusinessHours` — `{ start: string; end: string }`
  - `ExtractionField` — `{ key: string; label: string; enabled: boolean }`
  - `FollowUpRule` — `{ days: number; message: string }`
  - `SubAgentConfig` — `{ mode: string; prompt: string }`
- **D-08:** Localização: `src/types/agent.ts` (novo arquivo, separado de `playground.ts` por ser domínio diferente). Exportar de lá para uso em LeadDetail, AIAgentTab, configuração do agente.

### strict: true

- **D-09:** Habilitar `strict: true` no `tsconfig.app.json` ao **final** do plano, depois de todos os `any` do escopo estarem substituídos. Estratégia incremental: primeiro substituir os `any` explícitos nos 4 arquivos, depois ligar o strict e corrigir erros residuais que ele revelar (dentro do escopo dos 4 arquivos apenas).
- **D-10:** Se `strict: true` revelar erros em arquivos **fora** do escopo desta fase — **não corrigir**. Usar `// @ts-ignore` apenas se absolutamente necessário para que o build passe, mas não adicionar sem documentar. Preferencialmente: mover a correção para Phase 6 ou 7.

### Claude's Discretion

- Nomes de campos internos de `E2eResult` e `E2eLiveStep`: Claude verifica o payload real em `supabase/functions/e2e-test/index.ts` antes de definir.
- Como lidar com `.from('table_name' as any)` em AIAgentPlayground e LeadDetail (tabelas que não estão no types.ts gerado): Claude decide entre regenerar types via `supabase gen types` ou criar cast explícito tipado — verificar quais tabelas existem vs. faltam.
- Se `strict: true` causar >10 erros fora do escopo, Claude pode deixar `noImplicitAny: true` (mais suave) em vez de `strict: true` completo e documentar a decisão no SUMMARY.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquivos de escopo direto
- `src/pages/dashboard/LeadDetail.tsx` — 200+ LOC com `any`; contact state, lead_profile, kanban, extraction_fields
- `src/pages/dashboard/Leads.tsx` — tag filter como `any`
- `src/pages/dashboard/UsersManagement.tsx` — instance info como `any`
- `src/pages/dashboard/AIAgentPlayground.tsx` — e2eResults/e2eLiveSteps `any[]`, `supabase as any`
- `src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx` — props `any[]`

### Tipos existentes (referência e extensão)
- `src/types/playground.ts` — criado na Fase 4; E2eResult e E2eLiveStep serão adicionados aqui
- `src/integrations/supabase/types.ts` — campos Json: `business_hours`, `extraction_fields`, `follow_up_rules`, `sub_agents` em `ai_agents` rows (linhas 305-332 aprox.)

### Destinos novos (a criar)
- `src/types/agent.ts` — BusinessHours, ExtractionField, FollowUpRule, SubAgentConfig

### Edge function para inferir E2e types
- `supabase/functions/e2e-test/index.ts` — retorno real do endpoint; usar para definir E2eResult + E2eLiveStep

### Config
- `tsconfig.app.json` — `strict: false`, `noImplicitAny: false` (estado atual); alvo: `strict: true`

</canonical_refs>

<code_context>
## Existing Code Insights

### Estado atual do tsconfig.app.json
```json
{
  "strict": false,
  "noImplicitAny": false,
  "noUnusedLocals": true,
  "noUnusedParameters": false
}
```

### Padrão dominante de `any` em LeadDetail.tsx
```typescript
// .from() com cast — indica tabela não tipada no types.ts gerado
.from('lead_profiles' as any)
.from('ai_agents' as any)
.from('ai_agent_logs' as any)

// Acessos de campo sem tipo
const lp = (profile || {}) as any;
(kanbanCards[0] as any).kanban_columns.name
log.tool_calls as any[]
```

### Campos Json em types.ts
```typescript
// ai_agents table (Row type)
business_hours: Json | null   // → BusinessHours | null
extraction_fields: Json | null // → ExtractionField[] | null
follow_up_rules: Json | null   // → FollowUpRule[] | null
sub_agents: Json | null        // → SubAgentConfig[] | null
```

### PlaygroundE2eTab props atuais
```typescript
// PlaygroundE2eTab.tsx:15-17
e2eResults: any[];
e2eLiveSteps: any[];
```

### Padrão catch existente (a substituir)
```typescript
// antes:
} catch (err: any) {
  setError(err.message);
}
// depois:
} catch (err: unknown) {
  setError(err instanceof Error ? err.message : 'Erro desconhecido');
}
```

</code_context>

<specifics>
## Specific Ideas

- Ao criar `src/types/agent.ts`, exportar também um type helper `JsonField<T>` = `T | null` para simplificar `business_hours: JsonField<BusinessHours>` nos componentes que fazem cast do campo Json — evita repetição de `| null`
- Para tabelas como `ai_agents` que aparecem como `.from('ai_agents' as any)`: verificar se constam no `types.ts` gerado — provavelmente estão (linha 305+ tem `business_hours`) mas o `as any` foi adicionado porque o acesso era via chave dinâmica. Pode ser que a solução seja simplesmente remover o `as any` após confirmar.
- O `supabase as any` em AIAgentPlayground linha 62 provavelmente veio de uma tabela nova que ainda não estava no types.ts na época — verificar se `ai_agents` já está no types.ts e se o cast ainda é necessário.

</specifics>

<deferred>
## Deferred Ideas

- Substituir `any` nos outros 15+ arquivos fora do escopo (kanban, helpdesk, useCampaigns, KnowledgeConfig, LeadHistorySection, etc.) — nova fase após esta
- Regeneração completa do `types.ts` via `supabase gen types typescript` — pode ser feita se a maioria dos casts `as any` em tabelas forem por tipos desatualizados

</deferred>

---

*Phase: 05-tipagem-estrita-do-supabase-frontend*
*Context gathered: 2026-03-30 via /gsd:discuss-phase 5*
