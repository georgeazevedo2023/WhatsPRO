/* ─── M12: WhatsApp Forms — Types & Templates ───────────────────────────────── */

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'email'
  | 'phone'
  | 'cpf'
  | 'cep'
  | 'date'
  | 'time'
  | 'select'
  | 'multi_select'
  | 'yes_no'
  | 'scale'
  | 'file'
  | 'location'
  | 'signature'

export type FormTemplateType =
  | 'nps'
  | 'sorteio'
  | 'satisfacao'
  | 'cadastro'
  | 'consulta'
  | 'orcamento'
  | 'evento'
  | 'pesquisa_produto'
  | 'anamnese'
  | 'vaga'
  | 'chamado'
  | 'feedback'
  | 'custom'

export interface FieldValidationRules {
  min?: number
  max?: number
  regex?: string
  options?: string[]
  scale_min?: number
  scale_max?: number
  file_types?: string[]
  max_size_mb?: number
  expected_value?: string
}

export interface FormField {
  id: string
  form_id: string
  position: number
  field_type: FieldType
  label: string
  required: boolean
  validation_rules: FieldValidationRules | null
  error_message: string | null
  skip_if_known: boolean
  field_key: string
  created_at: string
}

export interface WhatsappForm {
  id: string
  agent_id: string
  name: string
  slug: string
  description: string | null
  template_type: FormTemplateType | null
  status: 'active' | 'draft' | 'archived'
  welcome_message: string
  completion_message: string
  webhook_url: string | null
  max_submissions: number | null
  expires_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  form_fields?: FormField[]
}

export interface FormSession {
  id: string
  form_id: string
  conversation_id: string
  contact_id: string | null
  current_field_index: number
  collected_data: Record<string, unknown>
  status: 'in_progress' | 'completed' | 'abandoned'
  retries: number
  started_at: string
  completed_at: string | null
  last_activity_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  session_id: string | null
  contact_id: string | null
  data: Record<string, unknown>
  submitted_at: string
}

export interface FormStats {
  total: number
  today: number
}

/* ─── Template shape ─────────────────────────────────────────────────────────── */

export interface FormTemplate {
  type: FormTemplateType
  name: string
  description: string
  icon: string
  color: string
  thumbnail?: string
  welcome_message: string
  completion_message: string
  fields: Array<Omit<FormField, 'id' | 'form_id' | 'created_at'>>
}

/* ─── 12 Built-in Templates ──────────────────────────────────────────────────── */

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    type: 'nps',
    name: 'NPS — Net Promoter Score',
    description: 'Meça a probabilidade de recomendação da sua empresa em 2 perguntas.',
    icon: 'Star',
    color: 'text-yellow-400',
    thumbnail: '/templates/nps.png',
    welcome_message: 'Olá! Em menos de 1 minuto, preciso da sua opinião sobre a nossa empresa. 🙏',
    completion_message: 'Obrigado pela avaliação! Seu feedback é muito importante para nós. 💛',
    fields: [
      {
        position: 0,
        field_type: 'scale',
        label: 'De 0 a 10, qual a probabilidade de você recomendar nossa empresa para um amigo ou familiar?',
        required: true,
        validation_rules: { scale_min: 0, scale_max: 10 },
        error_message: 'Por favor, envie um número de 0 a 10.',
        skip_if_known: false,
        field_key: 'nps_score',
      },
      {
        position: 1,
        field_type: 'long_text',
        label: 'Qual é o principal motivo da sua nota? (opcional — pode pular digitando "pular")',
        required: false,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'nps_comentario',
      },
    ],
  },
  {
    type: 'sorteio',
    name: 'Sorteio / Promoção',
    description: 'Colete dados para participação em sorteio com aceite de termos.',
    icon: 'Gift',
    color: 'text-purple-400',
    thumbnail: '/templates/sorteio.png',
    welcome_message: 'Participe do nosso sorteio! Preencha seus dados abaixo para se inscrever. 🍀',
    completion_message: 'Você está inscrito no sorteio! O resultado será divulgado em nosso canal. Boa sorte! 🎉',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual é o seu nome completo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'nome_completo',
      },
      {
        position: 1,
        field_type: 'phone',
        label: 'Qual é o seu telefone com DDD? (ex: 11987654321)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie seu número com DDD (mín. 10 dígitos).',
        skip_if_known: true,
        field_key: 'telefone',
      },
      {
        position: 2,
        field_type: 'cpf',
        label: 'Qual é o seu CPF? (somente números)',
        required: true,
        validation_rules: null,
        error_message: 'CPF inválido. Por favor, envie os 11 dígitos do seu CPF.',
        skip_if_known: false,
        field_key: 'cpf',
      },
      {
        position: 3,
        field_type: 'signature',
        label: 'Para finalizar, confirme sua participação digitando exatamente: ACEITO',
        required: true,
        validation_rules: { expected_value: 'ACEITO' },
        error_message: 'Digite exatamente "ACEITO" (em maiúsculas) para confirmar.',
        skip_if_known: false,
        field_key: 'aceite_termos',
      },
    ],
  },
  {
    type: 'satisfacao',
    name: 'Pesquisa de Satisfação',
    description: 'Avalie atendimento, produto e probabilidade de recomendação.',
    icon: 'ThumbsUp',
    color: 'text-green-400',
    thumbnail: '/templates/satisfacao.png',
    welcome_message: 'Olá! Adoraríamos saber sua opinião sobre nossa loja. São só 4 perguntas rápidas:',
    completion_message: 'Muito obrigado! Seu feedback nos ajuda a melhorar sempre. 😊',
    fields: [
      {
        position: 0,
        field_type: 'scale',
        label: 'De 1 a 5, como você avalia o atendimento que recebeu?',
        required: true,
        validation_rules: { scale_min: 1, scale_max: 5 },
        error_message: 'Por favor, envie um número de 1 a 5.',
        skip_if_known: false,
        field_key: 'nota_atendimento',
      },
      {
        position: 1,
        field_type: 'scale',
        label: 'De 1 a 5, como você avalia o produto/serviço recebido?',
        required: true,
        validation_rules: { scale_min: 1, scale_max: 5 },
        error_message: 'Por favor, envie um número de 1 a 5.',
        skip_if_known: false,
        field_key: 'nota_produto',
      },
      {
        position: 2,
        field_type: 'yes_no',
        label: 'Você recomendaria nossa empresa para amigos? (sim/não)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, responda "sim" ou "não".',
        skip_if_known: false,
        field_key: 'recomendaria',
      },
      {
        position: 3,
        field_type: 'long_text',
        label: 'Tem algum comentário ou sugestão para nós? (opcional)',
        required: false,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'comentario',
      },
    ],
  },
  {
    type: 'cadastro',
    name: 'Pré-cadastro de Cliente',
    description: 'Colete dados básicos para cadastro de novos clientes.',
    icon: 'UserPlus',
    color: 'text-blue-400',
    thumbnail: '/templates/cadastro.png',
    welcome_message: 'Olá! Vou realizar seu pré-cadastro em nosso sistema. São só 5 informações:',
    completion_message: 'Cadastro realizado com sucesso! Nossa equipe entrará em contato em breve. ✅',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual é o seu nome completo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'nome_completo',
      },
      {
        position: 1,
        field_type: 'email',
        label: 'Qual é o seu e-mail?',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie um e-mail válido (ex: nome@email.com).',
        skip_if_known: false,
        field_key: 'email',
      },
      {
        position: 2,
        field_type: 'cpf',
        label: 'Qual é o seu CPF? (somente números)',
        required: true,
        validation_rules: null,
        error_message: 'CPF inválido. Envie os 11 dígitos sem pontos ou traços.',
        skip_if_known: false,
        field_key: 'cpf',
      },
      {
        position: 3,
        field_type: 'date',
        label: 'Qual é a sua data de nascimento? (dd/mm/aaaa)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie a data no formato dd/mm/aaaa (ex: 15/03/1990).',
        skip_if_known: false,
        field_key: 'data_nascimento',
      },
      {
        position: 4,
        field_type: 'short_text',
        label: 'Em qual cidade você mora?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'cidade',
      },
    ],
  },
  {
    type: 'consulta',
    name: 'Agendamento de Consulta',
    description: 'Solicite informações para agendar uma consulta médica ou serviço.',
    icon: 'Calendar',
    color: 'text-teal-400',
    thumbnail: '/templates/consulta.png',
    welcome_message: 'Olá! Vamos agendar sua consulta. Preciso de algumas informações:',
    completion_message: 'Agendamento solicitado! Nossa equipe confirmará o horário em até 24h. 📅',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual é o seu nome completo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'nome_completo',
      },
      {
        position: 1,
        field_type: 'select',
        label: 'Qual especialidade?\n1) Clínico Geral\n2) Ortopedia\n3) Cardiologia\n4) Dermatologia\n5) Outra',
        required: true,
        validation_rules: { options: ['Clínico Geral', 'Ortopedia', 'Cardiologia', 'Dermatologia', 'Outra'] },
        error_message: 'Por favor, envie o número da especialidade desejada.',
        skip_if_known: false,
        field_key: 'especialidade',
      },
      {
        position: 2,
        field_type: 'date',
        label: 'Qual data você prefere para a consulta? (dd/mm/aaaa)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie a data no formato dd/mm/aaaa.',
        skip_if_known: false,
        field_key: 'data_preferida',
      },
      {
        position: 3,
        field_type: 'time',
        label: 'Qual horário você prefere? (ex: 09:00 ou 14:30)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie o horário no formato HH:MM (ex: 14:30).',
        skip_if_known: false,
        field_key: 'horario_preferido',
      },
      {
        position: 4,
        field_type: 'select',
        label: 'Qual convênio?\n1) Unimed\n2) Bradesco Saúde\n3) Amil\n4) SulAmérica\n5) Particular',
        required: true,
        validation_rules: { options: ['Unimed', 'Bradesco Saúde', 'Amil', 'SulAmérica', 'Particular'] },
        error_message: 'Por favor, envie o número do convênio.',
        skip_if_known: false,
        field_key: 'convenio',
      },
    ],
  },
  {
    type: 'orcamento',
    name: 'Orçamento de Obras / Serviços',
    description: 'Solicite informações para gerar um orçamento de obra ou serviço.',
    icon: 'HardHat',
    color: 'text-orange-400',
    thumbnail: '/templates/orcamento.png',
    welcome_message: 'Olá! Para preparar seu orçamento, preciso de algumas informações:',
    completion_message: 'Orçamento solicitado! Nossa equipe retornará em até 48h com os valores. 🏗️',
    fields: [
      {
        position: 0,
        field_type: 'select',
        label: 'Qual tipo de serviço?\n1) Pintura\n2) Reforma\n3) Elétrica\n4) Hidráulica\n5) Outro',
        required: true,
        validation_rules: { options: ['Pintura', 'Reforma', 'Elétrica', 'Hidráulica', 'Outro'] },
        error_message: 'Por favor, envie o número do tipo de serviço.',
        skip_if_known: false,
        field_key: 'tipo_servico',
      },
      {
        position: 1,
        field_type: 'number',
        label: 'Qual é a metragem aproximada em m²?',
        required: true,
        validation_rules: { min: 1, max: 99999 },
        error_message: 'Por favor, envie a metragem em metros quadrados (apenas número).',
        skip_if_known: false,
        field_key: 'metragem_m2',
      },
      {
        position: 2,
        field_type: 'short_text',
        label: 'Em qual cidade será o serviço?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'cidade',
      },
      {
        position: 3,
        field_type: 'short_text',
        label: 'Qual é o prazo desejado para execução? (ex: 30 dias, urgente, flexível)',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'prazo_desejado',
      },
      {
        position: 4,
        field_type: 'long_text',
        label: 'Descreva brevemente o que precisa ser feito:',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'descricao',
      },
    ],
  },
  {
    type: 'evento',
    name: 'Inscrição em Evento',
    description: 'Colete dados para inscrição de participantes em eventos.',
    icon: 'CalendarCheck',
    color: 'text-pink-400',
    thumbnail: '/templates/evento.png',
    welcome_message: 'Olá! Vamos fazer sua inscrição no evento. Preciso de algumas informações:',
    completion_message: 'Inscrição confirmada! Você receberá as instruções de acesso por aqui. 🎉',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual é o seu nome completo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'nome_completo',
      },
      {
        position: 1,
        field_type: 'email',
        label: 'Qual é o seu e-mail para receber as confirmações?',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie um e-mail válido.',
        skip_if_known: false,
        field_key: 'email',
      },
      {
        position: 2,
        field_type: 'short_text',
        label: 'Em qual empresa você trabalha?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'empresa',
      },
      {
        position: 3,
        field_type: 'short_text',
        label: 'Qual é o seu cargo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'cargo',
      },
      {
        position: 4,
        field_type: 'number',
        label: 'Quantas pessoas irão participar (incluindo você)?',
        required: true,
        validation_rules: { min: 1, max: 100 },
        error_message: 'Por favor, envie um número válido de participantes.',
        skip_if_known: false,
        field_key: 'numero_participantes',
      },
    ],
  },
  {
    type: 'pesquisa_produto',
    name: 'Pesquisa de Interesse em Produto',
    description: 'Qualifique leads com interesse em produto, budget e prazo de compra.',
    icon: 'BarChart3',
    color: 'text-indigo-400',
    thumbnail: '/templates/pesquisa_produto.png',
    welcome_message: 'Olá! Queremos entender melhor suas necessidades para oferecer a melhor solução. Pode me ajudar?',
    completion_message: 'Perfeito! Nossa equipe comercial entrará em contato com as melhores opções para você. 📊',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual produto ou serviço você tem interesse?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'produto_interesse',
      },
      {
        position: 1,
        field_type: 'select',
        label: 'Qual é sua faixa de orçamento?\n1) Até R$ 500\n2) R$ 500 a R$ 2.000\n3) R$ 2.000 a R$ 5.000\n4) Acima de R$ 5.000',
        required: true,
        validation_rules: { options: ['Até R$ 500', 'R$ 500 a R$ 2.000', 'R$ 2.000 a R$ 5.000', 'Acima de R$ 5.000'] },
        error_message: 'Por favor, envie o número correspondente à sua faixa de orçamento.',
        skip_if_known: false,
        field_key: 'faixa_orcamento',
      },
      {
        position: 2,
        field_type: 'select',
        label: 'Quando você pretende comprar?\n1) Essa semana\n2) Este mês\n3) Nos próximos 3 meses\n4) Ainda pesquisando',
        required: true,
        validation_rules: { options: ['Essa semana', 'Este mês', 'Nos próximos 3 meses', 'Ainda pesquisando'] },
        error_message: 'Por favor, envie o número do prazo.',
        skip_if_known: false,
        field_key: 'prazo_compra',
      },
      {
        position: 3,
        field_type: 'yes_no',
        label: 'Você já usa algum produto similar atualmente? (sim/não)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, responda "sim" ou "não".',
        skip_if_known: false,
        field_key: 'usa_atualmente',
      },
    ],
  },
  {
    type: 'anamnese',
    name: 'Anamnese Médica',
    description: 'Pré-consulta com dados do paciente, queixas e histórico médico.',
    icon: 'Stethoscope',
    color: 'text-red-400',
    thumbnail: '/templates/anamnese.png',
    welcome_message: 'Olá! Vou preencher sua ficha de anamnese antes da consulta. O médico já terá seus dados ao chegar:',
    completion_message: 'Ficha preenchida com sucesso! O médico já terá seus dados ao chegar. ✅',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual é o seu nome completo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'nome_completo',
      },
      {
        position: 1,
        field_type: 'date',
        label: 'Qual é a sua data de nascimento? (dd/mm/aaaa)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie a data no formato dd/mm/aaaa.',
        skip_if_known: false,
        field_key: 'data_nascimento',
      },
      {
        position: 2,
        field_type: 'long_text',
        label: 'Qual é sua queixa principal? Descreva brevemente o que está sentindo:',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'queixa_principal',
      },
      {
        position: 3,
        field_type: 'short_text',
        label: 'Possui alguma alergia conhecida? (Se não, escreva "nenhuma")',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'alergias',
      },
      {
        position: 4,
        field_type: 'short_text',
        label: 'Usa algum medicamento regularmente? (Se não, escreva "nenhum")',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'medicamentos',
      },
    ],
  },
  {
    type: 'vaga',
    name: 'Candidatura a Vaga de Emprego',
    description: 'Triagem inicial de candidatos com dados profissionais básicos.',
    icon: 'Briefcase',
    color: 'text-cyan-400',
    thumbnail: '/templates/vaga.png',
    welcome_message: 'Olá! Para se candidatar à vaga, preciso de algumas informações profissionais:',
    completion_message: 'Candidatura recebida! Entraremos em contato se o perfil for compatível com a vaga. 💼',
    fields: [
      {
        position: 0,
        field_type: 'short_text',
        label: 'Qual é o seu nome completo?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'nome_completo',
      },
      {
        position: 1,
        field_type: 'email',
        label: 'Qual é o seu e-mail profissional?',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, envie um e-mail válido.',
        skip_if_known: false,
        field_key: 'email',
      },
      {
        position: 2,
        field_type: 'short_text',
        label: 'Qual cargo você está buscando?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'cargo_desejado',
      },
      {
        position: 3,
        field_type: 'number',
        label: 'Quantos anos de experiência na área você tem?',
        required: true,
        validation_rules: { min: 0, max: 50 },
        error_message: 'Por favor, envie um número válido de anos de experiência.',
        skip_if_known: false,
        field_key: 'anos_experiencia',
      },
      {
        position: 4,
        field_type: 'short_text',
        label: 'Link do seu LinkedIn ou portfólio (opcional — pode pular digitando "pular"):',
        required: false,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'curriculo_link',
      },
    ],
  },
  {
    type: 'chamado',
    name: 'Abertura de Chamado de Suporte',
    description: 'Registre problemas técnicos com tipo, descrição e urgência.',
    icon: 'Ticket',
    color: 'text-amber-400',
    thumbnail: '/templates/chamado.png',
    welcome_message: 'Olá! Vou registrar seu chamado de suporte. Me conta o que aconteceu:',
    completion_message: 'Chamado registrado com sucesso! Nossa equipe entrará em contato em breve. 🎫',
    fields: [
      {
        position: 0,
        field_type: 'select',
        label: 'Qual tipo de problema?\n1) Falha no sistema\n2) Dúvida técnica\n3) Solicitação de feature\n4) Acesso/Login\n5) Outro',
        required: true,
        validation_rules: { options: ['Falha no sistema', 'Dúvida técnica', 'Solicitação de feature', 'Acesso/Login', 'Outro'] },
        error_message: 'Por favor, envie o número do tipo de problema.',
        skip_if_known: false,
        field_key: 'tipo_problema',
      },
      {
        position: 1,
        field_type: 'long_text',
        label: 'Descreva o problema com o máximo de detalhes possível:',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'descricao',
      },
      {
        position: 2,
        field_type: 'select',
        label: 'Qual é a urgência?\n1) Baixa — posso esperar\n2) Média — preciso hoje\n3) Alta — está impactando minha operação\n4) Crítica — sistema parado',
        required: true,
        validation_rules: { options: ['Baixa', 'Média', 'Alta', 'Crítica'] },
        error_message: 'Por favor, envie o número da urgência.',
        skip_if_known: false,
        field_key: 'urgencia',
      },
      {
        position: 3,
        field_type: 'short_text',
        label: 'Qual é o seu nome para contato?',
        required: true,
        validation_rules: null,
        error_message: null,
        skip_if_known: true,
        field_key: 'contato_nome',
      },
    ],
  },
  {
    type: 'feedback',
    name: 'Feedback Pós-Atendimento',
    description: 'Avalie o atendimento recebido com nota, tempo de espera e resolução.',
    icon: 'MessageSquareHeart',
    color: 'text-rose-400',
    thumbnail: '/templates/feedback.png',
    welcome_message: 'Olá! Seu atendimento foi finalizado. Pode nos dar um feedback rápido? São só 4 perguntas:',
    completion_message: 'Muito obrigado pelo seu feedback! Vamos usar isso para melhorar cada vez mais. 😊',
    fields: [
      {
        position: 0,
        field_type: 'scale',
        label: 'De 1 a 5, como você avalia o atendente? (1 = ruim, 5 = excelente)',
        required: true,
        validation_rules: { scale_min: 1, scale_max: 5 },
        error_message: 'Por favor, envie um número de 1 a 5.',
        skip_if_known: false,
        field_key: 'nota_atendente',
      },
      {
        position: 1,
        field_type: 'select',
        label: 'Como foi o tempo de espera?\n1) Rápido — fui atendido rapidamente\n2) Ok — dentro do esperado\n3) Demorou — esperei mais do que gostaria',
        required: true,
        validation_rules: { options: ['Rápido', 'Ok', 'Demorou'] },
        error_message: 'Por favor, envie o número correspondente.',
        skip_if_known: false,
        field_key: 'tempo_espera',
      },
      {
        position: 2,
        field_type: 'yes_no',
        label: 'Seu problema foi resolvido? (sim/não)',
        required: true,
        validation_rules: null,
        error_message: 'Por favor, responda "sim" ou "não".',
        skip_if_known: false,
        field_key: 'problema_resolvido',
      },
      {
        position: 3,
        field_type: 'long_text',
        label: 'Alguma sugestão de melhoria? (opcional)',
        required: false,
        validation_rules: null,
        error_message: null,
        skip_if_known: false,
        field_key: 'sugestoes',
      },
    ],
  },
]
