# Phase 4: Decomposição de Componentes Gigantes — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduzir o LOC dos dois maiores componentes frontend para facilitar manutenção:
- `src/pages/dashboard/AIAgentPlayground.tsx` (1353 LOC) → < 300 LOC (orquestrador)
- `src/components/admin/ai-agent/CatalogConfig.tsx` (704 LOC) → < 300 LOC (orquestrador)

Sem novos comportamentos — apenas reorganização estrutural. Zero mudanças de backend.

</domain>

<decisions>
## Implementation Decisions

### Arquitetura de Estado

- **D-01:** Estado permanece **100% no orquestrador** — sub-componentes recebem props e disparam callbacks. Nenhuma extração de hooks customizados. Abordagem "props + callbacks": orquestrador continua com todos os `useState` e `useRef`; sub-componentes são puramente visuais/funcionais.
- **D-02:** Sub-componentes NÃO gerenciam estado próprio de domínio — apenas estado interno de UI local (ex: hover, focus) se necessário.

### Decomposição do AIAgentPlayground

- **D-03:** Naming alinha com as **tabs reais**, não com a lista do ROADMAP:
  - `PlaygroundManualTab` — chat + input + buffer mode + tool inspector inline
  - `PlaygroundScenariosTab` — lista de cenários + execução de cenário
  - `PlaygroundResultsTab` — histórico de runs (runHistory)
  - `PlaygroundE2eTab` — E2E real com número configurável + live steps
- **D-04:** `PlaygroundToolInspector` do ROADMAP NÃO se torna componente separado — permanece inline dentro de `PlaygroundManualTab` (é parte do chat, não uma seção independente).
- **D-05:** O orquestrador `AIAgentPlayground.tsx` mantém: seleção de agente, fetchAgents, distribuição de state para as 4 tabs via props, renderização do header (agente selector + overrides + export).
- **D-06:** Os 4 sub-componentes ficam em `src/components/admin/ai-agent/playground/` (nova subpasta) para não poluir o diretório raiz.

### Tipos (AIAgentPlayground)

- **D-07:** Todos os tipos/interfaces inline do Playground migram para `src/types/playground.ts`:
  - `AIAgent`, `ToolCall`, `ChatMessage`, `PlaygroundResponse`, `Overrides`
  - `ScenarioCategory`, `TestStep`, `ExpectedOutcome`, `TestScenario`, `ScenarioRun`, `ScenarioRunResults`
  - `WatchSpeed` e quaisquer outros tipos definidos no topo do arquivo
- **D-08:** Os 7 arquivos de teste que importam tipos de `AIAgentPlayground.tsx` devem ter seus imports atualizados para `src/types/playground.ts` como parte desta fase. Critério: `npx vitest run` deve continuar verde após a extração.

### Decomposição do CatalogConfig

- **D-09:** `BatchScrapeImport.tsx` e `CsvProductImport.tsx` já estão extraídos — não recriar. O "CatalogImportPanel" do ROADMAP está parcialmente concluído.
- **D-10:** Extrair ainda:
  - `CatalogTable` — listagem de produtos com search/filter (category, stock)/sort/bulk selection (selectedIds + handleBulkAction). Recebe `products`, `search`, `categoryFilter`, `stockFilter`, `sortBy`, `selectedIds` e callbacks como props.
  - `CatalogProductForm` — Dialog de criar/editar produto: form state recebido via props (`form`, `editing`, `saving`, `uploading`, `generatingDesc`), callbacks (`onSave`, `onDelete`, `onUpload`, `onGenerateDesc`). Inclui image management inline (upload + reorder + featured).
- **D-11:** Os 2 novos componentes ficam em `src/components/admin/ai-agent/` (mesmo nível dos existentes, sem subpasta).

### Critérios de Conclusão

- **D-12:** `AIAgentPlayground.tsx` < 300 LOC após extração (orquestrador + imports + distribuição de props)
- **D-13:** `CatalogConfig.tsx` < 300 LOC após extração
- **D-14:** `npx vitest run` verde — zero regressões (inclui atualização de imports dos testes)
- **D-15:** Tipos exportados de `src/types/playground.ts` (reutilizáveis por testes e sub-componentes)

### Claude's Discretion

- Ordem de extração por arquivo (Playground primeiro ou CatalogConfig primeiro): Claude decide baseado em risco
- Se algum sub-componente ficar > 200 LOC, Claude pode extrair helpers internos adicionais sem consultar o usuário
- Props interfaces dos sub-componentes: Claude define os nomes de props (não há requisito de naming específico)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquivos de escopo direto
- `src/pages/dashboard/AIAgentPlayground.tsx` — orquestrador principal (1353 LOC); 17 useState, 4 tabs, tipos inline no topo
- `src/components/admin/ai-agent/CatalogConfig.tsx` — config de catálogo (704 LOC); já usa BatchScrapeImport + CsvProductImport
- `src/components/admin/ai-agent/BatchScrapeImport.tsx` — já extraído (161 LOC)
- `src/components/admin/ai-agent/CsvProductImport.tsx` — já extraído (343 LOC)

### Destinos novos (a criar)
- `src/components/admin/ai-agent/playground/` — subpasta para os 4 sub-componentes do Playground
- `src/types/playground.ts` — tipos extraídos do Playground

### Testes existentes (imports a atualizar)
- `src/pages/dashboard/__tests__/PlaygroundEdgeCases.test.ts`
- `src/pages/dashboard/__tests__/PlaygroundScenarios.test.ts`
- `src/pages/dashboard/__tests__/PlaygroundGreeting.test.ts`
- `src/pages/dashboard/__tests__/PlaygroundIntegration.test.ts`
- `src/pages/dashboard/__tests__/PlaygroundMediaAudio.test.ts`
- `src/pages/dashboard/__tests__/PlaygroundPrompt.test.ts`
- `src/pages/dashboard/__tests__/PlaygroundTools.test.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Estado do Playground por responsabilidade
```typescript
// Agents
const [agents, setAgents] = useState<AIAgent[]>([]);
const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

// Chat + buffer mode (ManualTab)
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [input, setInput] = useState('');
const [sending, setSending] = useState(false);
const [attachedImage, setAttachedImage] = useState<string | null>(null);
const [bufferMode, setBufferMode] = useState(false);
const [bufferSec, setBufferSec] = useState(10);
const [bufferedMsgs, setBufferedMsgs] = useState<string[]>([]);
const [bufferCountdown, setBufferCountdown] = useState(0);

// Overrides
const [showOverrides, setShowOverrides] = useState(false);
const [overrides, setOverrides] = useState<Overrides>({...});

// Tabs
const [activeTab, setActiveTab] = useState<'manual' | 'scenarios' | 'results' | 'e2e'>('manual');

// E2E (E2eTab)
const [e2eNumber, setE2eNumber] = useState('5581985749970');
const [e2eRunning, setE2eRunning] = useState(false);
const [e2eResults, setE2eResults] = useState<any[]>([]);
const [e2eCurrentScenario, setE2eCurrentScenario] = useState<string | null>(null);
const [e2eLiveSteps, setE2eLiveSteps] = useState<any[]>([]);
const [e2eSelectedScenario, setE2eSelectedScenario] = useState<TestScenario | null>(null);

// Scenarios (ScenariosTab)
const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all');
const [scenarioSearch, setScenarioSearch] = useState('');
const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
const [scenarioRun, setScenarioRun] = useState<ScenarioRun | null>(null);
```

### Estado do CatalogConfig por responsabilidade
```typescript
// Produtos
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(true);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// CRUD (ProductForm)
const [dialogOpen, setDialogOpen] = useState(false);
const [deleteOpen, setDeleteOpen] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
const [editing, setEditing] = useState<Product | null>(null);
const [form, setForm] = useState(EMPTY_PRODUCT);
const [saving, setSaving] = useState(false);
const [uploading, setUploading] = useState(false);
const [generatingDesc, setGeneratingDesc] = useState(false);

// Import URL (já inline no orquestrador, CSV/Batch já extraídos)
const [importUrl, setImportUrl] = useState('');
const [importing, setImporting] = useState(false);
const [importOpen, setImportOpen] = useState(false);
const [importStatus, setImportStatus] = useState('');

// Filtros (CatalogTable)
const [search, setSearch] = useState('');
const [categoryFilter, setCategoryFilter] = useState('all');
const [stockFilter, setStockFilter] = useState('all');
const [sortBy, setSortBy] = useState<'position' | 'title' | 'price' | 'created_at'>('position');
```

### Tabs do Playground
```typescript
// Linha 867-872:
<Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
  <TabsTrigger value="manual">Chat Manual</TabsTrigger>
  <TabsTrigger value="scenarios">Cenários</TabsTrigger>
  <TabsTrigger value="results">Resultados</TabsTrigger>
  <TabsTrigger value="e2e">E2E Real</TabsTrigger>
</Tabs>
// manual: linhas ~876–930
// scenarios: linhas ~933–1145
// results: linhas ~1148–1210
// e2e: linhas ~1213–1346
```

</code_context>

<specifics>
## Specific Ideas

- Sub-componentes do Playground devem ser arquivos independentes em `src/components/admin/ai-agent/playground/` — não exportar de um barrel index ainda (sem abstração prematura)
- `TEST_SCENARIOS` (array de cenários hardcoded no Playground) pode mover para `src/types/playground.ts` ou `src/data/playgroundScenarios.ts` — Claude decide onde faz mais sentido após ler o código
- O orquestrador AIAgentPlayground.tsx após extração deve ficar com: imports, state declarations, fetchAgents, handleSend/handleClear principais, renderização do header + Tabs shell + instanciação dos 4 TabsContent

</specifics>

<deferred>
## Deferred Ideas

None — discussão se manteve dentro do escopo da fase.

</deferred>

---

*Phase: 04-decomposicao-de-componentes-gigantes*
*Context gathered: 2026-03-29 via /gsd:discuss-phase 4*
