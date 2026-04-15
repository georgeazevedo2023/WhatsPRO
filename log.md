---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright)

### 10 bugs corrigidos no Helpdesk (4 arquivos-chave)

**App.tsx — Auto-reload ao voltar à aba (3s):**
Supabase client (WebSocket + PostgREST) entra em estado quebrado após tab suspension. Refetch seletivo não funciona — `window.location.reload()` após 3s é a solução (padrão Slack/Discord). Removido `useQueryClient` (não mais necessário). React Router future flags adicionadas.

**ChatPanel.tsx — fetchMessages estabilizado:**
- Dependência de `conversationId` (string) em vez de `conversation` (objeto) — evita recriação do callback a cada evento realtime
- `AbortController` com timeout 10s + retry automático — nunca trava
- `setLoading(false)` incondicional no `finally` — nunca skeleton preso
- Removido `fetchIdRef` (era a causa raiz do skeleton infinito)

**useHelpdeskConversations.ts — loading inicia false:**
`useState(true)` + `selectedInboxId` vazio = loading travado para sempre. Fix: `useState(false)`, loading só ativa quando fetch realmente executa.

**client.ts — cleanup localStorage stale:**
Auto-remove tokens `sb-*-auth-token` de projetos Supabase antigos no boot.

**Outros fixes:** AvatarImage removido (403 CDN), AvatarFallback com iniciais, GlobalSearchDialog sem profile pics.

### Auditoria UAZAPI — `/contact/getProfilePic` não existe no v2

Testado diretamente contra `wsmart.uazapi.com`: endpoint retorna 405. `/profile/image` é para UPLOAD (não download). No UAZAPI v2, foto de perfil chega apenas via webhook (`imagePreview`) e sync (`image`). Hook simplificado: retorna URL válida ou null, sem chamadas de rede.

### Storage cleanup — 1.4 GB liberados

Projeto antigo "Novo WsmartQR" (`crzcpnczpuzwieyzbqev`): 2.667 arquivos deletados do bucket `helpdesk-media`. Storage org: 134% → <1%.

### Testes Playwright — 100% OK

Playwright v1.59.1 instalado. Login automatizado, 4 conversas testadas (George/Lívia/Wsmart/Wsmart Digital), tab switch com segunda aba. Resultado: 0 skeletons, 0 erros console, mensagens carregam em todas as trocas.

### Deploy

Edge function `uazapi-proxy` v18 deployada. CI/CD: 4 builds bem-sucedidos. Token atualizado.

### Regras adicionadas: R65-R72

---

> Entradas de M19 S3-S5 (2026-04-13) arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2 arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
