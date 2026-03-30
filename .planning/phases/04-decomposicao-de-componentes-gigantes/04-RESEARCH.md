# Phase 4: Decomposição de Componentes Gigantes — Research

**Researched:** 2026-03-29
**Domain:** React component decomposition (pure refactor — zero backend changes)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Estado permanece 100% no orquestrador — sub-componentes recebem props e disparam callbacks. Nenhuma extração de hooks customizados. Abordagem "props + callbacks": orquestrador continua com todos os `useState` e `useRef`; sub-componentes são puramente visuais/funcionais.
- **D-02:** Sub-componentes NÃO gerenciam estado próprio de domínio — apenas estado interno de UI local (ex: hover, focus) se necessário.
- **D-03:** Naming alinha com as tabs reais: `PlaygroundManualTab`, `PlaygroundScenariosTab`, `PlaygroundResultsTab`, `PlaygroundE2eTab`.
- **D-04:** `PlaygroundToolInspector` NÃO se torna componente separado — permanece inline dentro de `PlaygroundManualTab`.
- **D-05:** O orquestrador `AIAgentPlayground.tsx` mantém: seleção de agente, fetchAgents, distribuição de state para as 4 tabs via props, renderização do header (agente selector + overrides + export).
- **D-06:** Os 4 sub-componentes ficam em `src/components/admin/ai-agent/playground/` (nova subpasta).
- **D-07:** Todos os tipos/interfaces inline do Playground migram para `src/types/playground.ts`: `AIAgent`, `ToolCall`, `ChatMessage`, `PlaygroundResponse`, `Overrides`, `ScenarioCategory`, `TestStep`, `ExpectedOutcome`, `TestScenario`, `ScenarioRunResults`, `ScenarioRun`, `WatchSpeed`.
- **D-08:** Os 7 arquivos de teste devem ter imports atualizados para `src/types/playground.ts` após a extração. `npx vitest run` deve continuar verde.
- **D-09:** `BatchScrapeImport.tsx` e `CsvProductImport.tsx` já estão extraídos — não recriar.
- **D-10:** Extrair de CatalogConfig: `CatalogTable` (listagem + filtros + bulk selection) e `CatalogProductForm` (dialog de criar/editar produto com image management inline).
- **D-11:** Os 2 novos componentes de CatalogConfig ficam em `src/components/admin/ai-agent/` (mesmo nível dos existentes, sem subpasta).
- **D-12:** `AIAgentPlayground.tsx` < 300 LOC após extração.
- **D-13:** `CatalogConfig.tsx` < 300 LOC após extração.
- **D-14:** `npx vitest run` verde — zero regressões.
- **D-15:** Tipos exportados de `src/types/playground.ts`.

### Claude's Discretion

- Ordem de extração por arquivo (Playground primeiro ou CatalogConfig primeiro): Claude decide baseado em risco.
- Se algum sub-componente ficar > 200 LOC, Claude pode extrair helpers internos adicionais sem consultar o usuário.
- Props interfaces dos sub-componentes: Claude define os nomes de props.

### Deferred Ideas (OUT OF SCOPE)

None — discussão se manteve dentro do escopo da fase.
</user_constraints>

---

## Summary

Esta fase é uma refatoração estrutural pura de dois componentes React gigantes. Nenhuma lógica de negócio muda — o comportamento observável pelo usuário deve ser idêntico antes e depois. O risco principal é introduzir bugs silenciosos ao mover JSX que depende de closures sobre state do orquestrador.

**AIAgentPlayground.tsx (1353 LOC):** O arquivo contém três blocos distintos: (1) tipos e constantes (linhas 1–378), (2) o componente `AIAgentPlayground` com ~17 useState, ~8 useRef, e handlers (~380–820), e (3) o render com header + Tabs shell + 4 TabsContent (~820–1353). A extração move cada TabsContent para um sub-componente independente. As constantes `TOOL_META`, `ALL_TOOLS`, `MODELS`, `PERSONAS`, `CATEGORY_META`, `DIFFICULTY_COLORS`, e `TEST_SCENARIOS` devem mover para `src/types/playground.ts` junto com os tipos — isso é o que efetivamente reduz o orquestrador para < 300 LOC.

**CatalogConfig.tsx (704 LOC):** O arquivo tem uma área de filtros + grid de produtos (CatalogTable, ~linhas 376–504) e um Dialog de produto (CatalogProductForm, ~linhas 506–687). As funções `handleBulkAction`, `toggleSelect`, `toggleSelectAll`, `filtered`, e `categories` pertencem a CatalogTable. As funções `handleSave`, `handleDelete`, `handleFileUpload`, `removeImage`, `setFeaturedImage`, `handleGenerateDescription`, `handleImportFromUrl` pertencem a CatalogProductForm.

**Descoberta crítica sobre os testes:** Todos os 7 arquivos de teste importam **exclusivamente** de `../../../../supabase/functions/_shared/agentHelpers.ts` — nenhum importa tipos de `AIAgentPlayground.tsx`. A decisão D-08 (atualizar imports dos testes) é uma tarefa de verificação que provavelmente não tem trabalho real a fazer, mas deve ser confirmada por grep antes de marcar como concluída.

**Primary recommendation:** Extrair Playground primeiro (risco maior, mais arquivos novos), depois CatalogConfig. Mover tipos e constantes para `src/types/playground.ts` é pré-requisito do orquestrador atingir < 300 LOC.

---

## Standard Stack

### Core (já em uso — sem novas dependências)
| Item | Versão | Propósito | Observação |
|------|--------|-----------|------------|
| React | 18 | Componentes funcionais com props/callbacks | Padrão do projeto |
| TypeScript | ~5.x | Interfaces de props tipadas | Todos os novos arquivos `.tsx` |
| Vite | ~5.x | Build + path alias `@/` | `@/types/playground.ts` funciona igual |
| Vitest | ~1.x | Suite de testes | `npx vitest run` é o gate de qualidade |

**Instalação:** Nenhum pacote novo necessário.

---

## Architecture Patterns

### Estrutura de diretórios resultante

```
src/
├── types/
│   └── playground.ts          # NOVO — tipos + constantes extraídas do Playground
├── pages/dashboard/
│   └── AIAgentPlayground.tsx  # REDUZIDO — < 300 LOC (orquestrador)
└── components/admin/ai-agent/
    ├── CatalogConfig.tsx       # REDUZIDO — < 300 LOC (orquestrador)
    ├── CatalogTable.tsx        # NOVO — grid + filtros + bulk selection
    ├── CatalogProductForm.tsx  # NOVO — Dialog CRUD + image management
    ├── BatchScrapeImport.tsx   # já existe (161 LOC)
    ├── CsvProductImport.tsx    # já existe (343 LOC)
    └── playground/             # NOVA subpasta
        ├── PlaygroundManualTab.tsx      # NOVO — ~250–350 LOC
        ├── PlaygroundScenariosTab.tsx   # NOVO — ~230–280 LOC
        ├── PlaygroundResultsTab.tsx     # NOVO — ~60–80 LOC
        └── PlaygroundE2eTab.tsx         # NOVO — ~130–160 LOC
```

### Padrão 1: Props + Callbacks (D-01)

Todo estado permanece no orquestrador. Sub-componentes recebem dados via props e notificam mudanças via callbacks.

```typescript
// Padrão correto — sub-componente stateless de domínio
interface PlaygroundManualTabProps {
  // dados
  messages: ChatMessage[];
  sending: boolean;
  input: string;
  attachedImage: string | null;
  bufferMode: boolean;
  bufferSec: number;
  bufferCountdown: number;
  showOverrides: boolean;
  overrides: Overrides;
  selectedAgent: AIAgent | undefined;
  totalTokens: { input: number; output: number };
  avgLatency: number;
  // callbacks
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClear: () => void;
  onAttachImage: (url: string | null) => void;
  onBufferModeChange: (v: boolean) => void;
  onBufferSecChange: (v: number) => void;
  onOverridesChange: (overrides: Overrides) => void;
  onShowOverridesToggle: () => void;
  onRateMessage: (msgId: string, rating: 'approved' | 'disapproved') => void;
  onReplayMessage: (msgIndex: number) => void;
  onRunPersona: (persona: { name: string; msgs: string[] }) => void;
}
```

### Padrão 2: Constantes co-localizadas com os tipos

`TEST_SCENARIOS`, `TOOL_META`, `CATEGORY_META`, `DIFFICULTY_COLORS`, `MODELS`, `ALL_TOOLS`, `PERSONAS` são constantes declaradas no topo do arquivo junto com os tipos. Elas devem mover para `src/types/playground.ts` pois são co-dependentes dos tipos que exportam.

```typescript
// src/types/playground.ts
export interface AIAgent { ... }
export interface ChatMessage { ... }
export type WatchSpeed = 0.5 | 1 | 1.5 | 2 | 3;
// ... todos os tipos

export const TOOL_META = { ... };
export const TEST_SCENARIOS: TestScenario[] = [ ... ];
// ... todas as constantes
```

### Padrão 3: Re-exports para compatibilidade (se necessário)

Se algum teste ou arquivo externo importar algo do `AIAgentPlayground.tsx`, adicionar re-export temporário. Conforme pesquisa, isso NÃO é necessário — os 7 testes importam de `_shared/agentHelpers.ts`.

### Anti-Padrões a Evitar

- **Prop drilling excessivo:** Se um sub-componente precisar de > 15 props, avaliar se a fronteira de extração está errada. Neste caso, as fronteiras são por tab — o volume de props é esperado.
- **Mover handlers para os sub-componentes:** `handleSend`, `runScenario`, `runE2eScenario` devem permanecer no orquestrador e ser passados como callbacks.
- **Inline functions como props desnecessárias:** Funções que só mudam um estado simples podem ser passadas como `onXxx={setXxx}` diretamente.
- **Barrel index prematuro:** D-06 e a nota de specifics proíbem criar `playground/index.ts`. Cada sub-componente é importado diretamente.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez | Por quê |
|----------|--------------|-------------|---------|
| Compartilhamento de estado entre tabs | Context API, Zustand, Redux | Props + callbacks (D-01) | Decisão locked — apenas estado local de UI nos sub-componentes |
| Lazy loading de tabs | React.lazy + Suspense | Importações estáticas | Sem requisito de performance específico; adicionaria complexidade desnecessária |
| Validação de props em runtime | PropTypes, Zod | TypeScript interfaces | Stack já usa TS; interfaces são suficientes |

---

## Runtime State Inventory

> Esta fase é refatoração de frontend puro. Não há runtime state envolvido.

| Categoria | Itens Encontrados | Ação Necessária |
|-----------|------------------|----------------|
| Stored data | None — refactor não afeta DB | Nenhuma |
| Live service config | None — zero mudanças de backend | Nenhuma |
| OS-registered state | None | Nenhuma |
| Secrets/env vars | None — sem renomeação de variáveis | Nenhuma |
| Build artifacts | None — Vite recompila tudo | Nenhuma |

---

## Common Pitfalls

### Pitfall 1: Closures sobre refs que não são passadas como props

**O que vai errado:** `messagesRef`, `bufferTimerRef`, `watchSpeedRef`, `isPausedRef`, `isStoppedRef` são `useRef` no orquestrador. Handlers como `runScenario` leem `messagesRef.current` diretamente. Se o handler for movido para um sub-componente sem passar a ref como prop, o valor será sempre o inicial.

**Por que acontece:** Refs são objetos mutáveis; passar `messagesRef.current` como prop copia o valor no momento do render, não mantém a referência viva.

**Como evitar:** Manter todos os handlers com dependência de refs no orquestrador. Passar apenas o valor atual (ex: `messages`) como prop para renderização. Confirmar que `runScenario`, `runE2eScenario`, `pauseScenario`, `resumeScenario`, `stopScenario` ficam no orquestrador e são passados como callbacks.

**Sinais de alerta:** Sub-componente que precisa de `useRef` para algo que não seja scroll ou focus local.

### Pitfall 2: Funções `filteredScenarios` e `filtered` precisam de acesso ao state correto

**O que vai errado:** `filteredScenarios` usa `TEST_SCENARIOS`, `selectedCategory`, e `scenarioSearch`. `filtered` no CatalogConfig usa `products`, `search`, `categoryFilter`, `stockFilter`, `sortBy`. Se a memoização for movida para o sub-componente mas o state ficar no orquestrador, funciona — mas se o state for movido para o sub-componente, o orquestrador perde acesso ao valor filtrado (necessário para badges de contagem no TabsTrigger).

**Como evitar:** Manter `filteredScenarios` e `filtered` no orquestrador ou calcular no orquestrador e passar como prop para o sub-componente.

**Observação:** O badge `{TEST_SCENARIOS.length}` no TabsTrigger de "Cenários" usa o array completo, não filtrado — sem problema. Mas `filtered.length` no CatalogConfig é usado no `toggleSelectAll`. Avaliar onde o cálculo deve viver.

### Pitfall 3: handleBulkAction depende de `filtered` para `toggleSelectAll`

**O que vai errado:** Em CatalogConfig, `toggleSelectAll` referencia `filtered`:
```typescript
const toggleSelectAll = () => {
  if (selectedIds.size === filtered.length) setSelectedIds(new Set());
  else setSelectedIds(new Set(filtered.map(p => p.id)));
};
```
Se `selectedIds` e seus setters ficam no orquestrador, mas `filtered` também precisa ser acessível, o cálculo de `filtered` deve ficar no orquestrador e ser passado como prop para `CatalogTable`.

**Como evitar:** Props de `CatalogTable` incluem `filtered: Product[]` calculado pelo orquestrador.

### Pitfall 4: `computeResults` é uma função local que não está em `_shared/agentHelpers.ts`

**O que vai errado:** O orquestrador tem uma função `computeResults` local (wrapper de `computeScenarioResults` de agentHelpers). Essa função é chamada dentro de `runScenario`. Se `PlaygroundScenariosTab` precisar chamar `runScenario` como callback, a função deve permanecer no orquestrador.

**Como evitar:** `runScenario` permanece no orquestrador e é passado como `onRunScenario` callback para `PlaygroundScenariosTab`. O sub-componente não precisa importar `computeResults`.

### Pitfall 5: Importação de `scrollRef` e `inputRef` para funcionalidades de scroll/focus

**O que vai errado:** `scrollRef` e `inputRef` são usados dentro de `sendToAgent` (auto-scroll) e `handleSend` (re-focus). Se `renderChatMessages()` e `renderInputBar()` viram o corpo de `PlaygroundManualTab`, os refs precisam ser passados como props.

**Como evitar:** Passar `scrollRef` e `inputRef` como props para `PlaygroundManualTab`, ou — mais limpo — criar os refs dentro do próprio `PlaygroundManualTab` (estado de UI local) e expor o comportamento via `useImperativeHandle` se necessário. Dado D-02, criar os refs dentro do sub-componente é aceitável pois são estado de UI (scroll position, input focus), não estado de domínio.

**Decisão recomendada:** Mover `scrollRef` e `inputRef` para dentro de `PlaygroundManualTab`. Os handlers `sendToAgent` e `handleSend` que precisam deles ficam no orquestrador e recebem acesso via callback pattern ou o sub-componente usa `useCallback` local para esses efeitos visuais.

### Pitfall 6: `fileInputRef` em CatalogConfig

**O que vai errado:** `fileInputRef` referencia o `<input type="file">` dentro do form Dialog. Se `CatalogProductForm` receber `handleFileUpload` como callback mas o `fileInputRef` ficar no orquestrador, o ref não aponta para nenhum elemento do DOM.

**Como evitar:** `fileInputRef` deve ser criado dentro de `CatalogProductForm` (é estado de UI local, permitido por D-02). O handler `handleFileUpload` pode ficar no orquestrador e receber os `files` como argumento, ou pode viver dentro de `CatalogProductForm` se a lógica de upload (Supabase Storage) for passada via callback `onUpload(files: FileList)`.

**Decisão recomendada:** `handleFileUpload` fica no orquestrador (acessa `agentId`, `setForm`, `setUploading`), recebendo `files: FileList` como parâmetro. `fileInputRef` fica em `CatalogProductForm`.

---

## Code Examples

### Distribuição de props para PlaygroundManualTab (orquestrador)

```typescript
// AIAgentPlayground.tsx — dentro de <TabsContent value="manual">
<PlaygroundManualTab
  messages={messages}
  sending={sending}
  input={input}
  attachedImage={attachedImage}
  bufferMode={bufferMode}
  bufferSec={bufferSec}
  bufferCountdown={bufferCountdown}
  showOverrides={showOverrides}
  overrides={overrides}
  selectedAgent={selectedAgent}
  totalTokens={totalTokens}
  avgLatency={avgLatency}
  onInputChange={setInput}
  onSend={handleSend}
  onClear={handleClear}
  onAttachImage={setAttachedImage}
  onBufferModeChange={setBufferMode}
  onBufferSecChange={setBufferSec}
  onOverridesChange={setOverrides}
  onShowOverridesToggle={() => setShowOverrides(v => !v)}
  onRateMessage={rateMessage}
  onReplayMessage={replayMessage}
  onRunPersona={runPersona}
/>
```

### Distribuição de props para CatalogTable (orquestrador)

```typescript
// CatalogConfig.tsx
<CatalogTable
  products={products}
  filtered={filtered}
  loading={loading}
  search={search}
  categoryFilter={categoryFilter}
  stockFilter={stockFilter}
  sortBy={sortBy}
  selectedIds={selectedIds}
  categories={categories}
  onSearchChange={setSearch}
  onCategoryFilterChange={setCategoryFilter}
  onStockFilterChange={setStockFilter}
  onSortByChange={setSortBy}
  onToggleSelect={toggleSelect}
  onToggleSelectAll={toggleSelectAll}
  onBulkAction={handleBulkAction}
  onEdit={openEdit}
  onDeleteRequest={(p) => { setDeleteTarget(p); setDeleteOpen(true); }}
  onAddNew={openNew}
/>
```

### src/types/playground.ts — estrutura esperada

```typescript
// Tipos
export interface AIAgent { ... }
export interface ToolCall { ... }
export interface ChatMessage { ... }
export interface PlaygroundResponse { ... }
export interface Overrides { ... }
export type ScenarioCategory = 'vendas' | 'suporte' | ...;
export interface TestStep { ... }
export interface ExpectedOutcome { ... }
export interface TestScenario { ... }
export interface ScenarioRunResults { ... }
export interface ScenarioRun { ... }
export type WatchSpeed = 0.5 | 1 | 1.5 | 2 | 3;

// Constantes
export const TOOL_META: Record<string, { ... }> = { ... };
export const ALL_TOOLS = Object.keys(TOOL_META);
export const MODELS = [...];
export const PERSONAS = [...];
export const CATEGORY_META: Record<ScenarioCategory, { ... }> = { ... };
export const DIFFICULTY_COLORS = { ... };
export const TEST_SCENARIOS: TestScenario[] = [ ... ];
```

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Comando rápido | `npx vitest run` |
| Suite completa | `npx vitest run` |
| Setup file | `src/test/setup.ts` |

### Descoberta crítica: os 7 testes NÃO importam de AIAgentPlayground.tsx

Todos os 7 arquivos de teste do Playground importam de `../../../../supabase/functions/_shared/agentHelpers.ts`:

| Arquivo de Teste | Importa de |
|-----------------|------------|
| PlaygroundEdgeCases.test.ts | `_shared/agentHelpers.ts` |
| PlaygroundScenarios.test.ts | `_shared/agentHelpers.ts` |
| PlaygroundGreeting.test.ts | `_shared/agentHelpers.ts` |
| PlaygroundTools.test.ts | `_shared/agentHelpers.ts` |
| PlaygroundPrompt.test.ts | `_shared/agentHelpers.ts` |
| PlaygroundMediaAudio.test.ts | `_shared/agentHelpers.ts` |
| PlaygroundIntegration.test.ts | `_shared/agentHelpers.ts` |

**Implicação:** A decisão D-08 ("atualizar imports dos testes para `src/types/playground.ts`") provavelmente não tem trabalho real. Os testes não precisam de atualização de imports pois não importam tipos do componente. A tarefa deve verificar isso e documentar o resultado — se a afirmação se confirmar, D-08 é trivialmente satisfeita.

### Mapeamento de Critérios de Aceite → Testes

| Critério | Verificação | Comando |
|----------|-------------|---------|
| D-12: AIAgentPlayground < 300 LOC | Contagem de linhas | `wc -l src/pages/dashboard/AIAgentPlayground.tsx` |
| D-13: CatalogConfig < 300 LOC | Contagem de linhas | `wc -l src/components/admin/ai-agent/CatalogConfig.tsx` |
| D-14: Nenhuma regressão | Suite de testes | `npx vitest run` |
| D-15: Tipos exportados | Compilação TypeScript | `npx tsc --noEmit` |

### Gaps de Wave 0

None — a infraestrutura de testes existente cobre todos os critérios de aceite desta fase. Nenhum novo arquivo de teste precisa ser criado.

---

## Open Questions

1. **Localização de `filteredScenarios` e `filtered` (cálculos derivados)**
   - O que sabemos: `filteredScenarios` é usado apenas na renderização das tabs de Cenários e E2E. `filtered` é usado no render de CatalogTable e em `toggleSelectAll`.
   - O que está indefinido: Se esses cálculos ficam no orquestrador (e são passados como props) ou dentro dos sub-componentes (que recebem o state bruto e fazem a filtragem internamente).
   - Recomendação: Passar o state bruto para os sub-componentes e deixar a filtragem dentro deles — mais coeso, menos props. Exceção: se o orquestrador precisar do `filtered.length` para alguma renderização no header/tabs, o cálculo fica no orquestrador.

2. **Onde colocar `TEST_SCENARIOS` — em `src/types/playground.ts` ou `src/data/playgroundScenarios.ts`?**
   - O que sabemos: `TEST_SCENARIOS` é um array de dados, não um tipo. `src/types/` convencionalmente contém apenas interfaces e tipos.
   - Recomendação: Colocar em `src/types/playground.ts` junto com os tipos conforme D-07 (o CONTEXT.md menciona explicitamente que podem mover para esse arquivo). Alternativamente, um arquivo separado `src/data/playgroundScenarios.ts` — Claude decide.

3. **Impacto no LOC do orquestrador após mover apenas tipos vs. tipos + constantes**
   - O que sabemos: Os tipos (linhas ~35–125) + constantes (linhas ~130–375) somam aproximadamente 345 linhas. O orquestrador (linhas ~380–1353) tem ~973 linhas. Mesmo após mover tipos e constantes, a função componente sozinha tem ~973 linhas.
   - **Conclusão:** Mover tipos e constantes para `src/types/playground.ts` reduz o arquivo de 1353 para ~973 linhas — mas ainda não atinge < 300. A extração das 4 TabsContent para sub-componentes é **obrigatória** para atingir D-12. As TabsContent somam aproximadamente 480–500 linhas (linhas 876–1350), o que deixaria o orquestrador em ~470–490 LOC após extração dos tabs — ainda acima de 300. Isso confirma que mover tipos E constantes E extrair tabs são todos necessários juntos.

---

## Environment Availability

> Esta fase é puramente frontend — código React/TypeScript. Sem dependências externas além do toolchain já em uso.

| Dependência | Necessária para | Disponível | Observação |
|-------------|----------------|-----------|------------|
| Node.js | `npx vitest run` | Sim (já em uso) | — |
| npm | Instalar pacotes | Sim (já em uso) | Nenhum pacote novo |
| Vitest | Gate de qualidade | Sim (vitest.config.ts presente) | `npx vitest run` |
| TypeScript compiler | Verificação de tipos | Sim (tsconfig.json presente) | `npx tsc --noEmit` |

---

## Sources

### Primary (HIGH confidence)
- Leitura direta de `AIAgentPlayground.tsx` (1353 LOC, linhas 1–1353) — análise de tipos, constantes, state, handlers, render por tab
- Leitura direta de `CatalogConfig.tsx` (704 LOC, linhas 1–704) — análise completa do arquivo
- Leitura de `vitest.config.ts` — configuração real do test runner
- Leitura dos 7 arquivos de teste — verificação de imports reais (todos apontam para `_shared/agentHelpers.ts`)
- Leitura de `04-CONTEXT.md` — decisões locked do usuário

### Secondary (MEDIUM confidence)
- Análise de `REQUIREMENTS.md` — confirma que não há requisitos de negócio afetados por esta fase (refactor puro)
- Análise de `CLAUDE.md` — padrões de projeto (React 18, TypeScript, Vite, shadcn/ui)

---

## Project Constraints (from CLAUDE.md)

Diretivas aplicáveis a esta fase:

| Diretiva | Impacto nesta fase |
|----------|-------------------|
| React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui | Todos os novos arquivos seguem este stack |
| `@/` path alias para `src/` | `import { ... } from '@/types/playground'` funciona |
| Nenhuma nova dependência implícita | Sem `npm install` necessário |
| Componentes em `src/components/` e páginas em `src/pages/` | Sub-componentes do Playground em `src/components/admin/ai-agent/playground/` |
| Tipos em `src/types/` | `src/types/playground.ts` é o destino correto |

---

## Metadata

**Confidence breakdown:**
- Estrutura atual dos arquivos: HIGH — leitura direta do código
- Fronteiras de extração (quais linhas vão para cada sub-componente): HIGH — tab boundaries claramente demarcadas no código
- Imports dos testes: HIGH — verificado linha a linha em todos os 7 arquivos
- LOC estimado dos sub-componentes: MEDIUM — estimativa baseada em leitura do JSX, não contagem exata
- Suficiência da extração para atingir < 300 LOC: MEDIUM — requer análise mais precisa das linhas do componente após remoção de tipos/constantes

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (código estático, sem dependências externas)
