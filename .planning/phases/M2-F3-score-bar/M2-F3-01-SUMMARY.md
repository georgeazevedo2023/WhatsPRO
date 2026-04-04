# M2-F3 Score Bar — Summary

## Status: DONE

## Arquivos criados
- src/lib/agentScoring.ts — funções puras (zero side effects)
- src/hooks/useAgentScore.ts — TanStack Query com 2 queries + memos
- src/components/admin/ai-agent/AgentScoreBar.tsx — barra visual + tooltip + chart

## Arquivos modificados
- src/pages/dashboard/AIAgentPlayground.tsx — AgentScoreBar no header

## Fórmula implementada
Score = E2E_Pass_Rate × 0.4 + Validator_Avg_Normalized × 0.3 + Tool_Accuracy × 0.2 + Latency_Score × 0.1

Onde:
- E2E_Pass_Rate = (runs passados / total) × 100 [últimos 7 dias]
- Validator_Avg_Normalized = avg(score 0-10) × 10 [últimos 7 dias]
- Tool_Accuracy = (1 - tools_missing / total_expected) × 100
- Latency_Score = max(0, 100 - max(0, avg_latency - 3000) / 70)

## Tiers de cor
- >= 90: emerald (excellent)
- >= 70: blue (good)
- >= 50: amber (attention)
- < 50: red (critical)
- sem dados: muted (insufficient)

## Decisões técnicas
- Score computado client-side (volumes pequenos, evita migration + RPC)
- staleTime 5min (score não muda em tempo real)
- useMemo evita recomputação a cada render
- compact=false inclui LineChart Recharts (para uso futuro na tab Métricas)
