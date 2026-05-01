// Avatar storage helper — baixa foto do CDN do WhatsApp e armazena em
// Storage bucket público `contact-avatars`. Resolve 403 do `pps.whatsapp.net`
// (URLs assinadas que expiram em ~24h).
//
// Fluxo de syncContactAvatar():
//   1. GET UAZAPI /contact/getProfilePic → URL pps.whatsapp.net
//   2. fetch binário (timeout 5s, max 1 MB)
//   3. upload Storage como {contact_id}.jpg
//   4. UPDATE contacts SET profile_pic_url=<public_url>, profile_pic_storage_path, profile_pic_synced_at
//
// Pontos de chamada:
//   - whatsapp-webhook (async, fire-and-forget — não bloqueia mensagem)
//   - sync-conversations (loop de bulk import)
//   - refresh-avatar (edge function chamada pelo frontend on demand)

import { fetchWithTimeout } from './fetchWithTimeout.ts'

export const AVATAR_BUCKET = 'contact-avatars'
const MAX_AVATAR_BYTES = 1_048_576 // 1 MB
const FETCH_TIMEOUT_MS = 5000

interface SupabaseLike {
  from: (table: string) => any
  storage: { from: (bucket: string) => any }
}

interface SyncResult {
  ok: boolean
  url?: string
  storagePath?: string
  reason?: string
}

/** Detecta URL assinada do WhatsApp CDN (que expira). */
export function isWhatsAppCdnUrl(url: string | null | undefined): boolean {
  return !!url && url.includes('pps.whatsapp.net')
}

/** Extrai URL de profile pic da resposta inconsistente da UAZAPI. */
export function extractProfilePicUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const url = d.profilePicUrl ?? d.imgUrl ?? d.url ?? d.eurl
  return typeof url === 'string' && url.startsWith('http') ? url : null
}

/** Detecta mime-type a partir do magic number do binário. */
export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  // WEBP: RIFF....WEBP
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Faz fetch da UAZAPI /contact/getProfilePic e devolve a URL nova (pps.whatsapp.net).
 * Retorna null se contato não tem foto, instância sem token, ou erro de rede.
 */
export async function fetchProfilePicUrlFromUazapi(
  uazapiServerUrl: string,
  instanceToken: string,
  contactJid: string,
): Promise<string | null> {
  if (!uazapiServerUrl || !instanceToken || !contactJid) return null
  try {
    const res = await fetchWithTimeout(`${uazapiServerUrl}/contact/getProfilePic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: instanceToken },
      body: JSON.stringify({ id: contactJid }),
    }, FETCH_TIMEOUT_MS)
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return extractProfilePicUrl(data)
  } catch {
    return null
  }
}

/**
 * Baixa o binário da URL e devolve {bytes, mime}. Aborta se >1 MB ou tipo inválido.
 */
export async function downloadAvatar(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS)
    if (!res.ok) return null
    const contentLength = Number(res.headers.get('content-length') || '0')
    if (contentLength > MAX_AVATAR_BYTES) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_AVATAR_BYTES) return null
    const mime = detectImageMime(buf)
    if (!mime) return null
    return { bytes: buf, mime }
  } catch {
    return null
  }
}

/**
 * Sobe o binário no bucket contact-avatars e devolve {publicUrl, path}.
 */
export async function uploadAvatarToStorage(
  supabase: SupabaseLike,
  contactId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<{ publicUrl: string; path: string } | null> {
  const path = `${contactId}.${extFromMime(mime)}`
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
    cacheControl: '604800', // 7 dias — foto raramente muda
  })
  if (upErr) return null
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const publicUrl = (data?.publicUrl as string) ?? null
  if (!publicUrl) return null
  return { publicUrl, path }
}

/**
 * Pipeline completo: UAZAPI → download → upload → UPDATE contacts.
 * Usado pelo webhook (async, não bloqueia), sync-conversations e refresh-avatar.
 *
 * Pode receber `existingUrl` se a chamada original já tem a URL pps.whatsapp.net
 * (ex: webhook recebe `chat.imagePreview`) — pula a chamada UAZAPI.
 */
export async function syncContactAvatar(opts: {
  supabase: SupabaseLike
  contactId: string
  contactJid: string
  uazapiServerUrl?: string
  instanceToken?: string
  existingUrl?: string | null
}): Promise<SyncResult> {
  const { supabase, contactId, contactJid, uazapiServerUrl, instanceToken, existingUrl } = opts

  let cdnUrl: string | null = existingUrl && existingUrl.startsWith('http') ? existingUrl : null
  if (!cdnUrl) {
    if (!uazapiServerUrl || !instanceToken) return { ok: false, reason: 'no_token' }
    cdnUrl = await fetchProfilePicUrlFromUazapi(uazapiServerUrl, instanceToken, contactJid)
  }
  if (!cdnUrl) return { ok: false, reason: 'no_url' }

  const downloaded = await downloadAvatar(cdnUrl)
  if (!downloaded) return { ok: false, reason: 'download_failed' }

  const uploaded = await uploadAvatarToStorage(supabase, contactId, downloaded.bytes, downloaded.mime)
  if (!uploaded) return { ok: false, reason: 'upload_failed' }

  const { error: updErr } = await supabase
    .from('contacts')
    .update({
      profile_pic_url: uploaded.publicUrl,
      profile_pic_storage_path: uploaded.path,
      profile_pic_synced_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  if (updErr) return { ok: false, reason: 'db_update_failed' }
  return { ok: true, url: uploaded.publicUrl, storagePath: uploaded.path }
}
