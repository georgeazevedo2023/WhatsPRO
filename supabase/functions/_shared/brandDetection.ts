/**
 * Detect brand mentions from lead message text.
 *
 * Strategy: cross-reference text against a list of known brands. Match is
 * substring-based (case-insensitive, accent-insensitive) with word boundaries
 * adapted for non-ASCII chars.
 *
 * Used in the AI Agent to tag conversation with `marca_citada:NOME` so the
 * manager dashboard can rank top brands customers ask about (drives stocking
 * decisions).
 *
 * The brand list is intentionally a function parameter so the agent can pass
 * its own dynamic list (from agent.known_brands) without recompiling. A
 * fallback DEFAULT_BRANDS export covers the most common Brazilian construction
 * material brands.
 */
export const DEFAULT_BRANDS: string[] = [
  // Tintas
  'coral', 'suvinil', 'sherwin williams', 'sherwin-williams', 'lukscolor',
  'iquine', 'eucatex', 'renner', 'sayerlack', 'tintas mc',
  // Hidráulica / impermeabilizantes
  'tigre', 'amanco', 'fortlev', 'krona', 'quartzolit', 'weber', 'denver',
  'sika', 'vedacit', 'otto baumgart',
  // Elétrica / iluminação
  'tramontina', 'pial', 'siemens', 'wetzel', 'philips', 'osram', 'avant',
  // Ferragens / fechaduras
  'la fonte', 'lafonte', 'pado', 'aliança', 'alianca', 'soprano',
  // Telhas / cobertura
  'eternit', 'brasilit', 'tegassol', 'imbralit',
  // Cubas / sanitário
  'deca', 'celite', 'roca', 'incepa',
  // Argamassas / cimento
  'votoran', 'tigre cement', 'mix', 'votorantim',
]

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', ã: 'a', â: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', õ: 'o', ô: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, ch => ACCENT_MAP[ch] || ch)
}

/**
 * Returns the canonical (slug-style) brand name when text mentions one of the brands.
 * - canonical = lowercase, accents stripped, spaces become underscores.
 * - Returns null if no brand matched.
 *
 * Match policy: requires the brand string to appear as a substring surrounded
 * by non-letter chars (or string boundaries). Avoids matching "coralina" as
 * "coral".
 */
export function detectBrand(text: string, brands: string[] = DEFAULT_BRANDS): string | null {
  if (!text) return null
  const lower = normalize(text)
  for (const brand of brands) {
    const norm = normalize(brand)
    // Use a non-letter boundary on both sides. Don't use \b because ASCII-only.
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(norm)}(?=[^a-z0-9]|$)`, 'i')
    if (pattern.test(lower)) {
      return norm.replace(/[\s-]+/g, '_')
    }
  }
  return null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
