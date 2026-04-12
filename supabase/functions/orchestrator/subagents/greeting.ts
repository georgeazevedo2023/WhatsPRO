// =============================================================================
// Greeting Subagent (S5 — P0)
// 6 sub-params: greeting_message, ask_name_message, known_lead_message,
//               context_depth, collect_name, name_already_known_action
//
// Fluxo:
//   1. Lead retornante (sessions_count > 0) + tem nome → known_lead_message → advance
//   2. Lead novo com nome                              → greeting_message personalizado → advance
//   3. Lead sem nome + collect_name=true              → greeting + ask_name → waiting_for:'name'
//   4. waiting_for='name'                             → extrai nome → salva → advance
//
// Extração de nome: sem LLM — patterns BR + heurística de comprimento.
// =============================================================================

import { saveLeadName, upsertLongMemory } from '../services/memory.ts'
import type { SubagentInput, SubagentResult } from '../types.ts'

// ── Config do subagente Greeting (P0) ────────────────────────────────────────

export interface GreetingConfig {
  greeting_message?: string        // ex: "Olá {name}! Bem-vindo 👋" | "Olá! Bem-vindo 👋"
  ask_name_message?: string        // ex: "Qual é o seu nome?"
  known_lead_message?: string      // ex: "Que bom te ver de volta, {name}! 😊"
  context_depth?: 'minimal' | 'standard' | 'full'  // S5: minimal (0 tokens extra)
  collect_name?: boolean           // default: true — coleta nome se não preenchido
  name_already_known_action?: 'skip' | 'confirm'   // default: 'skip'
}

const DEFAULTS = {
  greeting:   'Olá! Bem-vindo 👋',
  ask_name:   'Para eu te atender melhor, qual é o seu nome?',
  known_lead: 'Que bom te ver de volta, {name}! 😊',
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function greetingSubagent(
  input: SubagentInput<GreetingConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { lead, flow_state } = context
  const messageText = context.input.message_text ?? ''

  const longMemory = (lead.long_memory ?? {}) as Record<string, unknown>
  const sessionsCount = (longMemory.sessions_count as number) ?? 0
  const waitingFor = flow_state.step_data.waiting_for as string | undefined

  // ── Case A: Coletando nome — lead respondeu após ask_name ────────────────────
  if (waitingFor === 'name') {
    return handleNameCollection(input, messageText, longMemory, sessionsCount)
  }

  // ── Incrementa sessions_count na primeira mensagem deste flow ────────────────
  // Fix B#3: step_data pode ter message_count=undefined se o default do banco não foi aplicado
  const isFirstMessage = ((flow_state.step_data.message_count as number) ?? 0) === 0
  if (isFirstMessage) {
    await upsertLongMemory(lead.lead_id, flow_state.instance_id, {
      sessions_count: sessionsCount + 1,
      last_contact: new Date().toISOString(),
      first_contact: (longMemory.first_contact as string) ?? new Date().toISOString(),
    })
  }

  // ── Case B+C: Lead com nome conhecido → nunca perguntar "com quem falo?" ────
  // B: sessionsCount > 0 (retornante no orchestrator)
  // C: sessionsCount = 0 mas nome já salvo (migrado do ai-agent antigo, ou captado
  //    via bio/form antes de contatar o WhatsApp) — tratar como retornante para
  //    evitar enviar greeting_message que pode incluir "com quem eu falo?"
  if (lead.lead_name) {
    const template = config.known_lead_message ?? DEFAULTS.known_lead
    return {
      status: 'advance',
      response_text: personalize(template, lead.lead_name),
      exit_rule_triggered: { trigger: 'greeting_done', action: 'next_step' },
      step_data_patch: { last_subagent: 'greeting' },
    }
  }

  // ── Case D: Lead sem nome ────────────────────────────────────────────────────
  const collectName = config.collect_name !== false  // default: true

  if (!collectName) {
    const template = config.greeting_message ?? DEFAULTS.greeting
    return {
      status: 'advance',
      response_text: personalize(template, '').trim(),
      exit_rule_triggered: { trigger: 'greeting_done', action: 'next_step' },
      step_data_patch: { last_subagent: 'greeting' },
    }
  }

  // Coleta nome: saudação + pergunta
  const greetingPart = personalize(config.greeting_message ?? DEFAULTS.greeting, '').trim()
  const askNamePart  = config.ask_name_message ?? DEFAULTS.ask_name
  const combined     = greetingPart ? `${greetingPart}\n\n${askNamePart}` : askNamePart

  return {
    status: 'continue',
    response_text: combined,
    step_data_patch: {
      waiting_for: 'name',
      last_subagent: 'greeting',
    },
  }
}

// ── Coleta e valida nome ──────────────────────────────────────────────────────

async function handleNameCollection(
  input: SubagentInput<GreetingConfig>,
  messageText: string,
  longMemory: Record<string, unknown>,
  sessionsCount: number,
): Promise<SubagentResult> {
  const { context, config } = input
  const { lead, flow_state } = context

  const name = extractName(messageText)

  if (!name) {
    const retry = (flow_state.step_data.retry_count as number) ?? 0

    // Após 2 tentativas sem nome válido → avança sem nome
    if (retry >= 2) {
      return {
        status: 'advance',
        response_text: 'Tudo bem! Como posso te ajudar? 😊',
        exit_rule_triggered: { trigger: 'greeting_done', action: 'next_step' },
        step_data_patch: { waiting_for: undefined, retry_count: 0, last_subagent: 'greeting' },
      }
    }

    return {
      status: 'continue',
      response_text: config.ask_name_message ?? DEFAULTS.ask_name,
      step_data_patch: {
        waiting_for: 'name',
        retry_count: retry + 1,
        last_subagent: 'greeting',
      },
    }
  }

  // ✅ Nome extraído — persiste em lead_profiles + long_memory
  await saveLeadName(lead.lead_id, name)
  await upsertLongMemory(lead.lead_id, flow_state.instance_id, {
    sessions_count: sessionsCount,
    profile: { ...((longMemory.profile as Record<string, unknown>) ?? {}), name },
    last_contact: new Date().toISOString(),
  })

  return {
    status: 'advance',
    response_text: `Prazer, ${name}! Como posso te ajudar? 😊`,
    exit_rule_triggered: { trigger: 'name_collected', action: 'next_step' },
    step_data_patch: {
      waiting_for: undefined,
      retry_count: 0,
      last_subagent: 'greeting',
    },
    lead_profile_patch: { full_name: name },
  }
}

// ── Extração de nome (sem LLM) ────────────────────────────────────────────────
// Cobre: "me chamo X", "meu nome é X", "sou X", texto curto sem números.

function extractName(text: string): string | null {
  const t = text.trim()
  if (!t || t.length < 2) return null

  // Padrões explícitos BR
  const patterns = [
    /(?:me\s+chamo|meu\s+nome\s+[eé]|pode\s+(?:me\s+)?chamar\s+(?:de\s+)?|sou\s+o?\s+a?\s*)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú]?[a-zà-ú]+)*)/i,
  ]
  for (const pattern of patterns) {
    const match = t.match(pattern)
    if (match?.[1]) return capitalize(match[1].trim())
  }

  // Heurística: texto curto (≤40 chars) apenas com letras/espaços → nome direto
  if (t.length <= 40 && /^[A-Za-zÀ-ÿ\s'-]+$/.test(t)) {
    const words = t.split(/\s+/).slice(0, 3)   // max 3 palavras
    return capitalize(words.join(' '))
  }

  return null
}

function capitalize(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function personalize(template: string, name: string): string {
  return template.replace(/\{name\}/g, name)
}
