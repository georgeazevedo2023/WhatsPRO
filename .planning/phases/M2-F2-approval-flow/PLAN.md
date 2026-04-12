---
phase: M2-F2-approval-flow
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/admin/ai-agent/playground/ApprovalQueue.tsx
  - src/components/admin/ai-agent/playground/ReviewDrawer.tsx
  - src/hooks/useE2eApproval.ts
  - src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx
  - src/pages/dashboard/AIAgentPlayground.tsx
autonomous: false
requirements:
  - M2-F2
must_haves:
  truths:
    - "super_admin vê badge de pendentes (approval=null) no header da aba E2E"
    - "Ao clicar no badge, abre painel ApprovalQueue com lista de runs pendentes"
    - "Cada item da fila mostra: nome do cenário, categoria, data, tools_missing, tools_unexpected"
    - "Clicar em um item abre ReviewDrawer com detalhes completos do run (steps, resposta do agente, tools usadas)"
    - "Botões Aprovar (verde) e Rejeitar (vermelho) com campo de notes aparecem no drawer"
    - "Após aprovar/rejeitar, o item desaparece da fila (otimistic update)"
    - "Status badges colorem o histórico: running=azul, complete=cinza, approved=verde, rejected=vermelho"
    - "Apenas super_admin vê e pode usar os controles de aprovação (RLS garante no banco)"
  artifacts:
    - path: "src/hooks/useE2eApproval.ts"
      provides: "TanStack Query hook — fetch pendentes + mutate approve/reject"
      exports: ["useE2eApproval"]
    - path: "src/components/admin/ai-agent/playground/ApprovalQueue.tsx"
      provides: "Lista de runs com approval=null agrupados por batch_id"
      min_lines: 80
    - path: "src/components/admin/ai-agent/playground/ReviewDrawer.tsx"
      provides: "Sheet lateral com detalhes do run + ações de aprovação"
      min_lines: 100
  key_links:
    - from: "PlaygroundE2eTab.tsx"
      to: "ApprovalQueue.tsx"
      via: "pendingCount badge click → setShowApprovalQueue(true)"
      pattern: "pendingCount|showApprovalQueue"
    - from: "useE2eApproval.ts"
      to: "supabase e2e_test_runs"
      via: "UPDATE approval, approved_by, approved_at, reviewer_notes"
      pattern: "supabase.*e2e_test_runs.*update"
---

<objective>
Implementar o fluxo de aprovação admin para resultados E2E. Após uma batch rodar, o super_admin
pode revisar runs que falharam (approval=null), inspecionar os detalhes, e marcar como
Aprovado (falso positivo) ou Rejeitado (regressão real) com notes.

Purpose: Criar uma porta de qualidade formal antes de considerar o agente "production-ready".
Sem esse fluxo, runs falhos ficam invisíveis no banco sem ninguém analisar.

Output:
- Hook useE2eApproval.ts (TanStack Query, mutation com rollback)
- Componente ApprovalQueue.tsx (lista de pendentes)
- Componente ReviewDrawer.tsx (sheet de inspeção + ações)
- Modificações em PlaygroundE2eTab.tsx (badge de pendentes + toggle)
- Modificações em AIAgentPlayground.tsx (wire up agentId para o hook)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/research/RESEARCH-qa-framework.md
@.planning/codebase/validator-metrics.md

<interfaces>
<!-- Tipos relevantes do banco — usar diretamente, não explorar o codebase. -->

Da src/integrations/supabase/types.ts, tabela e2e_test_runs Row:
```typescript
{
  id: string
  agent_id: string
  approval: string | null          // null=pendente, 'auto_approved', 'human_approved', 'human_rejected'
  approved_at: string | null
  approved_by: string | null
  batch_id: string | null
  batch_uuid: string | null
  category: string | null
  created_at: string
  error: string | null
  instance_id: string
  latency_ms: number | null
  passed: boolean
  prompt_hash: string | null
  results: Json                    // E2eResult[] — steps com tools_used, agent_response
  reviewer_notes: string | null
  run_type: string
  scenario_id: string
  scenario_name: string
  skip_reason: string | null
  skipped: boolean
  test_number: string
  tools_missing: string[] | null
  tools_used: string[] | null
  total_steps: number
}
```

Da src/integrations/supabase/types.ts, tabela e2e_test_batches Row:
```typescript
{
  id: string
  agent_id: string
  batch_id: string
  completed_at: string | null
  composite_score: number | null
  created_by: string | null
  failed: number
  passed: number
  run_type: string
  started_at: string
  status: string                   // 'running' | 'complete' | 'approved' | 'rejected'
  total: number
  metadata: Json | null
}
```
NOTA: approved_by, approved_at, reviewer_notes existem na MIGRATION mas AINDA NÃO estão
no types.ts para e2e_test_batches. A aprovação DEVE ser feita via e2e_test_runs (que
JÁ TEM essas colunas no types.ts). Não usar e2e_test_batches para gravar aprovação.

Do src/pages/dashboard/AIAgentPlayground.tsx:
```typescript
const { isSuperAdmin } = useAuth();  // disponível via useAuth()
const selectedAgentId: string | null
// Tab atual:
const [activeTab, setActiveTab] = useState<'manual' | 'scenarios' | 'results' | 'e2e'>('manual');
// E2E tab usa:
<PlaygroundE2eTab
  e2eNumber={e2eNumber}
  e2eRunning={e2eRunning}
  e2eResults={e2eResults}
  ...
  selectedAgent={selectedAgent}
/>
```

Do src/contexts/AuthContext (padrão do projeto):
```typescript
const { user, isSuperAdmin } = useAuth();
user.id  // UUID do usuário logado
```

shadcn/ui componentes disponíveis:
- Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription (drawer lateral)
- Textarea (para reviewer_notes)
- Badge (para status badges)
- Button (para aprovar/rejeitar)
- ScrollArea
- Separator
- Card, CardContent

Lucide icons disponíveis (já em uso no projeto):
- CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight
- ThumbsUp, ThumbsDown (para aprovação)
</interfaces>
</context>

## O QUE NÃO ALTERAR

- `src/types/playground.ts` — não adicionar novos tipos aqui (tipos de aprovação ficam no hook)
- `supabase/functions/e2e-test/` — sem mudanças no backend
- `PlaygroundScenariosTab.tsx`, `PlaygroundManualTab.tsx`, `PlaygroundResultsTab.tsx` — não tocam nisso
- `src/integrations/supabase/types.ts` — não editar manualmente (gerado pelo Supabase CLI)
- A lógica `runAllE2e` e `runE2eScenario` em AIAgentPlayground.tsx — não alterar o runner
- RLS policies — já existem na migration, não criar nova migration

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Hook useE2eApproval — fetch pendentes + mutações approve/reject</name>
  <files>src/hooks/useE2eApproval.ts</files>
  <action>
Criar hook TanStack Query com três responsabilidades:

**1. Query de pendentes:**
```typescript
// Busca runs com approval=null para o agente selecionado
// Ordena por created_at DESC (mais recentes primeiro)
// Inclui apenas runs que falharam (passed=false) pois runs passados são auto_approved
useQuery({
  queryKey: ['e2e-pending', agentId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('e2e_test_runs')
      .select('id, scenario_id, scenario_name, category, created_at, passed, tools_missing, tools_used, error, results, batch_id, latency_ms, total_steps')
      .eq('agent_id', agentId)
      .is('approval', null)
      .eq('passed', false)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },
  enabled: !!agentId,
  staleTime: 30_000,
})
```

**2. Mutation de aprovação (approve):**
```typescript
useMutation({
  mutationFn: async ({ runId, notes }: { runId: string; notes: string }) => {
    const { error } = await supabase
      .from('e2e_test_runs')
      .update({
        approval: 'human_approved',
        approved_by: userId,    // auth.uid() — receber via parâmetro ou useAuth()
        approved_at: new Date().toISOString(),
        reviewer_notes: notes || null,
      })
      .eq('id', runId);
    if (error) throw error;
  },
  onMutate: async ({ runId }) => {
    // Optimistic: remover da lista de pendentes imediatamente
    await queryClient.cancelQueries({ queryKey: ['e2e-pending', agentId] });
    const previous = queryClient.getQueryData(['e2e-pending', agentId]);
    queryClient.setQueryData(['e2e-pending', agentId], (old: PendingRun[]) =>
      old.filter(r => r.id !== runId)
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    // Rollback se falhar
    queryClient.setQueryData(['e2e-pending', agentId], context?.previous);
    toast.error('Erro ao aprovar — tente novamente');
  },
  onSuccess: () => {
    toast.success('Run aprovado');
    queryClient.invalidateQueries({ queryKey: ['e2e-pending', agentId] });
  },
})
```

**3. Mutation de rejeição (reject):**
Mesma estrutura do approve mas `approval: 'human_rejected'`. Toast de sucesso: 'Run rejeitado — marcar para correção'.

**Tipos exportados:**
```typescript
export interface PendingRun {
  id: string;
  scenario_id: string;
  scenario_name: string;
  category: string | null;
  created_at: string;
  passed: boolean;
  tools_missing: string[] | null;
  tools_used: string[] | null;
  error: string | null;
  results: unknown;  // E2eResult[] — acessar como (results as E2eResult[])
  batch_id: string | null;
  latency_ms: number | null;
  total_steps: number;
}

export interface UseE2eApprovalReturn {
  pending: PendingRun[];
  pendingCount: number;
  isLoading: boolean;
  approve: (runId: string, notes: string) => Promise<void>;
  reject: (runId: string, notes: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
}
```

Hook recebe: `(agentId: string | null, userId: string | undefined)`
Retorna objeto UseE2eApprovalReturn.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep "useE2eApproval" | head -20</automated>
  </verify>
  <done>
    - Arquivo criado em src/hooks/useE2eApproval.ts
    - Compila sem erros TypeScript
    - Exporta useE2eApproval, PendingRun, UseE2eApprovalReturn
    - Optimistic update funciona (onMutate remove item da lista imediatamente)
    - Rollback funciona (onError restaura lista anterior)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: ApprovalQueue + ReviewDrawer — UI de revisão com approve/reject</name>
  <files>
    src/components/admin/ai-agent/playground/ApprovalQueue.tsx,
    src/components/admin/ai-agent/playground/ReviewDrawer.tsx
  </files>
  <action>
**ApprovalQueue.tsx** — lista de runs pendentes com abertura de drawer:

Props:
```typescript
interface ApprovalQueueProps {
  agentId: string;
  userId: string;
  onClose: () => void;
}
```

Layout:
- Header: "Fila de Aprovação" + count badge + botão X para fechar
- Para cada PendingRun, mostrar Card com:
  - Linha 1: nome do cenário + badge da categoria (usar CATEGORY_META de '@/types/playground' para cor)
  - Linha 2: `tools_missing` como badges vermelhos, `tools_used` como badges verdes
  - Linha 3: data formatada (toLocaleDateString pt-BR) + latência
  - Botão "Revisar" → abre ReviewDrawer com esse run selecionado
- Estado vazio: ícone CheckCircle2 verde + "Nenhum run pendente"
- Usa ScrollArea para lista

Não fazer approve/reject direto na lista — sempre abrir ReviewDrawer para forçar análise.

---

**ReviewDrawer.tsx** — Sheet lateral (right side, size="lg") para inspeção:

Props:
```typescript
interface ReviewDrawerProps {
  run: PendingRun | null;
  onClose: () => void;
  onApprove: (runId: string, notes: string) => Promise<void>;
  onReject: (runId: string, notes: string) => Promise<void>;
  isApproving: boolean;
  isRejecting: boolean;
}
```

Layout da Sheet (SheetContent side="right" className="w-[500px] sm:w-[600px]"):
```
SheetHeader:
  SheetTitle: nome do cenário
  SheetDescription: categoria • data • batch_id (primeiros 8 chars)

Seção "Resultado":
  Badge: PASSOU / FALHOU (verde/vermelho)
  Latência: {latency_ms}ms • {total_steps} steps

Seção "Tools":
  Tools usadas: lista de badges (outline, azul)
  Tools faltando: lista de badges (destructive, vermelho)
  — se tools_missing está vazio: "Nenhuma tool faltando" em texto verde

Seção "Erro" (só se run.error existe):
  Code block com texto do erro

Seção "Steps" (dados de run.results como E2eResult[]):
  Accordion com cada step:
    - Step N: input do lead
    - Resposta do agente (truncada a 200 chars, com "ver mais")
    - Tools chamadas nesse step

Seção "Revisão do Admin":
  Textarea label="Notas de revisão" placeholder="Descreva o que foi analisado..."
  value={notes} onChange={setNotes}
  helperText: "Explique se é falso positivo, bug no cenário, ou regressão real"

Footer com dois botões:
  <Button variant="destructive" disabled={isRejecting || isApproving} onClick={handleReject}>
    <XCircle /> Rejeitar — Regressão Real
  </Button>
  <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700" disabled={isApproving || isRejecting} onClick={handleApprove}>
    <CheckCircle2 /> Aprovar — Falso Positivo
  </Button>
```

Estado interno: `const [notes, setNotes] = useState('')`
Resetar notes quando `run` mudar (useEffect).

handleApprove: chama `onApprove(run.id, notes)` → após resolve, chama `onClose()`.
handleReject: chama `onReject(run.id, notes)` → após resolve, chama `onClose()`.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep -E "ApprovalQueue|ReviewDrawer" | head -20</automated>
  </verify>
  <done>
    - ApprovalQueue.tsx criado sem erros TypeScript
    - ReviewDrawer.tsx criado sem erros TypeScript
    - ReviewDrawer recebe PendingRun e exibe steps, tools_missing, erro
    - Ambos os botões (Aprovar/Rejeitar) disparam as mutações corretas
    - Textarea de notes é obrigatória visualmente (não bloqueia, mas placeholder explica)
    - Estado vazio de ApprovalQueue mostra CheckCircle2 verde
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Integrar aprovação em PlaygroundE2eTab e AIAgentPlayground</name>
  <files>
    src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx,
    src/pages/dashboard/AIAgentPlayground.tsx
  </files>
  <action>
**PlaygroundE2eTab.tsx — mudanças:**

Adicionar nas props da interface PlaygroundE2eTabProps:
```typescript
pendingCount: number;
onToggleApprovalQueue: () => void;
showApprovalQueue: boolean;
agentId: string | null;
userId: string | undefined;
```

Na barra de config (linha ~44, onde estão os badges de run), adicionar ANTES do botão "Rodar Todos":
```tsx
{pendingCount > 0 && (
  <Button
    size="sm"
    variant="outline"
    className="text-xs h-7 gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
    onClick={onToggleApprovalQueue}
  >
    <Clock className="w-3.5 h-3.5" />
    {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
  </Button>
)}
```

Importar e renderizar ApprovalQueue quando showApprovalQueue=true:
```tsx
{showApprovalQueue && agentId && userId && (
  <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm rounded-lg">
    <ApprovalQueue
      agentId={agentId}
      userId={userId}
      onClose={onToggleApprovalQueue}
    />
  </div>
)}
```

Adicionar status badges para e2eResults. Cada E2eRunResult na lista precisa mostrar um status visual.
Na lista de resultados, ao exibir cada run, usar o campo `approval` do DB (mas como E2eRunResult
é um tipo local, apenas mostrar PASSOU/FALHOU como antes — o badge de approval fica no ApprovalQueue).

---

**AIAgentPlayground.tsx — mudanças:**

1. Importar useE2eApproval:
```typescript
import { useE2eApproval } from '@/hooks/useE2eApproval';
```

2. Importar useAuth para pegar user.id (já importado via `const { isSuperAdmin } = useAuth()`):
```typescript
const { isSuperAdmin, user } = useAuth();
```

3. Adicionar estado:
```typescript
const [showApprovalQueue, setShowApprovalQueue] = useState(false);
```

4. Instanciar hook (após selectedAgentId estar disponível):
```typescript
const { pendingCount } = useE2eApproval(selectedAgentId, user?.id);
```

5. Passar novas props para PlaygroundE2eTab:
```tsx
<PlaygroundE2eTab
  // ... props existentes ...
  pendingCount={pendingCount}
  showApprovalQueue={showApprovalQueue}
  onToggleApprovalQueue={() => setShowApprovalQueue(p => !p)}
  agentId={selectedAgentId}
  userId={user?.id}
/>
```

6. No header do Playground (linha ~302, abaixo da badge de sessão), adicionar badge de pendentes
visível em TODAS as abas (não só E2E):
```tsx
{pendingCount > 0 && (
  <Badge
    variant="outline"
    className="cursor-pointer border-amber-500/40 text-amber-400 text-[10px] gap-1"
    onClick={() => { setActiveTab('e2e'); setShowApprovalQueue(true); }}
  >
    <Clock className="w-3 h-3" />
    {pendingCount} para revisar
  </Badge>
)}
```

CUIDADO: não alterar as linhas de `runAllE2e`, `runE2eScenario`, `saveE2eResult` — essas funções
não mudam. Apenas adicionar o hook e passar as novas props.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep -E "error TS" | grep -v "node_modules" | head -30</automated>
  </verify>
  <done>
    - PlaygroundE2eTab compila com as novas props
    - AIAgentPlayground compila com o hook instanciado
    - Badge de pendentes aparece no header quando pendingCount > 0
    - Clicar no badge redireciona para aba E2E e abre ApprovalQueue
    - Nenhum erro TypeScript em arquivos modificados
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Fluxo completo de aprovação:
    - Hook useE2eApproval com optimistic updates
    - ApprovalQueue listando runs com approval=null e passed=false
    - ReviewDrawer com detalhes completos + botões Aprovar/Rejeitar
    - Badge de pendentes no header do Playground e na aba E2E
    - Integração no AIAgentPlayground.tsx passando agentId e userId
  </what-built>
  <how-to-verify>
    1. Acesse /dashboard/playground como super_admin
    2. Se não houver runs pendentes: crie um manualmente no Supabase:
       INSERT INTO e2e_test_runs (agent_id, instance_id, test_number, scenario_id, scenario_name,
       category, passed, approval, results, run_type, total_steps)
       VALUES ('[seu-agent-id]', '[seu-instance-id]', '5511999999999',
       'sc_transbordo_01', 'Cenário Transbordo', 'transbordo', false, null, '[]', 'manual', 0);
    3. Recarregue a página — badge "1 para revisar" deve aparecer no header
    4. Clique no badge → deve ir para aba E2E e abrir ApprovalQueue
    5. ApprovalQueue deve mostrar o run com o nome do cenário e botão "Revisar"
    6. Clique "Revisar" → ReviewDrawer abre à direita com detalhes
    7. Digite notas e clique "Aprovar" → run some da fila (optimistic) + toast "Run aprovado"
    8. Verifique no Supabase: approval='human_approved', approved_by=seu_uid, reviewer_notes=suas_notas
    9. Repita com Rejeitar: approval deve ser 'human_rejected'
    10. Com approval_queue vazia: ícone verde + "Nenhum run pendente"
  </how-to-verify>
  <resume-signal>Digite "aprovado" se tudo funcionar, ou descreva os problemas encontrados</resume-signal>
</task>

</tasks>

<verification>
Verificação final do fluxo completo:

```bash
# TypeScript sem erros nos arquivos modificados
npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep "error TS" | grep -v "node_modules"

# Arquivos criados
ls c:/Projetos/Claude/WhatsPRO/src/hooks/useE2eApproval.ts
ls c:/Projetos/Claude/WhatsPRO/src/components/admin/ai-agent/playground/ApprovalQueue.tsx
ls c:/Projetos/Claude/WhatsPRO/src/components/admin/ai-agent/playground/ReviewDrawer.tsx

# Verificar que exports existem
grep -n "export" c:/Projetos/Claude/WhatsPRO/src/hooks/useE2eApproval.ts
```

Testes de banco (no Supabase Studio):
1. UPDATE como super_admin deve funcionar em e2e_test_runs
2. UPDATE como usuário não-super_admin deve falhar (RLS)
</verification>

<success_criteria>
- [ ] useE2eApproval.ts criado com query, approve mutation, reject mutation
- [ ] Optimistic update remove run da fila antes da resposta do banco
- [ ] Rollback restaura a lista se o UPDATE falhar
- [ ] ApprovalQueue.tsx lista apenas runs com passed=false AND approval IS NULL
- [ ] ReviewDrawer.tsx exibe steps, tools, erro, e campo de notes
- [ ] Badge de pendentes aparece no header de TODAS as abas quando há pendentes
- [ ] Clicar no badge global navega para aba E2E + abre ApprovalQueue
- [ ] Aprovar grava approval='human_approved' + approved_by + approved_at + reviewer_notes
- [ ] Rejeitar grava approval='human_rejected' + approved_by + approved_at + reviewer_notes
- [ ] Zero erros TypeScript
- [ ] Checkpoint humano aprovado
</success_criteria>

<output>
Após conclusão, criar `.planning/phases/M2-F2-approval-flow/M2-F2-01-SUMMARY.md` com:
- Arquivos criados/modificados
- Decisões técnicas tomadas
- Comportamento confirmado no checkpoint
- Qualquer divergência do plano e por quê
</output>
