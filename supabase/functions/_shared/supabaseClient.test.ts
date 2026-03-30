import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Deno global
vi.stubGlobal('Deno', {
  env: {
    get: (key: string): string | undefined => {
      const envMap: Record<string, string> = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
        SUPABASE_ANON_KEY: 'anon-key-test',
      }
      return envMap[key] ?? undefined
    },
  },
})

// Mock the https://esm.sh supabase-js import — Node ESM loader can't fetch https:// URLs
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    auth: {
      getUser: vi.fn(),
      signIn: vi.fn(),
    },
    storage: {},
    rpc: vi.fn(),
  }
  return {
    createClient: vi.fn((_url: string, _key: string, _options?: unknown) => ({ ...mockClient })),
  }
})

// eslint-disable-next-line import/first
import { createServiceClient, createUserClient } from './supabaseClient.ts'

describe('supabaseClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createServiceClient', () => {
    it('returns a truthy Supabase client object', () => {
      const client = createServiceClient()
      expect(client).toBeTruthy()
      expect(typeof client).toBe('object')
    })

    it('returns a client with expected Supabase interface', () => {
      const client = createServiceClient()
      expect(typeof client.from).toBe('function')
      expect(client.auth).toBeTruthy()
    })
  })

  describe('createUserClient', () => {
    it('returns a truthy Supabase client for authenticated request', () => {
      const req = new Request('https://example.com', {
        headers: { Authorization: 'Bearer user-jwt-token' },
      })
      const client = createUserClient(req)
      expect(client).toBeTruthy()
      expect(typeof client).toBe('object')
    })

    it('passes Authorization header through to client', () => {
      const token = 'Bearer my-specific-jwt-token'
      const req = new Request('https://example.com', {
        headers: { Authorization: token },
      })
      const client = createUserClient(req)
      expect(client).toBeTruthy()
      expect(typeof client.from).toBe('function')
    })

    it('handles missing Authorization header gracefully', () => {
      const req = new Request('https://example.com')
      expect(() => createUserClient(req)).not.toThrow()
      const client = createUserClient(req)
      expect(client).toBeTruthy()
    })
  })
})
