---
title: Roadmap — M12 Formulários
type: roadmap-detail
updated: 2026-05-11
---

#### M12 - Formulários WhatsApp 📋

> **Visão**: Coletar dados estruturados via conversa WhatsApp (bot sequencial de perguntas).
> Ideal para: cadastro de clientes, pesquisas de satisfação, orçamentos, inscrições em eventos.

| Task | Status | Descrição |
|------|--------|-----------|
| T12.1 Builder de formulários | ✅ | Campos: texto, número, data, select, múltipla escolha, arquivo |
| T12.2 Bot sequencial WhatsApp | ✅ | Faz perguntas uma a uma, valida resposta, salva |
| T12.3 Field sets (grupos de campos) | 📋 | Agrupar campos logicamente (dados pessoais, endereço, etc.) |
| T12.4 Banco de submissions | ✅ | Respostas consultáveis, filtráveis e exportáveis (CSV/Excel) |
| T12.5 Landing page de captura | 📋 | Página simples que redireciona para WhatsApp com funil |
| T12.6 Integração com funis (M10) | 📋 | Formulário como step do funil conversacional |
| T12.7 Webhook de submission | ✅ | Disparar webhook ao completar formulário |
| T12.8 Lógica condicional entre campos | 📋 | Mostrar/pular campo baseado em resposta anterior |
| T12.9 Validação de respostas | ✅ | CPF, email, telefone, CEP, regex customizado |
| T12.10 Auto-preencher dados conhecidos | ✅ | Se contato já tem nome/email, não perguntar novamente |

##### T12.1 — Builder de Formulários
**Descrição completa**: Interface visual para criar formulários com diferentes tipos de campos.

**Tipos de campo suportados**:

| Tipo | Input WhatsApp | Validação | Exemplo |
|------|---------------|-----------|---------|
| Texto curto | Texto livre | Max chars, regex | "Qual seu nome completo?" |
| Texto longo | Texto livre | Max chars | "Descreva seu problema em detalhes" |
| Número | Texto numérico | Min/max, inteiro/decimal | "Quantos funcionários tem sua empresa?" |
| Email | Texto com @ | Regex email | "Qual seu e-mail?" |
| Telefone | Texto numérico | Formato BR/intl | "Qual seu telefone com DDD?" |
| CPF/CNPJ | Texto numérico | Dígito verificador | "Informe seu CPF:" |
| CEP | Texto numérico | 8 dígitos, consulta ViaCEP | "Qual seu CEP?" → auto-preenche cidade/estado |
| Data | Texto formato data | dd/mm/aaaa, range | "Qual sua data de nascimento?" |
| Hora | Texto formato hora | HH:MM | "Qual o melhor horário para contato?" |
| Select (único) | Lista numerada | Opção válida | "Área: 1) Marketing 2) Vendas 3) Suporte" |
| Multi-select | Lista numerada | 1+ opções válidas | "Interesses: 1) IA 2) CRM 3) WhatsApp (ex: 1,3)" |
| Sim/Não | "sim" ou "não" | Boolean | "Já é nosso cliente?" |
| Escala (1-10) | Número | Range 1-N | "De 0 a 10, como avalia nosso atendimento?" |
| Arquivo | Enviar mídia | Tipo/tamanho | "Envie uma foto do documento" |
| Localização | Pin no mapa | Lat/lng | "Compartilhe sua localização" |
| Assinatura | Texto "ACEITO" | Exact match | "Digite ACEITO para concordar com os termos" |

**Interface do builder**:
- Drag-and-drop para reordenar campos
- Preview em tempo real (simulador de conversa WhatsApp)
- Configuração por campo: obrigatório, placeholder, help text, validação
- Duplicar campo, copiar entre formulários

---

##### T12.2 — Bot Sequencial WhatsApp
**Descrição completa**: Motor que executa o formulário no WhatsApp como uma conversa natural.

**Fluxo de execução**:
```
Bot: "📋 Vamos começar seu cadastro! São 5 perguntas rápidas."
Bot: "1/5 — Qual seu nome completo?"
Contato: "João Silva"
Bot: "2/5 — Qual seu e-mail?"
Contato: "joao@email.com"
Bot: "3/5 — Qual o tamanho da sua empresa?"
Bot: "1) 1-10 pessoas  2) 11-50  3) 51-200  4) 200+"
Contato: "2"
Bot: "4/5 — Qual seu principal desafio?"
Bot: "1) Captar clientes  2) Reter clientes  3) Automatizar  4) Outro"
Contato: "1"
Bot: "5/5 — Qual seu orçamento mensal?"
Contato: "R$ 2000"
Bot: "✅ Cadastro completo! Obrigado, João! Um consultor entrará em contato em breve."
```

**Recursos do bot**:
- Indicador de progresso ("3/7")
- Retry em resposta inválida com mensagem de ajuda (max 3 tentativas)
- Skip de campo opcional ("responda PULAR para ignorar")
- Voltar ao campo anterior ("responda VOLTAR")
- Cancelar formulário ("responda CANCELAR")
- Timeout configurável (ex: 30min sem resposta → lembrete; 24h → cancelar)
- Mensagem de encerramento customizável

---

##### T12.3 — Field Sets (Grupos de Campos)
**Descrição completa**: Organizar campos em grupos lógicos com cabeçalho e descrição.

**Exemplo**:
```
📋 Formulário de Orçamento

[Field Set 1: Dados Pessoais]
  Bot: "📝 Primeiro, seus dados pessoais:"
  → Nome completo
  → E-mail
  → Telefone

[Field Set 2: Dados da Empresa]
  Bot: "🏢 Agora, sobre sua empresa:"
  → Nome da empresa
  → CNPJ
  → Número de funcionários

[Field Set 3: Projeto]
  Bot: "🎯 Sobre o projeto:"
  → Descrição do que precisa
  → Prazo desejado
  → Orçamento disponível
```

**Funcionalidades**:
- Cabeçalho com emoji + texto ao iniciar grupo
- Campos do grupo são enviados em sequência
- Progresso mostra "Seção 2/3 — Dados da Empresa"
- Pular seção inteira se condicional não atender

---

##### T12.4 — Banco de Submissions
**Descrição completa**: Dashboard para visualizar, filtrar e exportar todas as respostas coletadas.

**Interface do admin**:
- Tabela de submissions com colunas dinâmicas (baseadas nos campos do form)
- Filtros por: data, status (completo/parcial/cancelado), campo específico
- Busca fulltext nas respostas
- Detalhes expandíveis com timeline da conversa
- Export: CSV, Excel, JSON
- Bulk actions: excluir, reenviar, adicionar tag ao contato

**Exemplo de tabela**:
```
| Data       | Nome         | Email             | Empresa    | Orçamento | Status    |
|------------|-------------|-------------------|------------|-----------|-----------|
| 21/03/2026 | João Silva  | joao@email.com    | TechCo     | R$ 2.000  | Completo  |
| 21/03/2026 | Maria Santos| maria@empresa.com | StartupX   | R$ 5.000  | Completo  |
| 20/03/2026 | Pedro Lima  | pedro@mail.com    | —          | —         | Parcial   |
```

**Métricas do formulário**:
- Total de submissions (completas vs parciais vs canceladas)
- Taxa de conclusão: 72% (quantos iniciam vs quantos terminam)
- Tempo médio para completar: 4min 32s
- Campo com maior abandono: "Qual seu CNPJ?" (18% desistem aqui)
- Respostas por dia (gráfico de linha)

---

##### T12.5 — Landing Page de Captura
**Descrição completa**: Página web simples que captura dados básicos e redireciona para WhatsApp.

**Estrutura da landing page**:
```
┌──────────────────────────────────┐
│   [Logo] MinhaEmpresa            │
│                                  │
│   Título: "Solicite seu          │
│   Orçamento Grátis!"             │
│                                  │
│   Subtítulo: "Preencha abaixo    │
│   e receba atendimento           │
│   personalizado via WhatsApp"    │
│                                  │
│   [Campo: Nome]                  │
│   [Campo: Telefone com WhatsApp] │
│   [Campo: O que precisa?]        │
│                                  │
│   [Botão: Falar no WhatsApp →]   │
│                                  │
│   "Atendimento em até 5 minutos" │
└──────────────────────────────────┘
```

**Ao submeter**:
1. Dados salvos no contato (create/upsert)
2. Redireciona para `wa.me/{numero}?text=Oi! Meu nome é {nome}...`
3. Trigger no funil (M10): novo contato com tag "landing_page_orcamento"
4. Formulário completo (M12) inicia automaticamente no WhatsApp

**Customização**: Cores, logo, campos, textos, imagem de fundo — tudo editável no admin.

---

##### T12.6 — Integração com Funis (M10)
**Descrição completa**: Usar formulário como um step dentro de um funil conversacional.

**Exemplo no builder de funis**:
```
[Trigger: keyword "orçamento"]
  → [📨 "Vou precisar de algumas informações!"]
  → [📋 Formulário: "Cadastro de Lead" (5 campos)]
  → [🔀 Condição: resposta_orcamento > 5000]
     ├─ Sim → [⚡ Criar card "Lead Premium"] → [📨 "Nosso diretor vai te atender!"]
     └─ Não → [⚡ Criar card "Lead Standard"] → [📨 "Nosso time vai te atender!"]
```

**Dados coletados pelo formulário ficam disponíveis como variáveis no funil**:
- `{{form.nome}}`, `{{form.email}}`, `{{form.orcamento}}`, etc.

---

##### T12.7 — Webhook de Submission
**Descrição completa**: Disparar webhook HTTP POST para sistema externo quando formulário é completado.

**Payload de exemplo**:
```json
{
  "event": "form.submission.completed",
  "form_id": 42,
  "form_name": "Orçamento",
  "submission_id": 789,
  "contact_id": 123,
  "contact_phone": "+5511999887766",
  "submitted_at": "2026-03-21T14:30:00Z",
  "answers": {
    "nome": "João Silva",
    "email": "joao@email.com",
    "empresa": "TechCo",
    "funcionarios": "11-50",
    "orcamento": "R$ 2.000"
  }
}
```

**Configuração**: URL + headers customizados + retry policy (3 tentativas com backoff)
**Integração**: Enviar para n8n, Zapier, Make, HubSpot, Google Sheets, etc.

---

##### T12.8 — Lógica Condicional entre Campos
**Descrição completa**: Mostrar ou pular campos baseado nas respostas anteriores.

**Exemplo**:
```
Campo 1: "Você é pessoa física ou jurídica? 1) Física  2) Jurídica"
  Se "Física" → Campo 2a: "Qual seu CPF?"
  Se "Jurídica" → Campo 2b: "Qual seu CNPJ?" → Campo 2c: "Razão social?"

Campo 3: "Já é nosso cliente? Sim/Não"
  Se "Sim" → Pular para Campo 5 (dados do projeto)
  Se "Não" → Campo 4: "Como nos conheceu? 1) Google 2) Indicação 3) Instagram 4) Outro"
```

---

##### T12.9 — Validação de Respostas
**Descrição completa**: Validar cada resposta antes de aceitar e avançar para próximo campo.

**Validações built-in**:
| Validação | Regex/Lógica | Mensagem de erro |
|-----------|-------------|------------------|
| CPF | 11 dígitos + dígito verificador | "CPF inválido. Confira e envie novamente." |
| CNPJ | 14 dígitos + dígito verificador | "CNPJ inválido." |
| Email | Regex RFC 5322 | "E-mail inválido. Exemplo: nome@email.com" |
| Telefone BR | (XX) XXXXX-XXXX ou +55... | "Telefone inválido. Use DDD + número." |
| CEP | 8 dígitos → ViaCEP | "CEP não encontrado. Confira e envie novamente." |
| Data | dd/mm/aaaa válida | "Data inválida. Use o formato DD/MM/AAAA." |
| URL | https?://... | "URL inválida. Comece com https://" |
| Custom regex | Configurável | Mensagem customizável |

---

##### T12.10 — Auto-preencher Dados Conhecidos
**Descrição completa**: Se o contato já tem dados salvos no sistema, pular o campo ou confirmar o valor existente.

**Exemplo**:
```
[Contato já tem nome e email salvos]

Bot: "📋 Vamos ao cadastro!"
Bot: "Confirma que seu nome é *João Silva*? (Sim/Não)"
Contato: "Sim"
Bot: "E seu e-mail é *joao@email.com*? (Sim/Não)"
Contato: "Não, mudou. É joao.novo@email.com"
Bot: "Atualizado! Agora, qual o tamanho da sua empresa?"
[...continua campos desconhecidos...]
```

**Configuração por campo**:
- "Pular se preenchido" — não pergunta, usa valor salvo
- "Confirmar se preenchido" — pergunta confirmação
- "Sempre perguntar" — ignora valor salvo

**Tabelas planejadas**: `forms`, `form_fields`, `form_field_sets`, `form_field_options`, `form_conditions`, `form_submissions`, `form_answers`, `form_webhooks`

**Edge Functions planejadas**: `execute-form-bot`, `validate-form-answer`, `form-submission-webhook`

**Componentes planejados**: `FormBuilder`, `FieldEditor`, `FieldList`, `ConditionBuilder`, `SubmissionTable`, `SubmissionDetail`, `FormPreview`, `LandingPageEditor`, `FormMetrics`

---

