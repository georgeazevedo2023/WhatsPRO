// =============================================================================
// sendWhatsApp.ts — helper compartilhado pra enviar mensagem de texto via UAZAPI
//
// Usado por:
//   - whatsapp-webhook/index.ts (auto-resposta no handshake do vendedor)
//   - notify-vendor-assignment/index.ts (notif de handoff)
//
// UAZAPI endpoint: POST {UAZAPI_SERVER_URL}/send/text
// Header: token: {instance_token}
// =============================================================================

import { fetchWithTimeout } from './fetchWithTimeout.ts'

export interface SendWhatsAppResult {
  ok: boolean
  message_id?: string
  error?: string
  status_code?: number
}

/**
 * Envia mensagem de texto simples via UAZAPI.
 *
 * @param instance_token Token da instância UAZAPI (de `instances.token`).
 * @param to_phone Número destino. Pode vir como `+5511987654321` (E.164) ou
 *                 `5511987654321@s.whatsapp.net`. Normaliza pra dígitos puros.
 * @param text Texto da mensagem (suporta emojis e quebras de linha).
 * @returns ok=true + message_id, ou ok=false + error.
 */
export async function sendUazapiText(
  instance_token: string,
  to_phone: string,
  text: string,
): Promise<SendWhatsAppResult> {
  if (!instance_token) {
    return { ok: false, error: 'missing_instance_token' }
  }
  if (!to_phone || !text) {
    return { ok: false, error: 'missing_to_or_text' }
  }

  // Normaliza número: remove +, @s.whatsapp.net, qualquer não-dígito.
  const number = to_phone
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/[^\d]/g, '')

  if (number.length < 10 || number.length > 15) {
    return { ok: false, error: 'invalid_phone_format' }
  }

  // @ts-ignore — Deno global
  const uazapiUrl = (typeof Deno !== 'undefined'
    ? Deno.env.get('UAZAPI_SERVER_URL')
    : null) || 'https://wsmart.uazapi.com'

  try {
    const response = await fetchWithTimeout(`${uazapiUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instance_token,
      },
      body: JSON.stringify({
        number,
        text,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        ok: false,
        status_code: response.status,
        error: `uazapi_http_${response.status}: ${body.substring(0, 200)}`,
      }
    }

    const data = await response.json().catch(() => null) as {
      messageid?: string
      id?: string
      error?: string
    } | null

    if (data?.error) {
      return { ok: false, error: `uazapi_error: ${data.error}` }
    }

    return {
      ok: true,
      message_id: data?.messageid || data?.id,
    }
  } catch (err) {
    return {
      ok: false,
      error: `network_error: ${(err as Error).message}`,
    }
  }
}
