---
title: Funis — Wizard, Tipos, Importacao e Sidebar
tags: [funis, wizard, tipos, templates, importar, sidebar, detalhado]
sources: [src/pages/dashboard/FunnelWizard.tsx, src/hooks/useCreateFunnel.ts, src/data/funnelTemplates.ts, src/types/funnels.ts]
updated: 2026-05-04
---

# Funis — Wizard, Tipos, Importacao e Sidebar (4 Sub-Funcionalidades)

> Esta sub-wiki cobre o **ponto de entrada** do modulo Funis: como funis sao criados (wizard auto-cria tudo, ou importar recursos existentes), os 7 tipos disponiveis e como o item aparece na sidebar.
>
> Ver tambem indice: [[wiki/casos-de-uso/funis-detalhado]]

---

## 10.1 Wizard de Criacao (4 Passos -> Tudo Pronto)

**O que e:** Um assistente de 4 passos que cria todos os recursos necessarios automaticamente.

**Passo 1 — Tipo:** Escolhe entre 7 tipos de funil (ver secao 10.2)

**Passo 2 — Detalhes:** Nome do funil, instancia WhatsApp, descricao

**Passo 3 — Canais:** Confirma quais canais quer (campanha, bio link, formulario — pre-selecionados pelo tipo)

**Passo 4 — Resumo:** Revisao de tudo que sera criado. Botao "Criar Funil".

**O que o wizard cria automaticamente:**
1. **Board Kanban** com colunas pre-definidas pelo tipo (ex: Sorteio -> Inscrito, Confirmado, Sorteado, Entregue)
2. **Formulario WhatsApp** com campos do template do tipo (ex: Sorteio -> nome, telefone, CPF, aceite)
3. **Bio Link** com template visual + botoes (WhatsApp + Formulario)
4. **Campanha UTM** com instrucoes IA do tipo + link rastreavel
5. **Registro do Funil** orquestrando todos os 4 recursos acima

**Tela de sucesso:** Mostra o link da campanha, slug do Bio Link, e trigger do formulario — prontos para usar.

**Cenario real:** Gerente escolhe "Vaga de Emprego" -> digita "Vaga Motorista" -> wizard cria: Board com colunas Candidato->Entrevista->Avaliacao->Aprovado, formulario com nome/email/cargo/experiencia/portfolio, Bio Link com botao de candidatura, campanha UTM pro LinkedIn. Em 30 segundos, processo seletivo inteiro configurado.

> **Tecnico:** Pagina `FunnelWizard.tsx` (513 linhas, rota /dashboard/funnels/new). Hook `useCreateFunnelWizard()` de `useCreateFunnel.ts` (290 linhas). Sequencia: INSERT kanban_boards -> kanban_columns (FUNNEL_KANBAN_COLUMNS) -> whatsapp_forms + form_fields (FUNNEL_FORM_TEMPLATE) -> bio_pages + bio_buttons (FUNNEL_BIO_DEFAULTS) -> utm_campaigns (FUNNEL_CAMPAIGN_DEFAULTS + ai_template) -> funnels (com FKs para todos). Templates em `src/data/funnelTemplates.ts`. Slug: `generateFunnelSlug(name)` — kebab-case + 4-char timestamp suffix.

---

## 10.2 Os 7 Tipos de Funil

**O que e:** Cada tipo define as colunas do Kanban, os campos do formulario, e as instrucoes da IA.

| Tipo | Colunas Kanban | Formulario | Uso |
|------|---------------|------------|-----|
| **Sorteio** | Inscrito -> Confirmado -> Sorteado -> Entregue | Nome, telefone, CPF, aceite | Captacao massiva |
| **Captacao** | Novo -> Qualificado -> Em Contato | Nome, email, interesse | Gerar leads |
| **Venda** | Novo -> Interesse -> Proposta -> Negociacao -> Fechado | Orcamento completo | Pipeline vendas |
| **Vaga** | Candidato -> Entrevista -> Avaliacao -> Aprovado | Nome, email, cargo, experiencia | Processo seletivo |
| **Lancamento** | Interessado -> Lista VIP -> Pre-venda -> Comprou | Nome, email, interesse | Lancamento produto |
| **Evento** | Inscrito -> Confirmado -> Presente -> Follow-up | Nome, email, empresa, cargo | Inscricao evento |
| **Atendimento** | Triagem -> Em Atendimento -> Resolvido | Tipo problema, descricao, urgencia | Suporte tecnico |

Cada tipo tambem define: template de campanha (instrucoes IA), defaults do Bio Link, e template de formulario.

> **Tecnico:** Enum `FunnelType` em `src/types/funnels.ts`. `FUNNEL_TYPE_CONFIGS` com: label, icon (lucide), description, color, needsCampaign/Bio/Form booleans, kanbanColumns[], defaultAiTemplate. Templates: `FUNNEL_KANBAN_COLUMNS` (colunas + cores por tipo), `FUNNEL_BIO_DEFAULTS` (template visual + capture fields + botoes), `FUNNEL_CAMPAIGN_DEFAULTS` (campaign_type + utm params), `FUNNEL_FORM_TEMPLATE` (mapping tipo->template_type).

---

## 10.12 Importar Recursos Existentes

**O que e:** Dialog que permite criar um funil a partir de recursos que ja existem (campanha, bio, formulario, board) sem auto-criacao.

**Cenario:** Empresa ja tem campanha "Agosto" e board "Pipeline". Cria funil e vincula ambos sem criar duplicatas.

> **Tecnico:** Componente `ImportExistingDialog.tsx` (312 linhas). Carrega campaigns, bioPages, forms, boards quando instancia selecionada. Submit: INSERT funnel com FKs opcionais (campaign_id, bio_page_id, form_id, kanban_board_id). Sem auto-criacao de sub-recursos.

---

## 10.13 Sidebar Unificada (3->1)

**O que e:** Antes do M16, a sidebar tinha 3 itens separados: Campanhas, Bio Link, Formularios. Agora tem 1 item "Funis" com sub-itens: Funis (lista), Campanhas, Bio Link, Formularios.

**Navegacao:** Funis e o item principal. Campanhas/Bio/Formularios sao sub-itens dentro de Funis.

> **Tecnico:** Sidebar: item "Funis" com sub-items (Campanhas rota /dashboard/campaigns, Bio rota /dashboard/bio, Formularios rota /dashboard/forms). Rotas antigas mantidas como sub-items. Funis: /dashboard/funnels.

---

## Links Relacionados

- [[wiki/casos-de-uso/funis-detalhado]] — Indice das sub-wikis de Funis
- [[wiki/casos-de-uso/funis-operacao-visualizacao]] — Lista, detalhe, tag e cards no perfil
- [[wiki/casos-de-uso/funis-inteligencia-metricas]] — Automacao, IA, perfis e metricas
- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas orquestradas pelo funil
- [[wiki/casos-de-uso/bio-link-detalhado]] — Bio Links orquestrados pelo funil
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios orquestrados pelo funil
- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Boards Kanban criados pelo funil

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Particionado em 2026-05-04.*
