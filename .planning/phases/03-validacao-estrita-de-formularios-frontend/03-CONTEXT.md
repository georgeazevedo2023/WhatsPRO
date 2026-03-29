# Phase 3: Validação Estrita de Formulários (Frontend) — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Adicionar validação Zod nos painéis de configuração do AI Agent para impedir que dados inválidos cheguem ao banco. Escopo estrito: `src/components/admin/ai-agent/` (GuardrailsConfig, BrainConfig, RulesConfig, VoiceConfig, ExtractionConfig) + `src/pages/dashboard/Settings.tsx` + `BlockedNumbersConfig`.

Sem mudanças de UI além de mostrar erros inline. Sem novos painéis, sem novos campos. Zero mudanças de backend.

</domain>

<decisions>
## Implementation Decisions

### Arquitetura de Validação

- **D-01:** Schemas Zod ficam **centralizados no AIAgentTab** — um schema (objeto Zod parcial) por área de painel (brain, rules, guardrails, voice, extraction). Cada schema define apenas os campos com range/formato, não o objeto de agente inteiro.
- **D-02:** Validação acontece dentro de `handleChange` no AIAgentTab, **antes** de enfileirar o debounce do auto-save. Se `schema.safeParse(updates)` falhar → acumula erros em estado `fieldErrors`, não enfileira auto-save.
- **D-03:** AIAgentTab passa `fieldErrors: Record<string, string>` como prop para cada painel afetado. Painéis exibem o erro inline no campo correspondente (sem react-hook-form — só `useState` local existente + prop errors).
- **D-04:** Bloqueio do auto-save é **total** — se qualquer campo do config em memória for inválido, `doSave` não dispara. Guard simples: `if (hasErrors) return` antes do `setTimeout`.

### Display de Erros

- **D-05:** Erros aparecem **imediatamente no onChange** (não onBlur). Assim que o campo fica inválido, o erro é mostrado; assim que fica válido, o erro some.
- **D-06:** Exibição: `<p className="text-destructive text-xs mt-1">{fieldErrors['campo']}</p>` abaixo do Input/Textarea afetado. Usar `text-destructive` (token Tailwind do shadcn já definido). Não usar `FormMessage` do RHF — seria overhead sem useForm.

### Schemas por Painel

- **D-07 — BrainConfig:** `temperature` (0.0–2.0), `max_tokens` (1–8192), `model` (enum dos modelos válidos — derivar da lista existente em BrainConfig.tsx)
- **D-08 — RulesConfig:** `handoff_cooldown_minutes` (5–1440), `max_lead_messages` (1–50)
- **D-09 — GuardrailsConfig:** `max_discount_percent` (0–100), `blocked_phrases` (array não-vazio se habilitado — Claude's discretion se o campo é obrigatório ou opcional)
- **D-10 — VoiceConfig:** `voice_max_text_length` (10–500)
- **D-11 — ExtractionConfig:** key customizada — regex `^[a-z][a-z0-9_]*$` (alfanumérico lowercase, começa com letra). Sanitização inline existente (linha 83) é mantida como pré-processamento; Zod valida o resultado sanitizado.

### Validação de Telefone

- **D-12 — Settings.tsx (`recipient_number`):** Regex brasileiro — `^\d{10,13}$` (DDD + número, com ou sem DDI 55). Se o campo estiver preenchido mas inválido, mostrar erro inline e desabilitar o botão de salvar.
- **D-13 — BlockedNumbersConfig (`blocked_numbers`):** Melhorar o guard existente `num.length >= 10` para `^\d{10,15}$` (aceita nacional e internacional). Claude's discretion para o regex exato.

### Claude's Discretion

- Ordem de prioridade de erros quando múltiplos campos inválidos: mostrar todos os erros simultaneamente (não sequencial)
- Se `blocked_phrases` estiver vazio e o campo de guardrails estiver habilitado: Claude decide se valida ou não (pode ser campo opcional)
- Regex exato para telefones internacionais em BlockedNumbers: Claude decide baseado em exemplos existentes no código

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquivos de escopo direto
- `src/components/admin/AIAgentTab.tsx` — orquestrador principal; `handleChange`, `doSave`, `autoSaveTimerRef`; onde a validação central será inserida
- `src/components/admin/ai-agent/BrainConfig.tsx` — painel de cérebro; possui lista de modelos válidos
- `src/components/admin/ai-agent/RulesConfig.tsx` — painel de regras; `handoff_cooldown_minutes`, `max_lead_messages`
- `src/components/admin/ai-agent/GuardrailsConfig.tsx` — painel de guardrails; `max_discount_percent`, `blocked_phrases`
- `src/components/admin/ai-agent/VoiceConfig.tsx` — painel de voz; `voice_max_text_length`
- `src/components/admin/ai-agent/ExtractionConfig.tsx` — painel de extração; custom key (linha 83 já sanitiza)
- `src/components/admin/ai-agent/BlockedNumbersConfig.tsx` — números bloqueados; guard existente na linha 20
- `src/pages/dashboard/Settings.tsx` — relatório por turno; `recipient_number` (linha 266)

### Dependências já instaladas
- `zod ^3.25.76` — já no package.json, não precisa instalar
- `react-hook-form ^7.61.1` — instalado mas **NÃO USAR** para esta fase (arquitetura central não usa RHF)
- `src/components/ui/form.tsx` — disponível mas não necessário (usar `<p className="text-destructive text-xs">`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Padrão atual dos painéis
```typescript
// Cada painel: props simples, sem validação
interface BrainConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// Mudança necessária: adicionar fieldErrors prop
interface BrainConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  fieldErrors?: Record<string, string>; // novo
}
```

### Ponto de integração no AIAgentTab
```typescript
// handleChange atual (linha 165):
const handleChange = useCallback((updates: Record<string, any>) => {
  // ... lógica existente ...
  autoSaveTimerRef.current = setTimeout(() => doSave(true), 2000);
}, [...]);

// Com validação — adicionar:
// 1. const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
// 2. Dentro de handleChange: validar updates com schema correspondente
// 3. Guard em doSave: if (Object.keys(fieldErrors).length > 0) return
```

### Guard existente em BlockedNumbersConfig (linha 20)
```typescript
if (!num || num.length < 10) return; // será substituído por regex
```

### Sanitização existente em ExtractionConfig (linha 83)
```typescript
const key = newKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
// Mantida como pré-processamento; Zod valida resultado
```

</code_context>

<specifics>
## Specific Ideas

- Schema Zod deve usar `z.object({ campo: z.number().min(X).max(Y) }).partial()` para não validar campos que não foram enviados no update
- `fieldErrors` deve ser acumulativo: quando update chega, só limpa/atualiza os erros dos campos presentes no update
- Para BrainConfig `model`: fazer `z.enum([...])` derivado da lista de modelos já definida no arquivo (não hardcode separado)
- Mensagens de erro devem ser em português: `"Mínimo: 5 min"`, `"Máximo: 100"`, `"Modelo inválido"`, etc.

</specifics>

<deferred>
## Deferred Ideas

None — discussão se manteve dentro do escopo da fase.

</deferred>

---

*Phase: 03-validacao-estrita-de-formularios-frontend*
*Context gathered: 2026-03-29 via /gsd:discuss-phase 3*
