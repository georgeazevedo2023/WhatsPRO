---
phase: 3
slug: validacao-estrita-de-formularios-frontend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-T1 | AIAgentTab schemas + fieldErrors | 1 | D-01/D-02/D-04 | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 03-T2 | BrainConfig + RulesConfig erros inline | 1 | D-03/D-06/D-07/D-08 | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 03-T3 | GuardrailsConfig + VoiceConfig erros inline | 1 | D-09/D-10 | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 03-T4 | ExtractionConfig key validation local | 1 | D-11 | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 03-T5 | BlockedNumbers phone regex | 1 | D-13 | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |
| 03-T6 | Settings.tsx recipient_number validation | 1 | D-12 | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test files for Zod schema logic (schemas are pure functions — unit testable without DOM)
- [ ] If planner creates `src/lib/validationSchemas.ts` or similar, test file covers each schema
- [ ] If schemas stay inline in AIAgentTab, test the exported schemas or the fieldErrors accumulation logic

*Tests for React component rendering (inline error display) are manual-only — see below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Erro aparece inline abaixo do Input ao digitar valor inválido | D-06 | Requer renderização DOM + interação | Abrir AIAgent config → BrainConfig → digitar temperatura 5 → verificar mensagem "Máximo: 1" abaixo do campo |
| Auto-save não dispara com campo inválido | D-04 | Requer rede/Supabase | Digitar valor inválido → aguardar 3s → verificar que nenhum request de save foi feito (DevTools Network) |
| Erro some ao corrigir o campo | D-05 | Requer renderização DOM | Digitar inválido → verificar erro → corrigir → verificar que erro sumiu |
| Settings.tsx botão salvar desabilitado com telefone inválido | D-12 | Requer renderização DOM | Settings → digitar "123" em recipient_number → verificar que botão salvar está disabled |
| BlockedNumbers: número inválido exibe erro inline | D-13 | Requer renderização DOM | Digitar "123" no campo de número bloqueado → verificar erro inline |
| max_lead_messages campo adicionado em RulesConfig | D-08 | Novo campo de UI | Abrir RulesConfig → verificar que campo "Máx. mensagens do lead" aparece com range 1-50 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
