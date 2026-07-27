/**
 * Normalização de imagem OUTBOUND para envio via UAZAPI.
 *
 * CONTEXTO (auditoria 2026-06-09): esta instância UAZAPI transcodifica TODA
 * imagem para JPEG e NÃO decodifica HEIC/HEIF (foto padrão de iPhone e de
 * Android em modo "alta eficiência"/HEIF). Enviar HEIC resulta em HTTP 500
 * `failed to convert image to JPEG: failed to decode image: unsupported image
 * format` — comprovado em teste ao vivo. JPEG/PNG/WEBP/GIF de qualquer tamanho
 * (testado até 17,6MB) são aceitos e entregues.
 *
 * Solução na FONTE: garantir que o que sobe ao Storage (e vai como URL pro
 * UAZAPI) seja SEMPRE um formato decodificável. HEIC → converte p/ JPEG no
 * navegador (heic2any, import dinâmico — o wasm só baixa quando há HEIC).
 * Formato desconhecido com bytes decodificáveis pelo browser → re-encoda via
 * canvas. Caso contrário, lança erro amigável.
 *
 * Detecção por MAGIC BYTES (não por file.type/extensão): no mobile o
 * file.type vem vazio com frequência, então não dá pra confiar nele.
 */

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'heic' | 'avif' | 'bmp' | 'unknown';

/** Formatos que o UAZAPI decodifica sem conversão (comprovado ao vivo). */
const UAZAPI_SAFE: ReadonlyArray<ImageKind> = ['jpeg', 'png', 'gif', 'webp'];

/**
 * Marcas (brand) ISO-BMFF da família HEIC/HEIF. `mif1`/`msf1` são genéricos de
 * imagem ISO-BMFF e na prática chegam como HEIC do iOS/Android — o UAZAPI
 * também não os decodifica, então tratamos como "precisa converter".
 */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif']);

/**
 * Marcas ISO-BMFF de AVIF (foto de Android moderno/apps de edição). Auditoria
 * 2026-07-26: AVIF caía em 'unknown' e, com `file.type` vazio (mobile), a FOTO
 * era enviada como DOCUMENTO em silêncio — com toast de sucesso. O browser
 * decodifica AVIF nativamente (Chrome 85+/Safari 16.4+), então convertemos via
 * canvas como imagem.
 */
const AVIF_BRANDS = new Set(['avif', 'avis']);

export interface NormalizedImage {
  /** Arquivo a enviar (convertido p/ JPEG quando preciso). */
  file: File;
  /** Content-type a gravar no Storage (importa: o UAZAPI baixa do CDN). */
  contentType: string;
  /** Extensão coerente p/ a URL pública. */
  ext: string;
  /** true se houve conversão (HEIC/desconhecido → JPEG). */
  converted: boolean;
  /** true se a imagem foi reduzida (downscale ~2048px pré-upload). */
  downscaled: boolean;
  /** Formato originalmente detectado. */
  kind: ImageKind;
}

/** Erro lançado quando a imagem não é decodificável de jeito nenhum. */
export const UNSUPPORTED_IMAGE_FORMAT = 'UNSUPPORTED_IMAGE_FORMAT';

/**
 * Erros TIPADOS do caminho HEIC (auditoria 2026-06-09: aba que atravessa um
 * redeploy toma 404 no chunk lazy do heic2any; worker do heic2any morto por OOM
 * pendura a Promise pra sempre). Cada um vira mensagem própria no
 * `humanizeSendError` — antes era bolha genérica ou spinner infinito.
 */
export const CHUNK_LOAD_FAILED = 'CHUNK_LOAD_FAILED';
export const HEIC_CONVERSION_FAILED = 'HEIC_CONVERSION_FAILED';
export const HEIC_CONVERSION_TIMEOUT = 'HEIC_CONVERSION_TIMEOUT';

/** Teto da conversão HEIC→JPEG (asm.js em device fraco é lento; generoso de propósito). */
const HEIC_CONVERT_TIMEOUT_MS = 60_000;

/**
 * Teto de dimensão do re-encode via canvas. Foto de 50MP alocaria ~200MB de
 * pixels e mata aba de celular de entrada; o WhatsApp recomprime pra ~1600px
 * de qualquer forma, então 4096px não perde nada na prática.
 */
const MAX_CANVAS_DIM = 4096;

/**
 * Downscale pré-upload (auditoria 2026-07-26, caso Alberto: JPEG de câmera com
 * 4,8MB subia INTEGRAL e estourava o teto de 120s em rede móvel). Acima de
 * 1MB, JPEG/PNG é redimensionado a ≤2048px e re-encodado a q0.85 — paridade
 * com o que o WhatsApp faria (~1600px) e ordem de grandeza a menos de upload.
 * GIF/WEBP ficam de fora (podem ser animados; downscale mataria a animação).
 */
const DOWNSCALE_THRESHOLD_BYTES = 1_000_000;
const DOWNSCALE_MAX_DIM = 2048;
const DOWNSCALE_QUALITY = 0.85;

/**
 * Teto de qualquer operação de canvas (decode+re-encode). Em browser real
 * load/error sempre dispara; o teto protege de ambiente patológico — e o
 * downscale NUNCA pode travar um envio que hoje funciona.
 */
const CANVAS_OP_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

/** Decide se vale re-encodar com downscale antes do upload (função PURA, testável). */
export function shouldDownscaleImage(kind: ImageKind, sizeBytes: number): boolean {
  return (kind === 'jpeg' || kind === 'png') && sizeBytes > DOWNSCALE_THRESHOLD_BYTES;
}

/**
 * Detecta o formato de imagem pelos magic bytes. Função PURA (testável sem
 * File/DOM): recebe os primeiros bytes do arquivo.
 */
export function detectImageKindFromBytes(b: Uint8Array): ImageKind {
  if (b.length < 12) return 'unknown';
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  // GIF: 47 49 46 38 ("GIF8")
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
  // WEBP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp';
  // BMP: "BM" (foto exportada por app antigo/Windows; browser decodifica nativo)
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  // HEIC/HEIF/AVIF (ISO-BMFF): bytes 4-7 = "ftyp", brand em 8-11
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return 'heic';
    if (AVIF_BRANDS.has(brand)) return 'avif';
  }
  return 'unknown';
}

/** Lê os primeiros `n` bytes do arquivo (com fallbacks p/ ambientes restritos). */
async function readHeadBytes(file: Blob, n: number): Promise<Uint8Array> {
  // Caminho preferido (browser): slice não carrega o arquivo inteiro.
  const part: Blob = typeof file.slice === 'function' ? file.slice(0, n) : file;
  if (typeof part.arrayBuffer === 'function') {
    return new Uint8Array(await part.arrayBuffer()).subarray(0, n);
  }
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer()).subarray(0, n);
  }
  // Fallback (ex.: jsdom): FileReader.
  return await new Promise<Uint8Array>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer).subarray(0, n));
    fr.onerror = () => reject(fr.error ?? new Error('FileReader falhou'));
    fr.readAsArrayBuffer(part);
  });
}

/** Lê os primeiros bytes do File e detecta o formato. */
export async function detectImageKind(file: File): Promise<ImageKind> {
  const head = await readHeadBytes(file, 16);
  return detectImageKindFromBytes(head);
}

export function isUazapiSafeImageKind(kind: ImageKind): boolean {
  return UAZAPI_SAFE.includes(kind);
}

/** Troca a extensão do nome do arquivo por .jpg. */
function toJpgName(name: string): string {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  return `${base || 'image'}.jpg`;
}

/**
 * Importa o heic2any (chunk lazy de ~1,3MB) com 1 retry e erro tipado.
 * O 404 pós-redeploy é recuperado pelo listener global de `vite:preloadError`
 * (reload); aqui o retry cobre falha transitória de rede móvel.
 */
async function importHeic2any(): Promise<(opts: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>> {
  try {
    return (await import('heic2any')).default;
  } catch {
    try {
      return (await import('heic2any')).default;
    } catch {
      throw new Error(CHUNK_LOAD_FAILED);
    }
  }
}

/**
 * Converte HEIC/HEIF → JPEG via heic2any, com TETO de tempo (o worker do
 * heic2any 0.0.4 não tem error-handler: se morre por OOM, a Promise nunca
 * resolve — sem o teto o atendente ficava com spinner infinito). Rejeições do
 * heic2any são objetos `{code, message}` (não Error) — normalizamos preservando
 * a message real pro humanizeSendError.
 */
async function heicToJpeg(file: File): Promise<Blob> {
  const heic2any = await importHeic2any();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(HEIC_CONVERSION_TIMEOUT)), HEIC_CONVERT_TIMEOUT_MS);
  });
  try {
    const out = await Promise.race([
      heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }),
      timeout,
    ]);
    return Array.isArray(out) ? out[0] : out;
  } catch (err) {
    if (err instanceof Error && (err.message === HEIC_CONVERSION_TIMEOUT || err.message === CHUNK_LOAD_FAILED)) {
      throw err;
    }
    const message = err instanceof Error
      ? err.message
      : (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string')
        ? (err as { message: string }).message
        : String(err);
    throw new Error(`${HEIC_CONVERSION_FAILED}: ${message}`);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Re-encoda qualquer imagem que o browser consiga decodificar → JPEG. */
function canvasToJpeg(file: Blob, quality = 0.92, maxDim = MAX_CANVAS_DIM): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        // Cap de dimensão: foto de câmera 50/108MP estoura memória de canvas em
        // celular de entrada (ImageData ≈ 4 bytes/pixel). Escala mantendo proporção.
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) {
          URL.revokeObjectURL(url);
          reject(new Error('canvas indisponível'));
          return;
        }
        // Fundo branco: JPEG não tem alpha — sem isso, PNG transparente vira preto.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob retornou null'))),
          'image/jpeg',
          quality,
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err instanceof Error ? err : new Error('falha no canvas'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('o navegador não decodificou a imagem'));
    };
    img.src = url;
  });
}

/**
 * Downscale BEST-EFFORT pré-upload: reduz a ≤2048px / JPEG q0.85. Qualquer
 * falha (decode, OOM, timeout) devolve o arquivo ORIGINAL — a otimização nunca
 * pode quebrar um envio que hoje funciona; e se o re-encode não reduzir
 * (imagem já otimizada), mantém o original também.
 */
async function tryDownscaleToJpeg(
  file: File,
  timeoutMs: number,
): Promise<{ file: File; downscaled: boolean }> {
  try {
    const jpeg = await withTimeout(
      canvasToJpeg(file, DOWNSCALE_QUALITY, DOWNSCALE_MAX_DIM),
      timeoutMs,
      'downscale timeout',
    );
    if (jpeg.size >= file.size) return { file, downscaled: false };
    return {
      file: new File([jpeg], toJpgName(file.name), { type: 'image/jpeg' }),
      downscaled: true,
    };
  } catch {
    return { file, downscaled: false };
  }
}

/**
 * Normaliza um arquivo de imagem para um formato que o UAZAPI aceite.
 * - JPEG/PNG grande (>1MB) → downscale ≤2048px/q0.85 (best-effort; original em falha).
 * - JPEG/PNG pequeno, WEBP/GIF → passa direto (sem reprocessar).
 * - HEIC/HEIF → converte p/ JPEG (heic2any) + downscale se o resultado for grande.
 * - AVIF/BMP/desconhecido decodificável pelo browser → re-encoda p/ JPEG (canvas).
 * - Caso contrário → lança `UNSUPPORTED_IMAGE_FORMAT`.
 *
 * Detecta o tipo por magic bytes; quando indeterminado, tenta o canvas.
 * `opts.canvasTimeoutMs` existe pra teste (jsdom não decodifica imagem).
 */
export async function normalizeImageForSend(
  file: File,
  opts?: { canvasTimeoutMs?: number },
): Promise<NormalizedImage> {
  const canvasTimeoutMs = opts?.canvasTimeoutMs ?? CANVAS_OP_TIMEOUT_MS;
  const kind = await detectImageKind(file);

  if (isUazapiSafeImageKind(kind)) {
    // Fix da classe timeout (2026-07-26): foto de câmera não sobe mais integral.
    if (shouldDownscaleImage(kind, file.size)) {
      const down = await tryDownscaleToJpeg(file, canvasTimeoutMs);
      if (down.downscaled) {
        return { file: down.file, contentType: 'image/jpeg', ext: 'jpg', converted: true, downscaled: true, kind };
      }
    }
    const ext = kind === 'jpeg' ? 'jpg' : kind;
    return { file, contentType: `image/${kind === 'jpeg' ? 'jpeg' : kind}`, ext, converted: false, downscaled: false, kind };
  }

  if (kind === 'heic') {
    let jpeg: Blob;
    try {
      jpeg = await heicToJpeg(file);
    } catch (heicErr) {
      // Fallback: Safari/iOS decodifica HEIC NATIVAMENTE no canvas — se o
      // heic2any falhou (chunk 404, worker morto, variante não suportada),
      // ainda dá pra converter sem a lib. No Chrome/Android o canvas também
      // falha → propaga o erro TIPADO original (mensagem acionável).
      try {
        jpeg = await canvasToJpeg(file);
      } catch {
        throw heicErr;
      }
    }
    // heic2any devolve JPEG em RESOLUÇÃO CHEIA (q0.92) — um HEIC de 12MP vira
    // 4-6MB e cai na MESMA classe de timeout do upload. Downscale best-effort.
    let outFile = new File([jpeg], toJpgName(file.name), { type: 'image/jpeg' });
    let downscaled = false;
    if (outFile.size > DOWNSCALE_THRESHOLD_BYTES) {
      const down = await tryDownscaleToJpeg(outFile, canvasTimeoutMs);
      outFile = down.file;
      downscaled = down.downscaled;
    }
    return { file: outFile, contentType: 'image/jpeg', ext: 'jpg', converted: true, downscaled, kind };
  }

  // AVIF/BMP/desconhecido: o browser pode decodificar nativamente (AVIF era o
  // buraco: virava DOCUMENTO em silêncio). Re-encoda direto no tamanho final
  // (2048px/q0.85 quando grande) — 1 encode só; se falhar, formato não suportado.
  try {
    const big = file.size > DOWNSCALE_THRESHOLD_BYTES;
    const jpeg = await withTimeout(
      canvasToJpeg(file, big ? DOWNSCALE_QUALITY : 0.92, big ? DOWNSCALE_MAX_DIM : MAX_CANVAS_DIM),
      canvasTimeoutMs,
      'canvas convert timeout',
    );
    return {
      file: new File([jpeg], toJpgName(file.name), { type: 'image/jpeg' }),
      contentType: 'image/jpeg',
      ext: 'jpg',
      converted: true,
      downscaled: big,
      kind,
    };
  } catch {
    throw new Error(UNSUPPORTED_IMAGE_FORMAT);
  }
}
