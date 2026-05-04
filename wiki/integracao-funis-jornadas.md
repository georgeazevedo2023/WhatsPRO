---
title: Integração de Funis — Jornadas Completas (5 Exemplos)
tags: [funis, integracao, jornada, exemplos, campanhas, bio-link, formularios, m15]
sources: [CLAUDE.md, PRD.md, M15]
updated: 2026-05-04
---

# Integração de Funis — Cinco Jornadas Completas

> Cinco cenários reais ponta-a-ponta mostrando como Campanhas, Bio Link, Formulários e AI Agent trabalham juntos. Inclui passo a passo do admin, jornada do lead e o que aparece no painel.

---

## 4. Cinco Exemplos de Jornada Completa

### Jornada 1: SORTEIO no Instagram

**Cenário:** Loja quer fazer sorteio de um produto. Divulga link no Instagram.

**Passo a passo do admin:**
1. Cria formulário "Sorteio Natal" com campos: nome, telefone, email, "Aceita regulamento?" (sim/não)
2. Cria campanha "Sorteio Natal" com `landing_mode=form` e liga ao formulário
3. Cria board Kanban "Sorteio" com colunas: Inscrito → Confirmado → Sorteado → Entregue
4. Posta link + QR Code nos stories do Instagram

**Jornada do lead:**
```
[1] Lead vê story no Instagram → clica no link
[2] Edge function "go" registra visita (utm_visits) com ref_code
[3] Landing page mostra formulário → lead preenche nome, email, aceita regulamento
[4] form-public cria:
     • contact (pelo telefone)
     • lead_profile (origin: "campanha", full_name, email)
     • form_submission (dados do formulário)
     • utm_visit atualizada (status: "matched")
     • kanban_card na coluna "Inscrito" (tags: campanha:Sorteio, formulario:sorteio)
[5] Lead é redirecionado pro WhatsApp → manda mensagem
[6] AI Agent recebe:
     • <campaign_context> "Lead da campanha Sorteio Natal (tipo: giveaway)"
     • <form_data> "nome: Maria, email: maria@..., aceita: sim"
     • Responde: "Oi Maria! Sua inscrição no sorteio foi confirmada!"
```

**O que o admin vê no painel:**
- **Campanhas → Sorteio Natal:** 150 visitas, 89 conversões (59%), lista de leads
- **Leads → Maria:** Badge azul "Campanha: Sorteio Natal", timeline mostrando visita → form → conversa
- **CRM → Sorteio:** Card da Maria na coluna "Inscrito"
- **Formulários → Sorteio Natal:** Badge "Usado em Campanha Sorteio Natal", 89 submissões

---

### Jornada 2: VAGA DE EMPREGO via Bio Link

**Cenário:** Empresa quer receber candidaturas. Compartilha Bio Link nas redes sociais.

**Passo a passo do admin:**
1. Cria formulário "Candidatura" com campos: nome, email, telefone, cargo pretendido, experiência (select), LinkedIn (url)
2. Cria página Bio "Trabalhe Conosco" com:
   - Botão "Nossas vagas" (URL → site)
   - Botão "Candidatar-se" (tipo: formulário → "Candidatura")
   - Botão Instagram / LinkedIn (social icons)
   - Captação de leads ativada (nome + telefone + email)
   - Contexto AI: "Lead quer trabalhar na empresa. Veio da página {page_title}, clicou em {button_label}."

**Jornada do lead:**
```
[1] Lead vê link no LinkedIn → acessa /bio/trabalhe-conosco
[2] Bio page carrega → view_count incrementado
[3] Lead clica "Candidatar-se" → modal pede nome/telefone/email
[4] bio-public cria contact + lead_profile (origin: "bio") + bio_lead_captures
[5] Redirecionado para formulário web → preenche cargo, experiência, LinkedIn
[6] form-public cria form_submission + atualiza lead_profile (custom_fields)
     Tags: origem:bio, bio_page:trabalhe-conosco, formulario:candidatura
[7] Lead é redirecionado pro WhatsApp → manda mensagem
[8] AI Agent recebe:
     • <bio_context> "Lead veio da página Bio 'Trabalhe Conosco'"
     • <form_data> "nome: Pedro, cargo: Desenvolvedor, experiência: 3-5 anos"
     • Responde: "Olá Pedro! Recebemos sua candidatura para Desenvolvedor."
```

**O que o admin vê no painel:**
- **Bio Link → Analytics:** Página "Trabalhe Conosco" com 200 views, 45 cliques, 32 leads
- **Leads → Pedro:** Badge verde "Bio Link: trabalhe-conosco", timeline: bio → form → conversa
- **Formulários → Candidatura:** Badge "Usado em Bio: Trabalhe Conosco", 32 submissões

---

### Jornada 3: LANÇAMENTO DE PRODUTO via Campanha + Bio

**Cenário:** Loja vai lançar produto novo. Cria campanha UTM + Bio Link para captar interessados.

**Passo a passo do admin:**
1. Cria formulário "Lista VIP" com: nome, telefone, "Quer ser avisado?" (sim/não)
2. Cria página Bio "Lançamento Tênis X" com banner, botão "Entrar na lista VIP" (formulário) e botão "Ver no catálogo"
3. Cria campanha "Lançamento Tênis" com link apontando para a Bio Link
4. Configura AI Agent: "Fale sobre o Tênis X, preço R$ 399, lançamento dia 15"

**Jornada do lead:**
```
[1] Lead recebe link no grupo do WhatsApp → clica
[2] Campanha registra visita → redireciona para /bio/lancamento-tenis
[3] Bio page carrega com banner do produto + 2 botões
[4] Lead clica "Entrar na lista VIP" → modal pede nome/telefone
[5] bio-public cria contact + lead_profile (origin: "bio")
[6] Redirecionado pro formulário → preenche "Quer ser avisado? Sim"
[7] form-public cria submission + tags:
     origem:bio, bio_page:lancamento-tenis, formulario:lista-vip, campanha:Lançamento
[8] Lead vai pro WhatsApp → pergunta "Quanto vai custar?"
[9] AI Agent recebe TODOS os contextos:
     • <campaign_context> "Campanha Lançamento Tênis"
     • <form_data> "nome: Ana, avisado: sim"
     • <bio_context> "Veio da página Bio 'Lançamento Tênis X'"
     • Responde: "Oi Ana! O Tênis X vai custar R$ 399,00 e lança dia 15!"
```

**O que o admin vê no painel:**
- **Campanhas → Lançamento Tênis:** Visitas, conversão, leads
- **Bio Link → Lançamento Tênis X:** Views, cliques no "Lista VIP" e "Ver catálogo"
- **Leads → Ana:** Badge verde "Bio Link", timeline com campanha + bio + form + conversa
- **Formulários → Lista VIP:** Badges "Usado em Campanha + Bio"

---

### Jornada 4: ATENDIMENTO via WhatsApp Form

**Cenário:** Empresa usa formulário dentro do WhatsApp para triagem antes de atender.

**Passo a passo do admin:**
1. Cria formulário "Triagem" com: nome, cidade, motivo do contato (select), produto de interesse
2. Configura AI Agent: "Ao receber primeiro contato, envie FORM:triagem"
3. Cria board Kanban "Vendas" com: Novo → Qualificado → Proposta → Fechado

**Jornada do lead:**
```
[1] Lead manda "Oi" no WhatsApp
[2] AI Agent envia greeting + inicia form: "FORM:triagem"
[3] form-bot assume: pergunta nome → cidade → motivo → produto
[4] form-bot ao completar:
     • form_submission criada
     • lead_profile: full_name, city, origin: "formulario"
     • Tags: origem:formulario, formulario:triagem
[5] AI Agent retoma com <form_data>:
     • NÃO pergunta nome ou cidade novamente
     • Busca "Tinta Coral 18L" no catálogo → envia carrossel
     • Responde: "Carlos, encontrei a Tinta Coral 18L por R$ 289,90!"
```

**O que o admin vê no painel:**
- **Formulários → Triagem:** 45 submissões, dados preenchidos
- **Leads → Carlos:** Badge roxo "Formulário: triagem", timeline: conversa → form → AI responde
- **Helpdesk:** Conversa com Carlos mostrando perguntas do form + resposta do AI com carrossel

---

### Jornada 5: CAPTAÇÃO ORGÂNICA via Bio Link + Catálogo

**Cenário:** Loja coloca link da Bio no Instagram/TikTok. Lead acessa, navega catálogo, e entra em contato.

**Passo a passo do admin:**
1. Cria página Bio "Loja Virtual" com botão WhatsApp + 3 botões de catálogo + social icons + captação ativada
2. Coloca link `/bio/loja-virtual` na bio do Instagram

**Jornada do lead:**
```
[1] Lead vê "Link na bio" no Instagram → acessa /bio/loja-virtual
[2] Bio page carrega → view_count incrementado
[3] Lead vê produto "Esmalte Risqué" no catálogo → clica
[4] Modal de captação pede nome e telefone → lead preenche
[5] bio-public cria contact + lead_profile (origin: "bio") + bio_lead_captures
[6] Redirecionado pro WhatsApp com mensagem:
     "Olá! Tenho interesse no produto: Esmalte Risqué [bio:loja-virtual|Esmalte Risqué]"
[7] AI Agent recebe:
     • Detecta tag bio → seta bio_page:loja-virtual
     • <bio_context> "Lead veio da página Bio 'Loja Virtual'"
     • Já sabe que quer Esmalte Risqué → busca no catálogo → envia foto
     • "Oi! O Esmalte Risqué está por R$ 12,90! Qual cor você prefere?"
```

**O que o admin vê no painel:**
- **Bio Link → Analytics:** "Loja Virtual" com 500 views, 120 cliques, 85 leads, CTR 24%
- **Leads → Lead:** Badge verde "Bio Link: loja-virtual", timeline: bio capture → conversa
- **Helpdesk:** Conversa já com contexto do produto clicado

---

## 5. Tabela de Referência Rápida

### O que é criado em cada jornada

| Recurso | Campanha+Form | Bio+WhatsApp | WhatsApp Form | Campanha+Bio+Form | Bio+Catálogo |
|---------|:---:|:---:|:---:|:---:|:---:|
| utm_visits | sim | - | - | sim | - |
| contacts | sim | sim | (já existe) | sim | sim |
| lead_profiles | sim | sim | sim | sim | sim |
| form_submissions | sim | - | sim | sim | - |
| bio_lead_captures | - | sim | - | - | sim |
| kanban_cards | sim (se board) | - | - | sim (se board) | - |
| Tags campanha: | sim | - | - | sim | - |
| Tags formulario: | sim | - | sim | sim | - |
| Tags bio_page: | - | sim | - | sim | sim |
| AI <campaign_context> | sim | - | - | sim | - |
| AI <form_data> | sim | - | sim | sim | - |
| AI <bio_context> | - | sim | - | sim | sim |

---

## Links Relacionados

- [[wiki/integracao-funis]] — Índice da integração de funis
- [[wiki/integracao-funis-arquitetura]] — Arquitetura, leadHelper, tags, contexto AI
- [[wiki/integracao-funis-painel]] — Onde ver tudo no painel admin
- [[wiki/ai-agent]] — Detalhes do AI Agent
