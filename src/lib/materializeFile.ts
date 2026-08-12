/**
 * Materializa um File pra memória (snapshot único dos bytes).
 *
 * CONTEXTO (incidente 2026-08-12, moto g20 / APK WebView): o File que a câmera
 * do Android devolve via `<input capture>` é lastreado numa URI `content://`
 * cuja permissão de leitura é EFÊMERA — na prática, one-shot. O pipeline de
 * envio lia o arquivo mais de uma vez (magic bytes no useSendFile + de novo
 * dentro do normalizeImageForSend): a 2ª leitura morria com NotReadableError
 * ("permission problems... after a reference to a file was acquired") e o
 * "Tentar de novo" reusava o MESMO File morto — retry impossível por design.
 * O snapshot da v7.116 (useSendFile) acontecia DEPOIS do normalize: tarde.
 *
 * Solução na FONTE: ler TUDO pra memória na ENTRADA (onFileSelected), no único
 * momento em que a permissão está garantidamente viva. Todo o resto do
 * pipeline (detecção, downscale, upload, retry) lê a cópia em memória.
 *
 * Best-effort "nunca pior": falha/timeout devolve o File ORIGINAL — quem lê
 * depois falha com a mesma telemetria de antes. O teto de tempo existe porque
 * o stream de content:// também PENDURA (hang_timeout de 2026-08-11); o retry
 * curto cobre foto que a câmera ainda está terminando de gravar.
 */

/** Mesmo teto do envio (MAX_RAW_FILE_SIZE): acima disso o envio é rejeitado
 *  de qualquer forma — não vale alocar 50MB+ de RAM em celular de entrada. */
const MAX_MATERIALIZE_BYTES = 50 * 1024 * 1024;
const READ_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 300;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('materialize timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lê todos os bytes (fallback FileReader p/ ambientes sem Blob.arrayBuffer, ex.: jsdom). */
function readAllBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error ?? new Error('FileReader falhou'));
    fr.readAsArrayBuffer(file);
  });
}

export async function materializeFile(
  file: File,
  opts?: { timeoutMs?: number; retryDelayMs?: number },
): Promise<File> {
  const timeoutMs = opts?.timeoutMs ?? READ_TIMEOUT_MS;
  const retryDelayMs = opts?.retryDelayMs ?? RETRY_DELAY_MS;
  if (file.size === 0 || file.size > MAX_MATERIALIZE_BYTES) return file;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const buf = await withTimeout(readAllBytes(file), timeoutMs);
      return new File([buf], file.name, { type: file.type, lastModified: file.lastModified });
    } catch {
      if (attempt === 0) await sleep(retryDelayMs);
    }
  }
  return file;
}
