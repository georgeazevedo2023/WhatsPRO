/**
 * TTS Provider Chain — Gemini → Cartesia → Murf → Speechify → text fallback
 *
 * Each provider returns WAV/audio bytes as base64 string, or null on failure.
 * The chain tries each provider in order until one succeeds.
 */

import { fetchWithTimeout } from './fetchWithTimeout.ts'
import { createLogger } from './logger.ts'

const log = createLogger('tts-providers')

export interface TtsResult {
  audioBase64: string  // base64-encoded audio (WAV or MP3)
  provider: string
  latencyMs: number
}

// ── Gemini TTS (primary) ────────────────────────────────────────────

async function geminiTts(text: string, voiceName: string): Promise<string | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return null

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent'
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `Leia o seguinte texto em português brasileiro com tom natural e amigável: "${text}"` }] }],
      generationConfig: {
        response_modalities: ['AUDIO'],
        speech_config: { voice_config: { prebuilt_voice_config: { voice_name: voiceName || 'Kore' } } },
      },
    }),
  }, 8000)

  if (!res.ok) { log.warn('Gemini TTS failed', { status: res.status }); return null }
  const data = await res.json()
  const audioPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
  if (!audioPart?.inlineData?.data) return null

  // Convert PCM to WAV
  const pcmBytes = Uint8Array.from(atob(audioPart.inlineData.data), c => c.charCodeAt(0))
  return pcmToWavBase64(pcmBytes, 24000)
}

// ── Cartesia TTS ────────────────────────────────────────────────────

async function cartesiaTts(text: string): Promise<string | null> {
  const apiKey = Deno.env.get('CARTESIA_API_KEY')
  if (!apiKey) return null

  const res = await fetchWithTimeout('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2025-04-16',
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-3',
      transcript: text,
      voice: { mode: 'id', id: '2f4d204f-a5dc-4196-81bc-155986b76ab6' }, // PT-BR voice
      output_format: { container: 'wav', encoding: 'pcm_f32le', sample_rate: 44100 },
      language: 'pt',
      speed: 'normal',
    }),
  }, 8000)

  if (!res.ok) { log.warn('Cartesia TTS failed', { status: res.status }); return null }

  const arrayBuf = await res.arrayBuffer()
  const bytes = new Uint8Array(arrayBuf)
  // Already WAV, just base64 encode
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)))
  }
  return btoa(bin)
}

// ── Murf TTS ────────────────────────────────────────────────────────

async function murfTts(text: string): Promise<string | null> {
  const apiKey = Deno.env.get('MURF_API_KEY')
  if (!apiKey) return null

  const res = await fetchWithTimeout('https://api.murf.ai/v1/speech/stream', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceId: 'pt-BR-francisca', // Brazilian Portuguese female
      format: 'WAV',
      sampleRate: 24000,
    }),
  }, 8000)

  if (!res.ok) { log.warn('Murf TTS failed', { status: res.status }); return null }

  const arrayBuf = await res.arrayBuffer()
  const bytes = new Uint8Array(arrayBuf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)))
  }
  return btoa(bin)
}

// ── Speechify TTS ───────────────────────────────────────────────────

async function speechifyTts(text: string): Promise<string | null> {
  const apiKey = Deno.env.get('SPEECHIFY_API_KEY')
  if (!apiKey) return null

  const res = await fetchWithTimeout('https://api.sws.speechify.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: `<speak>${text}</speak>`,
      voice_id: 'george', // Speechify PT-BR voice
      audio_format: 'wav',
    }),
  }, 8000)

  if (!res.ok) { log.warn('Speechify TTS failed', { status: res.status }); return null }

  const data = await res.json()
  if (!data?.audio_data) return null
  return data.audio_data // already base64
}

// ── Chain ────────────────────────────────────────────────────────────

const PROVIDERS: Record<string, (text: string, voiceName: string) => Promise<string | null>> = {
  gemini: geminiTts,
  cartesia: (text) => cartesiaTts(text),
  murf: (text) => murfTts(text),
  speechify: (text) => speechifyTts(text),
}

/**
 * Try TTS providers in order. Returns audio base64 or null.
 * @param text Text to synthesize
 * @param voiceName Gemini voice name (only used for Gemini provider)
 * @param providerChain Provider names in order: ['gemini','cartesia','murf','speechify']
 */
export async function ttsWithFallback(
  text: string,
  voiceName: string,
  providerChain: string[] = ['gemini', 'cartesia', 'murf', 'speechify'],
): Promise<TtsResult | null> {
  for (const providerName of providerChain) {
    const fn = PROVIDERS[providerName]
    if (!fn) continue

    const startMs = Date.now()
    try {
      const result = await fn(text, voiceName)
      if (result) {
        const latencyMs = Date.now() - startMs
        log.info('TTS success', { provider: providerName, chars: text.length, latencyMs })
        return { audioBase64: result, provider: providerName, latencyMs }
      }
    } catch (err) {
      log.warn('TTS provider error', { provider: providerName, error: (err as Error).message })
    }
  }

  log.warn('All TTS providers failed', { chain: providerChain.join('→'), chars: text.length })
  return null
}

// ── Utils ────────────────────────────────────────────────────────────

function pcmToWavBase64(pcmBytes: Uint8Array, sampleRate: number): string {
  const wavHeader = new ArrayBuffer(44)
  const view = new DataView(wavHeader)
  const ch = 1, bps = 16
  view.setUint32(0, 0x52494646, false)
  view.setUint32(4, 36 + pcmBytes.length, true)
  view.setUint32(8, 0x57415645, false)
  view.setUint32(12, 0x666D7420, false)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, ch, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * ch * (bps / 8), true)
  view.setUint16(32, ch * (bps / 8), true)
  view.setUint16(34, bps, true)
  view.setUint32(36, 0x64617461, false)
  view.setUint32(40, pcmBytes.length, true)
  const wavBytes = new Uint8Array(44 + pcmBytes.length)
  wavBytes.set(new Uint8Array(wavHeader), 0)
  wavBytes.set(pcmBytes, 44)
  let bin = ''
  for (let i = 0; i < wavBytes.length; i += 8192) {
    bin += String.fromCharCode(...wavBytes.subarray(i, Math.min(i + 8192, wavBytes.length)))
  }
  return btoa(bin)
}

/**
 * Split text into audio summary (first sentence) + full text detail.
 * Used when response exceeds TTS max length.
 */
export function splitAudioAndText(text: string, maxAudioChars: number): { audioText: string; fullText: string } | null {
  if (text.length <= maxAudioChars) return null // no split needed

  // Find first sentence break
  const sentenceEnd = text.search(/[.!]\s/)
  if (sentenceEnd > 0 && sentenceEnd <= maxAudioChars) {
    return {
      audioText: text.substring(0, sentenceEnd + 1).trim(),
      fullText: text,
    }
  }

  // Fallback: cut at maxAudioChars at word boundary
  const cutPoint = text.lastIndexOf(' ', maxAudioChars)
  if (cutPoint > 20) {
    return {
      audioText: text.substring(0, cutPoint).trim() + '...',
      fullText: text,
    }
  }

  return null // can't split meaningfully
}
