/**
 * LLM Provider abstraction — OpenAI (primary) + Gemini (fallback).
 *
 * Converts between OpenAI Chat Completions API format and Gemini format.
 * Tools/function calling use OpenAI's native format.
 *
 * Usage:
 *   import { callLLM } from '../_shared/llmProvider.ts'
 *   const result = await callLLM({ systemPrompt, messages, tools, temperature, maxTokens })
 */

import { fetchWithTimeout } from './fetchWithTimeout.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: LLMToolCall[]
}

export interface LLMToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LLMToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LLMRequest {
  systemPrompt: string
  messages: LLMMessage[]
  tools: LLMToolDef[]
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface LLMResponse {
  text: string
  toolCalls: { name: string; args: Record<string, unknown>; id: string }[]
  inputTokens: number
  outputTokens: number
  model: string
  provider: 'openai' | 'gemini'
}

/* ═══════════════════════════════════════════ */
/*  OpenAI Chat Completions                    */
/* ═══════════════════════════════════════════ */

async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
  const model = req.model || 'gpt-4.1-mini'

  const openaiMessages: any[] = [
    { role: 'system', content: req.systemPrompt },
    ...req.messages,
  ]

  const openaiTools = req.tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const body: Record<string, unknown> = {
    model,
    messages: openaiMessages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 1024,
  }
  if (openaiTools.length > 0) body.tools = openaiTools

  const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  }, 30000)

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`OpenAI ${resp.status}: ${err.substring(0, 300)}`)
  }

  const data = await resp.json()
  const choice = data.choices?.[0]
  const message = choice?.message

  const toolCalls = (message?.tool_calls || []).map((tc: any) => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments || '{}'),
    id: tc.id,
  }))

  return {
    text: message?.content || '',
    toolCalls,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    model,
    provider: 'openai',
  }
}

/* ═══════════════════════════════════════════ */
/*  Gemini (fallback)                          */
/* ═══════════════════════════════════════════ */

function convertToolsToGemini(tools: LLMToolDef[]): any {
  return [{
    function_declarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }]
}

function convertMessagesToGemini(messages: LLMMessage[]): any[] {
  const contents: any[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue // system goes in system_instruction
    if (msg.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: msg.tool_call_id || 'unknown', response: { result: msg.content } } }],
      })
      continue
    }
    if (msg.tool_calls?.length) {
      contents.push({
        role: 'model',
        parts: msg.tool_calls.map(tc => ({
          functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') },
        })),
      })
      continue
    }
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }
  return contents
}

async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

  const contents = convertMessagesToGemini(req.messages)
  const geminiTools = convertToolsToGemini(req.tools)

  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: req.systemPrompt }] },
      contents,
      tools: geminiTools,
      generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 1024 },
    }),
  }, 30000)

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gemini ${resp.status}: ${err.substring(0, 300)}`)
  }

  const data = await resp.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const functionCalls = parts.filter((p: any) => p.functionCall)

  const toolCalls = functionCalls.map((fc: any, i: number) => ({
    name: fc.functionCall.name,
    args: fc.functionCall.args || {},
    id: `gemini_tc_${i}`,
  }))

  return {
    text: parts.find((p: any) => p.text)?.text || '',
    toolCalls,
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    model,
    provider: 'gemini',
  }
}

/* ═══════════════════════════════════════════ */
/*  Public API — OpenAI primary, Gemini fallback */
/* ═══════════════════════════════════════════ */

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  // Primary: OpenAI
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(req)
    } catch (err) {
      console.warn(`[llm] OpenAI failed, falling back to Gemini:`, (err as Error).message)
    }
  }

  // Fallback: Gemini
  if (GEMINI_API_KEY) {
    return await callGemini(req)
  }

  throw new Error('No LLM API key configured (OPENAI_API_KEY or GEMINI_API_KEY)')
}

/**
 * Add tool results to the message history (works for both providers).
 * Returns updated messages array.
 */
export function appendToolResults(
  messages: LLMMessage[],
  assistantToolCalls: { name: string; args: Record<string, unknown>; id: string }[],
  results: { name: string; result: string }[],
): LLMMessage[] {
  // Add assistant message with tool_calls
  const updated = [...messages, {
    role: 'assistant' as const,
    content: '',
    tool_calls: assistantToolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: JSON.stringify(tc.args) },
    })),
  }]

  // Add tool results — match by index (not name) to handle duplicate tool calls
  for (let i = 0; i < results.length; i++) {
    const tc = assistantToolCalls[i]
    updated.push({
      role: 'tool' as const,
      content: results[i].result,
      tool_call_id: tc?.id || results[i].name,
    })
  }

  return updated
}
