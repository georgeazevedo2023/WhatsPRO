# Phase 3: Validacao Estrita de Formularios (Frontend) — Research

**Researched:** 2026-03-29
**Domain:** React form validation, Zod schemas, controlled inputs
**Confidence:** HIGH — all findings from direct source-code inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Schemas Zod ficam centralizados no AIAgentTab — um schema por area de painel (brain, rules, guardrails, voice, extraction)
- D-02: Validacao acontece dentro de `handleChange` no AIAgentTab, antes de enfileirar o debounce. `schema.safeParse(updates)` falha → acumula erros em `fieldErrors`, nao enfileira auto-save
- D-03: AIAgentTab passa `fieldErrors: Record<string, string>` como prop para cada painel. Sem react-hook-form — apenas useState local existente + prop errors
- D-04: Bloqueio do auto-save e total — se qualquer `fieldErrors` entry existir, `doSave` nao dispara. Guard simples: `if (hasErrors) return` antes do setTimeout
- D-05: Erros aparecem imediatamente no onChange (nao onBlur)
- D-06: Exibicao: `<p className="text-destructive text-xs mt-1">{fieldErrors['campo']}</p>` abaixo do Input/Textarea. Usar `text-destructive`, NAO `FormMessage` do RHF
- D-07 — BrainConfig: `temperature` (0.0–2.0), `max_tokens` (1–8192), `model` (enum dos modelos validos)
- D-08 — RulesConfig: `handoff_cooldown_minutes` (5–1440), `max_lead_messages` (1–50)
- D-09 — GuardrailsConfig: `max_discount_percent` (0–100), `blocked_phrases` (array — Claude's discretion se obrigatorio)
- D-10 — VoiceConfig: `voice_max_text_length` (10–500)
- D-11 — ExtractionConfig: key customizada — regex `^[a-z][a-z0-9_]*$`. Sanitizacao inline existente (linha 83) mantida como pre-processamento; Zod valida resultado sanitizado
- D-12 — Settings.tsx (`recipient_number`): Regex `^\d{10,13}$`. Se preenchido mas invalido, erro inline + botao salvar desabilitado
- D-13 — BlockedNumbersConfig (`blocked_numbers`): Melhorar guard existente `num.length >= 10` para `^\d{10,15}$`. Claude decide regex exato

### Claude's Discretion
- Ordem de prioridade de erros quando multiplos campos invalidos: mostrar todos simultaneamente
- Se `blocked_phrases` estiver vazio e guardrails habilitado: Claude decide se valida ou nao
- Regex exato para telefones internacionais em BlockedNumbers: Claude decide baseado nos exemplos existentes

### Deferred Ideas (OUT OF SCOPE)
- Nenhum — discussao se manteve dentro do escopo da fase
</user_constraints>

---

## Summary

A fase consiste em adicionar validacao Zod a 6 componentes de configuracao do AI Agent + Settings.tsx. Toda a logica de validacao sera centralizada no AIAgentTab (orquestrador), que repassa `fieldErrors` como prop para os paineis. Os paineis exibem os erros inline sem qualquer dependencia de react-hook-form.

A implementacao e tecnicamente simples e de baixo risco: nenhum componente ja possui `fieldErrors` prop, nenhum usa Zod atualmente, e o ponto de integracao no `handleChange` do AIAgentTab e claramente identificado. A unica irregularidade encontrada e que o campo `max_lead_messages` nao existe em RulesConfig (o painel foi mapeado mas o campo nao esta la) — ver Risks abaixo.

**Recomendacao primaria:** Implementar exatamente como descrito no CONTEXT.md. Zod 3.25.76 ja instalado, sem instalacoes adicionais necessarias.

---

## Component State (Current Implementation)

### BrainConfig (`src/components/admin/ai-agent/BrainConfig.tsx`)

**Props interface atual (linha 13):**
```typescript
interface BrainConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// SEM fieldErrors prop
```

**Campos que disparam onChange:**
- `openai_api_key` — via `handleKeyChange()` com debounce proprio de 1.5s (save direto no Supabase — **fora do escopo de validacao**)
- `system_prompt` — Textarea onChange direto
- `model` — Select onValueChange: `onChange({ model: v })`
- `max_tokens` — Input number com guard inline: `Math.min(8192, Math.max(100, v))` — ja clampa mas nao mostra erro
- `temperature` — Slider onValueChange, range 0-1, step 0.1
- `debounce_seconds` — Input com guard: `Math.min(30, Math.max(3, v))`
- `context_short_messages` — Input number sem guard (apenas parseInt fallback 10)

**Modelos validos (lista exata, linhas 213-217):**
```
"gpt-4.1-mini"
"gpt-4.1-nano"
"gpt-4.1"
"gemini-2.5-flash"
"gemini-2.5-pro"
```

**Notas para validacao:**
- `temperature` usa Slider com range 0-1 (nao 0-2). CONTEXT.md define 0.0-2.0 mas o Slider limita fisicamente a 1. O schema deve respeitar o Slider (range 0-1) ou o Slider deve ser ajustado. Ver Risks.
- `max_tokens`: guard inline ja existe (`Math.min(8192, Math.max(100, v))`), mas o schema de CONTEXT.md define min=1. Reconciliar: schema devera usar min=100 para alinhar com o guard existente (ou ajustar o guard para 1).
- Nao ha exibicao de erros inline atualmente — nenhum padrao de erro de campo.

---

### RulesConfig (`src/components/admin/ai-agent/RulesConfig.tsx`)

**Props interface atual (linha 8):**
```typescript
interface RulesConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// SEM fieldErrors prop
```

**Campos com restricoes de range:**
- `handoff_cooldown_minutes` — Input number, `min={5} max={1440}`, onChange: `parseInt(e.target.value) || 30`
- `handoff_max_conversation_minutes` — Input number, `min={0} max={120}`, onChange: `parseInt(e.target.value) || 0`

**ATENCAO — CAMPO AUSENTE:** `max_lead_messages` NAO existe neste componente. O CONTEXT.md (D-08) define validacao para `max_lead_messages` (1-50) em RulesConfig, mas o campo nao esta renderizado aqui. Ver Implementation Risks.

**Padrão de erro existente (unico no conjunto):**
```tsx
// linha 141 — erro condicional de negocio (nao de campo):
{config.business_hours?.end <= config.business_hours?.start && (
  <p className="text-[11px] text-destructive font-medium">Horário de fechamento deve ser após a abertura.</p>
)}
```
Este padrao confirma que `text-destructive` ja e o padrao de erro usado neste arquivo.

---

### GuardrailsConfig (`src/components/admin/ai-agent/GuardrailsConfig.tsx`)

**Props interface atual (linha 7):**
```typescript
interface GuardrailsConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// SEM fieldErrors prop
```

**Campos relevantes:**
- `blocked_topics` — Textarea que faz split('\n').filter(Boolean) → string[] — sem validacao
- `blocked_phrases` — Textarea identica a blocked_topics: `(config.blocked_phrases || []).join('\n')` → onChange: split/trim/filter
- `max_discount_percent` — Input type=number, `min={0} max={100} step={1}`, valor pode ser `null`: `onChange({ max_discount_percent: e.target.value ? parseFloat(e.target.value) : null })`

**Notas para validacao:**
- `max_discount_percent` aceita `null` (campo opcional — "deixe vazio para nao permitir descontos"). Schema deve ser `z.number().min(0).max(100).nullable()` ou `z.number().min(0).max(100).optional()` — validar apenas quando nao for null/undefined.
- `blocked_phrases` e armazenado como `string[]` derivado de Textarea. Nao ha um "campo" individual a validar — validacao seria sobre o array como um todo se necessario.

---

### VoiceConfig (`src/components/admin/ai-agent/VoiceConfig.tsx`)

**Props interface atual (linha 24):**
```typescript
interface VoiceConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// SEM fieldErrors prop
```

**Campo relevante:**
- `voice_max_text_length` — Input type=number, `min={50} max={500}`, onChange: `parseInt(e.target.value) || 150`

**Notas para validacao:**
- O HTML `min={50}` difere do range do CONTEXT.md (10-500). Schema devera usar min=10 (CONTEXT.md e a fonte de verdade) ou ajustar o atributo HTML do Input para `min={10}`.
- `voice_name` — Select com `VOICE_OPTIONS` array; nao e alvo de validacao Zod (apenas 6 valores validos, todos pre-definidos no Select).

---

### ExtractionConfig (`src/components/admin/ai-agent/ExtractionConfig.tsx`)

**Props interface atual (linha 19):**
```typescript
interface ExtractionConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// SEM fieldErrors prop
```

**Sanitizacao existente (linha 83 — exatamente como documentado no CONTEXT.md):**
```typescript
const key = newKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
```
Esta sanitizacao ja remove caracteres invalidos antes de `addField()`. O resultado pode ser string vazia se o input for so caracteres invalidos.

**Guard atual para addField() (linhas 84-96):**
```typescript
const key = newKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
const label = newLabel.trim();
if (!key || !label) {
  if (!key && newKey.trim()) toast?.error?.('Chave inválida — use apenas letras, números e _');
  return;
}
if (fields.some(f => f.key === key)) {
  toast?.error?.(`Campo "${key}" já existe`);
  return;
}
```

**Notas para validacao:**
- O campo key usa `toast.error` em vez de erro inline. A fase adiciona erro inline abaixo do Input da chave.
- A sanitizacao produz chave que pode comecar com digito (ex: `1nome` → `1nome` — nao filtrado). CONTEXT.md define regex `^[a-z][a-z0-9_]*$` que exige inicio com letra. O Zod schema captura isso apos a sanitizacao.
- A validacao de `label` (nao pode ser vazio) ja existe como guard, mas sem display inline — a fase adiciona o display Zod-driven.

---

### BlockedNumbersConfig (`src/components/admin/ai-agent/BlockedNumbersConfig.tsx`)

**Props interface atual (linha 9):**
```typescript
interface BlockedNumbersConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}
// SEM fieldErrors prop
```

**Guard existente em addNumber() (linhas 19-22 — exatamente como documentado):**
```typescript
const num = newNumber.trim().replace(/\D/g, '');
if (!num || num.length < 10) return; // Brazilian numbers: 10+ digits (DDD + number)
if (numbers.includes(num)) return;
```
O strip de `\D` ocorre ANTES da validacao de comprimento. Isso significa que a validacao e sobre digitos puros ja.

**Notas para validacao:**
- BlockedNumbers tem validacao LOCAL — nao passa por `handleChange` do AIAgentTab para `onChange({ blocked_numbers: [...numbers, num] })`. O fluxo correto e: validar no proprio `addNumber()` e exibir erro inline no componente.
- NAO precisa de `fieldErrors` prop para este componente — a validacao e self-contained (o erro e sobre `newNumber`, nao sobre um campo de `config`).
- Regex recomendado: `^\d{10,15}$` (apos strip de `\D`). Cobre: numeros brasileiros sem DDI (10-11 digitos), com DDI 55 (12-13 digitos), e internacionais ate 15 digitos (padrao E.164).

---

### Settings.tsx (`src/pages/dashboard/Settings.tsx`)

**Estado atual do formulario:**
```typescript
const [form, setForm] = useState<NewConfigForm>({
  inbox_id: '',
  instance_id: '',
  recipient_number: '',
  send_hour: '18',
});
```

**Campo `recipient_number` (linhas 263-275):**
```tsx
<Input
  placeholder="5511999999999"
  value={form.recipient_number}
  onChange={(e) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    setForm((f) => ({ ...f, recipient_number: cleaned }));
  }}
  maxLength={15}
  className="bg-background"
/>
<p className="text-xs text-muted-foreground">DDI + DDD + número (sem espaços ou traços) — Ex: 5511999999999</p>
```

**Botao de salvar (linha 296):**
```tsx
<Button
  size="sm"
  disabled={!form.inbox_id || !form.instance_id || !form.recipient_number || createMutation.isPending}
  onClick={() => createMutation.mutate(form)}
>
```

**Notas para validacao:**
- Ja faz strip de `\D` no onChange (so digitos armazenados).
- A desabilitacao atual e apenas `!form.recipient_number` (truthy — qualquer digito passa). Precisa adicionar validacao de formato.
- Validacao e LOCAL ao componente Settings — sem envolvimento do AIAgentTab.
- NAO e necessario `fieldErrors` vindo de fora: basta um `useState<string>` local `recipientError` no Settings.
- Regex: `^\d{10,13}$` (conforme D-12). O campo ja tem `maxLength={15}` e strip de non-digits.

---

## Integration Point: AIAgentTab

### handleChange — Assinatura exata (linhas 165-179)
```typescript
const handleChange = useCallback((updates: Record<string, any>) => {
  setConfig(prev => {
    const next = { ...prev, ...updates };
    configRef.current = next;
    return next;
  });

  // Only trigger auto-save if changes include fields we actually save
  const hasRelevantChanges = Object.keys(updates).some(k => ALLOWED_FIELDS.includes(k));
  if (hasRelevantChanges) {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => doSave(true), 2000);
    setSaveStatus(prev => prev === 'saving' ? prev : 'idle');
  }
}, [doSave]);
```

**Onde inserir validacao:** Apos o `setConfig(...)` e antes do `if (hasRelevantChanges)`. O guard de auto-save envolve o `setTimeout` completo.

### doSave — Estrutura exata (linhas 121-163)
```typescript
const doSave = useCallback(async (silent = false) => {
  const agentId = selectedAgentIdRef.current;
  const cfg = configRef.current;
  if (!agentId) return;

  if (savingRef.current) {
    pendingSaveRef.current = true;
    return;
  }
  // ... supabase update ...
}, []);
```

**Onde inserir guard de validacao:** Logo apos `if (!agentId) return;` — antes de verificar `savingRef.current`.

### autoSaveTimerRef — Uso
- `useRef<ReturnType<typeof setTimeout>>()` (linha 78)
- `clearTimeout(autoSaveTimerRef.current)` em 4 locais: handleChange, handleTabChange, useEffect de selectedAgentId, useEffect de cleanup
- `autoSaveTimerRef.current = setTimeout(() => doSave(true), 2000)` em handleChange

### Paineis e props atuais (local de renderizacao)

| Tab | Componente | Linha aprox. | Props atuais |
|-----|-----------|-------------|-------------|
| intelligence | `<BrainConfig>` | 443 | `config={config} onChange={handleChange}` |
| intelligence | `<ExtractionConfig>` | 445 | `config={config} onChange={handleChange}` |
| security | `<RulesConfig>` | 461 | `config={config} onChange={handleChange}` |
| security | `<GuardrailsConfig>` | 462 | `config={config} onChange={handleChange}` |
| security | `<BlockedNumbersConfig>` | 463 | `config={config} onChange={handleChange}` |
| channels | `<VoiceConfig>` | 469 | `config={config} onChange={handleChange}` |

Todos os paineis recebem exatamente `config` e `onChange` — nenhum tem props adicionais hoje.

---

## Validation Feasibility Assessment

A arquitetura proposta no CONTEXT.md e 100% viavel com o codigo atual. Confirmacoes:

1. **`fieldErrors` como prop e diretamente adicionavel** — nenhum painel usa TypeScript estrito (todos usam `Record<string, any>` para config), mas as interfaces de props sao tipadas. Adicionar `fieldErrors?: Record<string, string>` e non-breaking.

2. **Ponto de intersecao no handleChange e limpo** — o `setConfig()` e separado do `setTimeout(doSave)` por uma verificacao `if (hasRelevantChanges)`. O guard de validacao encaixa naturalmente entre os dois.

3. **Zod 3.25.76 ja instalado** — confirmado em node_modules. Sem instalacoes necessarias.

4. **Settings.tsx e BlockedNumbersConfig sao independentes do AIAgentTab** — suas validacoes sao self-contained e nao precisam de `fieldErrors` prop vinda de fora.

5. **Padrao `text-destructive text-xs mt-1` ja e usado no projeto** — RulesConfig.tsx linha 141 usa `text-[11px] text-destructive font-medium` para erro de horario comercial. A variante proposta no CONTEXT.md (text-xs) e consistente com o padrao.

6. **Nenhum uso existente de Zod no frontend** — esta sera a primeira adocao. Import pattern: `import { z } from 'zod'`.

---

## Schema Details (Per Panel)

### BrainConfig Schema
```typescript
// Modelos derivados do arquivo (nao hardcode separado):
const BRAIN_MODELS = ['gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4.1', 'gemini-2.5-flash', 'gemini-2.5-pro'] as const;

const brainSchema = z.object({
  model: z.enum(BRAIN_MODELS, { errorMap: () => ({ message: 'Modelo inválido' }) }),
  temperature: z.number().min(0, 'Mínimo: 0').max(1, 'Máximo: 1'),  // Slider limita a 1, nao 2
  max_tokens: z.number().int().min(100, 'Mínimo: 100').max(8192, 'Máximo: 8192'),
}).partial();
```
**Nota:** temperature range e 0-1 (Slider), nao 0-2 (CONTEXT.md). Ver Risk #1.

### RulesConfig Schema
```typescript
const rulesSchema = z.object({
  handoff_cooldown_minutes: z.number().int().min(5, 'Mínimo: 5 min').max(1440, 'Máximo: 1440 min (24h)'),
  // max_lead_messages: AUSENTE no componente — ver Risk #2
}).partial();
```

### GuardrailsConfig Schema
```typescript
const guardrailsSchema = z.object({
  max_discount_percent: z.number().min(0, 'Mínimo: 0%').max(100, 'Máximo: 100%').nullable().optional(),
}).partial();
// blocked_phrases: array derivado de Textarea — validacao de campo individual nao aplicavel
```

### VoiceConfig Schema
```typescript
const voiceSchema = z.object({
  voice_max_text_length: z.number().int().min(10, 'Mínimo: 10').max(500, 'Máximo: 500'),
}).partial();
```
**Nota:** HTML `min={50}` no componente difere do schema min=10. Ver Risk #3.

### ExtractionConfig Schema (local no componente)
```typescript
const extractionKeySchema = z.string()
  .regex(/^[a-z][a-z0-9_]*$/, 'Chave deve começar com letra, usar apenas letras, números e _');
```
Validacao acontece no `addField()` apos sanitizacao, nao no `handleChange` global.

### BlockedNumbers (local no componente)
```typescript
const phoneRegex = /^\d{10,15}$/;
// Validar `num` (ja apos strip de \D) antes de chamar onChange
```

### Settings.tsx (local no componente)
```typescript
const recipientRegex = /^\d{10,13}$/;
// Validar form.recipient_number no onChange ou no submit
```

---

## Zod Integration Notes

**Versao instalada:** 3.25.76 (confirado em node_modules/zod/package.json)
**Registry latest:** 4.3.6 — NAO atualizar, projeto usa ^3.x

**Import pattern a usar:**
```typescript
import { z } from 'zod';
```

**Pattern `.partial()` para updates parciais:**
```typescript
// Cada schema e definido como objeto completo e depois tornando todos os campos opcionais
const brainSchema = z.object({ model: ..., temperature: ..., max_tokens: ... }).partial();
// safeParse com updates parciais:
const result = brainSchema.safeParse(updates);
if (!result.success) {
  const newErrors: Record<string, string> = {};
  result.error.errors.forEach(e => {
    if (e.path[0]) newErrors[String(e.path[0])] = e.message;
  });
}
```

**Acumulacao de erros (conforme CONTEXT.md especifics):**
```typescript
// Ao receber update, limpar/atualizar apenas os erros dos campos presentes no update
setFieldErrors(prev => {
  const next = { ...prev };
  // Limpar erros dos campos que chegaram no update
  Object.keys(updates).forEach(k => delete next[k]);
  // Adicionar novos erros
  Object.assign(next, newErrors);
  return next;
});
```

**Nenhum uso existente de Zod no frontend** — primeira adocao. Sem conflitos de padrao.

---

## Validation Architecture

### Fluxo Central (AIAgentTab)

```
handleChange(updates)
  ↓
setConfig(prev → next)          [sempre — atualiza UI imediatamente]
  ↓
determinar schema pelo updates  [qual painel o update pertence]
  ↓
schema.safeParse(updates)
  ↓
  ├── FAIL → acumular erros em fieldErrors state
  │          clearTimeout(autoSaveTimerRef)  [nao enfileira]
  │          retornar
  └── OK  → limpar erros dos campos do update
            if (hasRelevantChanges)
              clearTimeout + setTimeout(doSave, 2000)

doSave()
  if (Object.keys(fieldErrors).length > 0) return  [guard adicional]
  // ... supabase update ...
```

### Identificacao de Schema por Update

O handleChange recebe `updates: Record<string, any>`. Para determinar qual schema usar, verificar as chaves do objeto:

```typescript
const BRAIN_FIELDS = ['model', 'temperature', 'max_tokens'];
const RULES_FIELDS = ['handoff_cooldown_minutes', 'max_lead_messages'];
const GUARDRAILS_FIELDS = ['max_discount_percent', 'blocked_phrases'];
const VOICE_FIELDS = ['voice_max_text_length'];
// ExtractionConfig nao passa por handleChange para validacao de key

// No handleChange:
const updateKeys = Object.keys(updates);
if (updateKeys.some(k => BRAIN_FIELDS.includes(k))) validate against brainSchema;
if (updateKeys.some(k => RULES_FIELDS.includes(k))) validate against rulesSchema;
// etc — multiplos schemas podem ser validados se o update tiver campos de varios paineis
```

### Fluxo Settings.tsx (independente)

```
onChange recipient_number
  ↓
setForm + validar com regex
  ↓
  ├── invalido → setRecipientError('Telefone inválido — use DDI+DDD+número (10-13 dígitos)')
  └── valido  → setRecipientError('')

Button disabled = !form.inbox_id || !form.instance_id || !form.recipient_number || !!recipientError || isPending
```

### Fluxo BlockedNumbersConfig (independente)

```
addNumber()
  ↓
num = newNumber.trim().replace(/\D/g, '')  [strip nao-digitos — ja existe]
  ↓
validar com /^\d{10,15}$/
  ↓
  ├── invalido → setNumberError('Número inválido — use DDI+DDD+número (10-15 dígitos)')
  └── valido  → onChange({blocked_numbers: [...]})
                setNewNumber('')
```

---

## Implementation Risks / Surprises

### Risk #1 — temperature Slider limita a 1.0, CONTEXT.md define 2.0

**Descoberta:** O Slider em BrainConfig tem `max={1}`. O CONTEXT.md (D-07) define `temperature (0.0–2.0)`. Isso cria uma inconsistencia entre schema (que deveria aceitar ate 2.0) e o componente (que fisicamente limita a 1.0).

**Resolucao para o planner:** Usar `max={1}` no schema (alinhar com o Slider existente). Nao alterar o Slider — fora do escopo da fase. Documentar como discrepancia de especificacao (a LLM tambem aceita temperaturas acima de 1; o Slider sera ajustado em fase futura se necessario).

### Risk #2 — `max_lead_messages` nao existe em RulesConfig

**Descoberta:** RulesConfig.tsx foi totalmente lido e o campo `max_lead_messages` NAO esta renderizado. O CONTEXT.md (D-08) lista `max_lead_messages (1-50)` como campo de RulesConfig a validar.

**Possibilidades:**
1. O campo existe no DB (ai_agents) mas foi omitido da UI — a fase pode adicionar o campo + validacao ao mesmo tempo
2. O campo esta em outro painel (nao encontrado no scan)

**REQUIREMENTS.md confirma:** "Limite de mensagens | Auto-handoff apos 8 msgs incoming (configuravel: agent.max_lead_messages)" — o campo existe no banco e no backend. Verificar `ALLOWED_FIELDS` em AIAgentTab: `'max_lead_messages'` NAO esta na lista `ALLOWED_FIELDS` (linhas 48-58). O campo nao esta sendo salvo pelo AIAgentTab.

**Resolucao para o planner:** A tarefa para RulesConfig inclui (a) adicionar `max_lead_messages` ao `ALLOWED_FIELDS`, (b) adicionar o campo Input no RulesConfig, (c) adicionar validacao Zod. Isso adiciona um campo de UI — ainda dentro do escopo da fase (nao e painel novo, e campo omitido num painel existente).

### Risk #3 — voice_max_text_length: HTML min={50} vs CONTEXT.md min=10

**Descoberta:** Input em VoiceConfig tem `min={50}`. CONTEXT.md define min=10. Descrepancia pequena mas precisa ser escolhida.

**Resolucao para o planner:** Usar min=10 (CONTEXT.md e a fonte de verdade para os schemas). Atualizar o atributo HTML `min={50}` para `min={10}` no Input ao mesmo tempo que adiciona a validacao.

### Risk #4 — max_tokens: CONTEXT.md diz min=1, BrainConfig usa Math.max(100, v)

**Descoberta:** O guard inline em BrainConfig usa `Math.max(100, v)` (min efetivo = 100). CONTEXT.md diz min=1–8192.

**Resolucao para o planner:** Usar min=100 no schema Zod (alinhar com o comportamento existente do componente). Atualizar a descricao "100-8192" que ja consta no componente.

### Risk #5 — ExtractionConfig e BlockedNumbersConfig: validacao local, nao global

**Descoberta:** Estes dois componentes NAO sao bons candidatos para `fieldErrors` prop vinda do AIAgentTab:
- ExtractionConfig valida `newKey` (estado local `useState('')`) — nao e um campo de `config`
- BlockedNumbersConfig valida `newNumber` (estado local `useState('')`) — nao e um campo de `config`

Ambos devem ter validacao self-contained com `useState<string>` local para o erro.

**Resolucao para o planner:** Nao passar `fieldErrors` para ExtractionConfig nem para BlockedNumbersConfig. Adicionar `const [keyError, setKeyError] = useState('')` e `const [numberError, setNumberError] = useState('')` nos respectivos componentes.

### Risk #6 — BrainConfig tem auto-save proprio para openai_api_key

**Descoberta:** BrainConfig tem um segundo mecanismo de save (direto ao Supabase via `handleKeyChange` com debounce de 1.5s). Este campo NAO passa pelo `handleChange` do AIAgentTab (chama `onChange({ openai_api_key: value })` mas o save e paralelo).

**Resolucao para o planner:** `openai_api_key` esta fora do escopo de validacao da fase (nao tem range/formato numerico validavel). Ignorar.

---

## Standard Stack

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zod | 3.25.76 | Schema validation e parse | Instalado |
| react (useState, useCallback) | 18.x | State local para fieldErrors | Ja em uso |
| shadcn/ui Input, Textarea | existente | Componentes com fieldErrors display abaixo | Ja em uso |

**Instalacao necessaria:** Nenhuma.

---

## Common Pitfalls

### Pitfall 1: Schema validando todos os campos do objeto, nao apenas os do update
**O que vai errado:** Schema `z.object({model, temperature, max_tokens})` sem `.partial()` falha quando o update contem apenas `{temperature: 0.5}` (model e max_tokens ficam undefined).
**Como evitar:** Sempre usar `.partial()` nos schemas de AIAgentTab — cada update e parcial.

### Pitfall 2: Limpar todos os fieldErrors quando qualquer campo muda
**O que vai errado:** Limpar `fieldErrors` completamente quando o update chega apaga erros de outros campos que ainda estao invalidos.
**Como evitar:** Acumulacao seletiva — limpar/atualizar apenas os campos presentes no `updates` atual.

### Pitfall 3: Guard em doSave usando snapshot desatualizado de fieldErrors
**O que vai errado:** `doSave` usa `configRef.current` (ref) para dados, mas `fieldErrors` e state. Se usar closure desatualizada, o guard `if (Object.keys(fieldErrors).length > 0)` pode estar stale.
**Como evitar:** Usar `fieldErrorsRef` (useRef espelhando o state) da mesma forma que `configRef` espelha `config`. Ou passar `fieldErrors` como argumento para `doSave`.

### Pitfall 4: Erro de validacao impede reset do campo para valor valido
**O que vai errado:** Se o usuario digitar 200 em max_tokens e depois apagar para digitar 500, o estado intermediario (campo vazio ou "50") pode disparar erro que bloqueia o auto-save antes de terminar de digitar.
**Como evitar:** Auto-save e bloqueado (correto), mas a UI deve continuar responsiva. O `setConfig` sempre atualiza — apenas o auto-save e bloqueado. Este e o comportamento correto per D-02/D-05.

### Pitfall 5: `max_lead_messages` ausente de ALLOWED_FIELDS
**O que vai errado:** Campo e adicionado a RulesConfig mas nao persistido porque ALLOWED_FIELDS nao inclui a chave.
**Como evitar:** Adicionar `'max_lead_messages'` ao array `ALLOWED_FIELDS` em AIAgentTab.tsx ao implementar o campo.

---

## Validation Architecture

Ver secao acima com mesmo nome. Resumo para o planner:

- **AIAgentTab:** adicionar `fieldErrors` state + `fieldErrorsRef` + validacao em `handleChange` + guard em `doSave`
- **BrainConfig, RulesConfig, GuardrailsConfig, VoiceConfig:** adicionar `fieldErrors?: Record<string, string>` prop + `<p className="text-destructive text-xs mt-1">` abaixo dos inputs afetados
- **ExtractionConfig:** adicionar `keyError` state local + display abaixo do Input de chave
- **BlockedNumbersConfig:** adicionar `numberError` state local + display abaixo do Input de numero
- **Settings.tsx:** adicionar `recipientError` state local + display + condition no botao salvar

---

## Sources

### Primary (HIGH confidence)
- Inspecao direta de codigo — todos os 8 arquivos lidos na integra
- `package.json` — versoes exatas
- `node_modules/zod/package.json` — versao instalada confirmada

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md — regras de negocio (max_lead_messages configuravel)
- STATE.md — divida tecnica DT-06 (lista exatamente os problemas de validacao desta fase)
- CONTEXT.md — decisoes arquiteturais da discussao com o usuario

---

## Metadata

**Confidence breakdown:**
- Component state: HIGH — codigo lido na integra
- Integration point: HIGH — AIAgentTab lido na integra, linhas exatas documentadas
- Schema details: HIGH — derivados diretamente do codigo existente
- Zod version: HIGH — confirmado em node_modules
- Risks: HIGH — descobertos durante leitura do codigo, nao inferidos

**Research date:** 2026-03-29
**Valid until:** 60 dias (stack estatico, sem dependencias externas novas)
