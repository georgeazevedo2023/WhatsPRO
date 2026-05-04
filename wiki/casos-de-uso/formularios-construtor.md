---
title: Formularios — Construtor, Tipos de Campo e Templates
tags: [formularios, forms, form-builder, campos, templates, detalhado]
sources: [src/components/admin/forms/, src/types/forms.ts]
updated: 2026-05-04
---

# Formularios — Construtor, Tipos de Campo e Templates

> Esta wiki cobre **como o admin monta um formulario**: o editor visual (Form Builder), os 16 tipos de campo disponiveis com suas validacoes, e os 12 templates prontos para acelerar a criacao.
>
> Sub-funcionalidades cobertas: **8.1**, **8.2**, **8.3**.
>
> Voltar ao indice: [[wiki/casos-de-uso/formularios-detalhado]]

---

## 8.1 Construtor de Formularios (Form Builder)

**O que e:** Editor visual onde o admin monta o formulario campo por campo. Tem 3 abas: Campos (editor principal), Configuracoes, e Preview (como vai ficar no chat).

**Como funciona:**
- **Lista de campos** no lado esquerdo — arrastar para reordenar
- **Editor do campo** no lado direito — tipo, label, obrigatorio, validacao
- **Adicionar campo** — botao "+" com seletor de tipo
- **Preview** — simula como o formulario aparece no chat do WhatsApp

**Configuracoes do formulario:**
- Nome e descricao
- Mensagem de boas-vindas (exibida ao iniciar)
- Mensagem de conclusao (exibida ao terminar)
- URL de webhook (envia dados para sistema externo ao completar)
- Maximo de submissoes (limita quantas vezes pode ser preenchido)
- Data de expiracao (formulario desativa automaticamente)
- Status: Ativo / Rascunho / Arquivado

**Cenario real:** Admin cria formulario "Orcamento Pintura": campo 1 "Nome" (texto, obrigatorio), campo 2 "Telefone" (phone, obrigatorio), campo 3 "Tipo de servico" (select: Interior/Exterior/Fachada), campo 4 "Area em m²" (number, min 1 max 999), campo 5 "Observacoes" (long_text, opcional). Preview mostra como vai ficar no chat.

> **Tecnico:** Componente `FormBuilder.tsx` (440+ linhas, 3 tabs). `FieldEditor.tsx` (editor por campo). `FormPreview.tsx` (preview chat-like). Hooks: `useUpdateForm()`, `useUpsertFormFields()`. Auto-slug: kebab-case + base36(Date.now()). Unique constraint: (agent_id, slug). Tabela `whatsapp_forms` + `form_fields`.

---

## 8.2 Os 16 Tipos de Campo

**O que e:** Cada campo do formulario tem um tipo que define como o lead responde e como a resposta e validada.

| Tipo | O que e | Validacao | Exemplo |
|------|---------|-----------|---------|
| **short_text** | Texto curto (1 linha) | Opcional min/max chars | "Seu nome?" |
| **long_text** | Texto longo (paragrafo) | Opcional min/max chars | "Descreva o servico" |
| **number** | Numero | Min/max configuravel | "Area em m²?" |
| **scale** | Escala (ex: 0-10) | Min/max da escala | "Nota de 0 a 10?" |
| **email** | E-mail | Regex de email | "Seu email?" |
| **phone** | Telefone | Min 10 digitos com DDD | "Seu celular?" |
| **cpf** | CPF | 11 digitos + checksum | "Seu CPF?" |
| **cep** | CEP | Exatamente 8 digitos | "Seu CEP?" |
| **date** | Data | Formato DD/MM/AAAA | "Data preferida?" |
| **time** | Hora | Formato HH:MM | "Horario preferido?" |
| **select** | Selecao unica | Numero (1-N) ou texto | "Tipo: Interior/Exterior?" |
| **multi_select** | Selecao multipla | Virgula ou espaco separando | "Interesses? (pode escolher varios)" |
| **yes_no** | Sim ou Nao | sim/nao/s/n | "Tem seguro?" |
| **file** | Upload de arquivo | Tipos e tamanho max | "Envie a foto do local" |
| **signature** | Confirmacao de aceite | Texto exato (padrao "ACEITO") | "Digite ACEITO para confirmar" |
| **poll** | Enquete nativa WhatsApp | Toque na opcao | Botoes clicaveis no WhatsApp |

**Cenario:** Formulario medico: "Nome?" (short_text) → "Data de nascimento?" (date) → "Tem alergias?" (yes_no) → "Quais medicamentos toma?" (long_text) → "Nota para o atendimento anterior?" (scale 0-10)

> **Tecnico:** Enum `FieldType` em `src/types/forms.ts` (16 valores). Validacao no form-bot: CPF checksum (2 digitos verificadores), email regex, CEP 8 digits strip non-digits, phone min 10 digits, date DD/MM/AAAA, time HH:MM, scale/number min/max de `validation_rules` JSONB. Select: match por indice (1-based) ou texto case-insensitive. Poll: via `/send/menu` (UAZAPI, type=poll), fallback texto se falhar.

---

## 8.3 12 Templates Prontos

**O que e:** Ao criar um formulario, o admin pode comecar do zero ou escolher entre 12 modelos prontos que ja vem com campos pre-configurados.

| Template | Campos | Uso |
|----------|--------|-----|
| **NPS** | Nota 0-10 + comentario | Pesquisa de satisfacao |
| **Sorteio** | Nome + telefone + CPF + aceite | Inscricao em sorteio |
| **Satisfacao** | Nota servico + nota produto + recomendaria + comentario | Pesquisa pos-compra |
| **Cadastro** | Nome + email + CPF + nascimento + cidade | Pre-cadastro cliente |
| **Consulta** | Nome + especialidade + data + hora + convenio | Agendamento medico |
| **Orcamento** | Tipo servico + area m² + cidade + prazo + descricao | Pedido de orcamento |
| **Evento** | Nome + email + empresa + cargo + participantes | Inscricao em evento |
| **Pesquisa Produto** | Produto + orcamento + prazo + uso | Qualificacao de interesse |
| **Anamnese** | Nome + nascimento + queixa + alergias + medicamentos | Pre-consulta medica |
| **Vaga** | Nome + email + cargo + experiencia + portfolio | Candidatura a emprego |
| **Chamado** | Tipo problema + descricao + urgencia + nome | Abertura de suporte |
| **Feedback** | Nota atendente + tempo espera + resolvido + sugestoes | Feedback pos-atendimento |

**Cenario:** Admin quer formulario de orcamento → seleciona template "Orcamento" → 5 campos ja pre-configurados → ajusta labels → salva → pronto para usar.

> **Tecnico:** Templates em `FORM_TEMPLATES` array em `src/types/forms.ts` (linhas 125-790). Cada template: name, description, icon (lucide), color, welcome_message, completion_message, fields[]. Galeria: `TemplateGallery.tsx` com cards coloridos. Criacao: `useCreateForm()` mutation com campos do template.

---

## Links Relacionados

- [[wiki/casos-de-uso/formularios-detalhado]] — Indice das sub-wikis
- [[wiki/casos-de-uso/formularios-execucao]] — Como o formulario roda em runtime
- [[wiki/casos-de-uso/formularios-integracao]] — Webhook, lead, AI, submissoes

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Extraido de formularios-detalhado.md como parte do particionamento (regra 14).*
