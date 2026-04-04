# M2-F2 Approval Flow — Summary

## Status: DONE

## Arquivos criados
- src/hooks/useE2eApproval.ts — TanStack Query hook com optimistic updates
- src/components/admin/ai-agent/playground/ApprovalQueue.tsx — fila de runs pendentes
- src/components/admin/ai-agent/playground/ReviewDrawer.tsx — sheet de revisão + ações

## Arquivos modificados
- src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx — overlay + badge pendentes
- src/pages/dashboard/AIAgentPlayground.tsx — hook integration + score bar + global badge

## Comportamento implementado
- Runs com `passed=false AND approval IS NULL` ficam na fila de pendentes
- Badge âmbar no header de todas as abas quando há pendentes
- Clique no badge global navega para aba E2E e abre ApprovalQueue
- ReviewDrawer exibe steps, tools_missing/tools_used, erro, campo de notas
- Approve grava `approval='human_approved' + approved_by + approved_at + reviewer_notes`
- Reject grava `approval='human_rejected'`
- Optimistic update: run some da fila antes da resposta do banco
- Rollback automático se UPDATE falhar

## Decisões técnicas
- Aprovação via e2e_test_runs (já tem as colunas), não via e2e_test_batches
- staleTime 30s na query de pendentes (não precisa de real-time)
- Steps expansíveis no ReviewDrawer para reduzir scroll
