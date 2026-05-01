import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isWhatsAppCdnUrl,
  extractProfilePicUrl,
  detectImageMime,
  fetchProfilePicUrlFromUazapi,
  downloadAvatar,
  uploadAvatarToStorage,
  syncContactAvatar,
} from '../avatarStorage.ts'

const ORIGINAL_FETCH = globalThis.fetch

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = ORIGINAL_FETCH
})

describe('isWhatsAppCdnUrl', () => {
  it('detects pps.whatsapp.net', () => {
    expect(isWhatsAppCdnUrl('https://pps.whatsapp.net/v/t61.24694-24/abc.jpg')).toBe(true)
  })
  it('returns false for our Storage URL', () => {
    expect(isWhatsAppCdnUrl('https://xxx.supabase.co/storage/v1/object/public/contact-avatars/abc.jpg')).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(isWhatsAppCdnUrl(null)).toBe(false)
    expect(isWhatsAppCdnUrl(undefined)).toBe(false)
    expect(isWhatsAppCdnUrl('')).toBe(false)
  })
})

describe('extractProfilePicUrl', () => {
  it('reads profilePicUrl', () => {
    expect(extractProfilePicUrl({ profilePicUrl: 'https://x.com/a.jpg' })).toBe('https://x.com/a.jpg')
  })
  it('falls back to imgUrl/url/eurl', () => {
    expect(extractProfilePicUrl({ imgUrl: 'https://x.com/b.jpg' })).toBe('https://x.com/b.jpg')
    expect(extractProfilePicUrl({ url: 'https://x.com/c.jpg' })).toBe('https://x.com/c.jpg')
    expect(extractProfilePicUrl({ eurl: 'https://x.com/d.jpg' })).toBe('https://x.com/d.jpg')
  })
  it('rejects non-http strings', () => {
    expect(extractProfilePicUrl({ profilePicUrl: 'ftp://x.com/a.jpg' })).toBe(null)
    expect(extractProfilePicUrl({ profilePicUrl: 'not-a-url' })).toBe(null)
  })
  it('handles null/undefined/non-object', () => {
    expect(extractProfilePicUrl(null)).toBe(null)
    expect(extractProfilePicUrl(undefined)).toBe(null)
    expect(extractProfilePicUrl('string')).toBe(null)
  })
})

describe('detectImageMime', () => {
  it('detects JPEG', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])
    expect(detectImageMime(jpeg)).toBe('image/jpeg')
  })
  it('detects PNG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(detectImageMime(png)).toBe('image/png')
  })
  it('detects WEBP', () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ])
    expect(detectImageMime(webp)).toBe('image/webp')
  })
  it('returns null for unknown bytes', () => {
    expect(detectImageMime(new Uint8Array([0x00, 0x00]))).toBe(null)
    expect(detectImageMime(new Uint8Array([]))).toBe(null)
  })
})

describe('fetchProfilePicUrlFromUazapi', () => {
  it('returns URL on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profilePicUrl: 'https://pps.whatsapp.net/v/x.jpg' }),
    } as Response)
    const url = await fetchProfilePicUrlFromUazapi('https://wsmart.uazapi.com', 'tok', '5511@s.whatsapp.net')
    expect(url).toBe('https://pps.whatsapp.net/v/x.jpg')
  })
  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } as Response)
    expect(await fetchProfilePicUrlFromUazapi('https://x.com', 'tok', 'jid')).toBe(null)
  })
  it('returns null on missing args', async () => {
    expect(await fetchProfilePicUrlFromUazapi('', 'tok', 'jid')).toBe(null)
    expect(await fetchProfilePicUrlFromUazapi('https://x.com', '', 'jid')).toBe(null)
    expect(await fetchProfilePicUrlFromUazapi('https://x.com', 'tok', '')).toBe(null)
  })
  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    expect(await fetchProfilePicUrlFromUazapi('https://x.com', 'tok', 'jid')).toBe(null)
  })
})

describe('downloadAvatar', () => {
  it('returns bytes + jpeg mime when ok', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '6' },
      arrayBuffer: async () => jpegBytes.buffer,
    } as unknown as Response)
    const result = await downloadAvatar('https://x.com/a.jpg')
    expect(result?.mime).toBe('image/jpeg')
    expect(result?.bytes.byteLength).toBe(6)
  })
  it('rejects payloads >1MB by content-length', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => String(2_000_000) },
      arrayBuffer: async () => new Uint8Array(0).buffer,
    } as unknown as Response)
    expect(await downloadAvatar('https://x.com/a.jpg')).toBe(null)
  })
  it('rejects empty body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '0' },
      arrayBuffer: async () => new Uint8Array(0).buffer,
    } as unknown as Response)
    expect(await downloadAvatar('https://x.com/a.jpg')).toBe(null)
  })
  it('rejects unknown mime (no magic match)', async () => {
    const trash = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '4' },
      arrayBuffer: async () => trash.buffer,
    } as unknown as Response)
    expect(await downloadAvatar('https://x.com/a.bin')).toBe(null)
  })
  it('returns null on 4xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      headers: { get: () => '0' },
    } as unknown as Response)
    expect(await downloadAvatar('https://x.com/expired.jpg')).toBe(null)
  })
})

function buildSupabaseMock(opts: {
  uploadError?: unknown
  publicUrl?: string | null
  updateError?: unknown
} = {}) {
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ?? null })
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: opts.publicUrl === undefined ? 'https://x.supabase.co/storage/v1/object/public/contact-avatars/c1.jpg' : opts.publicUrl },
  })
  const eq = vi.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ update })
  const storageFrom = vi.fn().mockReturnValue({ upload, getPublicUrl })
  return {
    from,
    storage: { from: storageFrom },
    _spies: { upload, update, eq, getPublicUrl },
  }
}

describe('uploadAvatarToStorage', () => {
  it('uploads with correct path and returns publicUrl', async () => {
    const supabase = buildSupabaseMock()
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    const result = await uploadAvatarToStorage(supabase, 'c1', bytes, 'image/jpeg')
    expect(result?.path).toBe('c1.jpg')
    expect(result?.publicUrl).toContain('contact-avatars/c1.jpg')
    expect(supabase._spies.upload).toHaveBeenCalledWith('c1.jpg', bytes, expect.objectContaining({
      contentType: 'image/jpeg',
      upsert: true,
    }))
  })
  it('uses webp extension for image/webp', async () => {
    const supabase = buildSupabaseMock()
    const result = await uploadAvatarToStorage(supabase, 'c2', new Uint8Array([1]), 'image/webp')
    expect(result?.path).toBe('c2.webp')
  })
  it('returns null on upload error', async () => {
    const supabase = buildSupabaseMock({ uploadError: new Error('boom') })
    expect(await uploadAvatarToStorage(supabase, 'c3', new Uint8Array([1]), 'image/jpeg')).toBe(null)
  })
  it('returns null when publicUrl is missing', async () => {
    const supabase = buildSupabaseMock({ publicUrl: null })
    expect(await uploadAvatarToStorage(supabase, 'c4', new Uint8Array([1]), 'image/jpeg')).toBe(null)
  })
})

describe('syncContactAvatar', () => {
  it('returns no_token when missing UAZAPI args and no existingUrl', async () => {
    const supabase = buildSupabaseMock()
    const r = await syncContactAvatar({ supabase, contactId: 'c1', contactJid: 'jid' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no_token')
  })

  it('uses existingUrl when provided (skips UAZAPI call)', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '6' },
      arrayBuffer: async () => jpeg.buffer,
    } as unknown as Response)
    const supabase = buildSupabaseMock()
    const r = await syncContactAvatar({
      supabase,
      contactId: 'c1',
      contactJid: 'jid@s.whatsapp.net',
      existingUrl: 'https://pps.whatsapp.net/v/t61.24694-24/abc.jpg',
    })
    expect(r.ok).toBe(true)
    expect(r.url).toContain('contact-avatars/c1.jpg')
    expect(supabase._spies.update).toHaveBeenCalledWith(expect.objectContaining({
      profile_pic_storage_path: 'c1.jpg',
    }))
  })

  it('returns download_failed when fetch returns 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      headers: { get: () => '0' },
    } as unknown as Response)
    const supabase = buildSupabaseMock()
    const r = await syncContactAvatar({
      supabase,
      contactId: 'c1',
      contactJid: 'jid',
      existingUrl: 'https://pps.whatsapp.net/v/expired.jpg',
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('download_failed')
  })

  it('returns no_url when UAZAPI returns no profilePicUrl', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as unknown as Response)
    const supabase = buildSupabaseMock()
    const r = await syncContactAvatar({
      supabase,
      contactId: 'c1',
      contactJid: 'jid',
      uazapiServerUrl: 'https://wsmart.uazapi.com',
      instanceToken: 'tok',
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no_url')
  })

  it('full pipeline: UAZAPI → download → upload → DB update', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00])
    let call = 0
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      call++
      if (call === 1) {
        return { ok: true, json: async () => ({ profilePicUrl: 'https://pps.whatsapp.net/v/x.jpg' }) } as Response
      }
      return {
        ok: true,
        headers: { get: () => '7' },
        arrayBuffer: async () => jpeg.buffer,
      } as unknown as Response
    })
    const supabase = buildSupabaseMock()
    const r = await syncContactAvatar({
      supabase,
      contactId: 'c1',
      contactJid: 'jid',
      uazapiServerUrl: 'https://wsmart.uazapi.com',
      instanceToken: 'tok',
    })
    expect(r.ok).toBe(true)
    expect(call).toBe(2) // UAZAPI + download
  })
})
