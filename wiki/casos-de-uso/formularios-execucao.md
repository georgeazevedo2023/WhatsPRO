---
title: Formularios — Execucao no Chat e na Landing Page
tags: [formularios, forms, form-bot, form-public, validacao, sessao, detalhado]
sources: [supabase/functions/form-bot/, supabase/functions/form-public/, src/components/landing/LandingForm.tsx]
updated: 2026-05-04
---

# Formularios — Execucao no Chat e na Landing Page

> Esta wiki cobre **como o formulario roda em tempo real**: o trigger `FORM:slug` que dispara no WhatsApp, a sessao gerenciada pelo form-bot (campo por campo, retries, timeout), as validacoes especificas por tipo, e a versao web renderizada na landing page das campanhas (form-public).
>
> Sub-funcionalidades cobertas: **8.4**, **8.5**, **8.6**, **8.11**.
>
> Voltar ao indice: [[wiki/casos-de-uso/formularios-detalhado]]

---

## 8.4 Trigger no Chat (FORM:slug)

**O que e:** Para iniciar um formulario no chat do WhatsApp, basta enviar a mensagem `FORM:slug` (ex: `FORM:orcamento`). O bot assume e comeca a perguntar.

**Quem pode enviar o trigger:**
- O atendente manualmente (digita no chat)
- A IA automaticamente (quando detecta que precisa coletar dados estruturados)
- Uma automacao (regra do motor de automacao)

**Fluxo:**
1. Mensagem `FORM:orcamento` chega no webhook
2. form-bot intercepta ANTES do AI Agent
3. Busca formulario pelo slug + agent_id
4. Verifica: ativo? Nao expirou? Limite de submissoes?
5. Cria sessao (form_sessions) com status `in_progress`
6. Envia mensagem de boas-vindas + primeira pergunta
7. A partir daqui, cada resposta do lead e processada pelo form-bot (nao pela IA)

> **Tecnico:** Detection no webhook: `content.startsWith('FORM:')` → redireciona para form-bot. Edge function `form-bot/index.ts`. Busca: `whatsapp_forms` WHERE slug = X AND agent_id = Y AND status = 'active'. Checks: max_submissions (count form_submissions), expires_at. Sessao: INSERT em `form_sessions` (form_id, conversation_id, contact_id, current_field_index=0, collected_data={}, status='in_progress', retries=0).

---

## 8.5 Sessao do Formulario (form-bot)

**O que e:** Enquanto o formulario esta em andamento, o bot gerencia uma "sessao" — sabe em qual campo esta, o que ja foi respondido, e quantas tentativas o lead ja fez.

**Como funciona campo por campo:**
1. Bot envia a pergunta do campo atual (com instrucoes de formato se necessario)
2. Lead responde
3. Bot valida a resposta:
   - **Valida** → salva, avanca para proximo campo
   - **Invalida** → incrementa tentativas, reenvia pergunta com mensagem de erro
4. Apos 3 tentativas invalidas no mesmo campo → sessao abandonada

**Tratamentos especiais:**
- **Campo select:** Bot envia opcoes numeradas? **NAO!** Envia nomes limpos. Lead pode responder com o numero (1, 2, 3) OU com o texto ("Interior", "Exterior"). Ambos aceitos.
- **Campo poll:** Em vez de texto, envia enquete nativa do WhatsApp com botoes clicaveis.
- **Campo skip_if_known:** Se o lead ja tem nome/email no perfil, pula a pergunta.
- **Respostas de pular:** Lead pode digitar "pular", "skip", "–" ou "-" para pular campos opcionais.

**Timeout:** Sessao expira apos 24 horas de inatividade (lead parou de responder).

> **Tecnico:** Edge function `form-bot/index.ts` (526 linhas). Sessao em `form_sessions` (current_field_index INT, collected_data JSONB, retries INT, status ENUM). Validacao: funcoes separadas por tipo (validateCpf, validateEmail, etc.). Normalizacao: `normalizeAnswer()` converte resposta para tipo correto (number→parseFloat, yes_no→boolean, select→option text). Max retries: 3 (MAX_RETRIES constant). TTL: 24h (SESSION_TTL_MS = 86400000). Skip: check `field.skip_if_known` + existing lead data.

---

## 8.6 Validacoes por Tipo de Campo

**O que e:** Cada tipo de campo tem regras de validacao automaticas. O lead nao consegue avancar sem responder corretamente.

| Tipo | Regra de validacao | Exemplo de erro |
|------|-------------------|-----------------|
| **CPF** | 11 digitos + algoritmo de checksum (2 digitos verificadores) | "CPF invalido. Verifique e tente novamente." |
| **Email** | Regex: usuario@dominio.extensao | "Email invalido. Formato: nome@email.com" |
| **CEP** | Exatamente 8 digitos (remove pontos e tracos) | "CEP invalido. Informe 8 digitos." |
| **Telefone** | Minimo 10 digitos com DDD (remove formatacao) | "Telefone invalido. Informe com DDD." |
| **Data** | Formato DD/MM/AAAA | "Data invalida. Formato: DD/MM/AAAA" |
| **Hora** | Formato HH:MM | "Hora invalida. Formato: HH:MM" |
| **Numero** | Numerico + min/max se configurado | "Numero invalido" ou "Valor fora do limite" |
| **Escala** | Inteiro dentro do range (ex: 0-10) | "Informe um numero de 0 a 10" |
| **Sim/Nao** | sim/nao/s/n (case-insensitive) | "Responda 'sim' ou 'nao'" |
| **Selecao** | Indice (1-N) ou texto exato da opcao | "Opcao invalida. Escolha entre as opcoes." |
| **Assinatura** | Texto EXATO do aceite (padrao "ACEITO") | "Digite ACEITO para confirmar" |

> **Tecnico:** Validacoes em form-bot lines 12-87. CPF: 11 digits + Luhn-like check (sum digitos * posicao, mod 11). Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. CEP: strip non-digits, length === 8. Phone: strip non-digits, length >= 10. Select: try parseInt (1-based index) → fallback text match case-insensitive. Mensagens de erro: campo `error_message` no form_fields, fallback "Resposta invalida. Por favor, tente novamente."

---

## 8.11 Formulario na Landing Page (form-public)

**O que e:** Alem do formulario no chat (via FORM:slug), o mesmo formulario pode ser renderizado como **formulario visual numa pagina web** (landing page das campanhas). O lead preenche no navegador antes de abrir o WhatsApp.

**Diferenca do formulario no chat:**
| | No Chat (form-bot) | Na Landing (form-public) |
|---|-------------------|------------------------|
| Onde aparece | Dentro do WhatsApp | Numa pagina web |
| Como funciona | Pergunta por pergunta | Todos os campos de uma vez |
| Validacao | Servidor (edge function) | Cliente (JavaScript no navegador) |
| Acesso | Precisa de conversa | Publico (sem login) |

**Cenario:** Campanha com landing_mode='form' → lead clica no link → ve formulario bonito com todos os campos → preenche → clica enviar → lead criado + WhatsApp abre.

> **Tecnico:** Edge function `form-public/index.ts`. GET `?slug=X&instance_id=Y` → retorna form definition + fields (sem JWT). POST `{ slug, data, phone, ref_code?, bio_page?, bio_btn? }` → upsert contact + lead_profile (via leadHelper), INSERT form_submission, match utm_visit se ref_code, auto-create kanban card se campaign.kanban_board_id, tags. CORS: wildcard '*'. Componente: `LandingForm.tsx` com validacao client-side (CPF checksum, email regex, phone 10+, CEP 8 digits).

---

## Links Relacionados

- [[wiki/casos-de-uso/formularios-detalhado]] — Indice das sub-wikis
- [[wiki/casos-de-uso/formularios-construtor]] — Construtor, tipos e templates
- [[wiki/casos-de-uso/formularios-integracao]] — Webhook, lead, AI, submissoes
- [[wiki/casos-de-uso/campanhas-detalhado]] — Landing pages das campanhas

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Extraido de formularios-detalhado.md como parte do particionamento (regra 14).*
