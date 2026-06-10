import {
  UNSUPPORTED_IMAGE_FORMAT,
  CHUNK_LOAD_FAILED,
  HEIC_CONVERSION_FAILED,
  HEIC_CONVERSION_TIMEOUT,
} from '@/lib/normalizeOutboundImage';

/**
 * Traduz o erro cru de envio de mídia (UAZAPI/proxy/normalização) numa mensagem
 * em pt-BR ACIONÁVEL pro atendente. Antes a string técnica em inglês
 * ("failed to decode image: unsupported image format", "...timed out after
 * 30000ms") vazava crua no toast — sem dizer que o problema é FORMATO/TAMANHO.
 *
 * Auditoria 2026-06-09 (vendedores Android sem conseguir enviar foto): cobre
 * também os modos de falha reais que caíam na mensagem genérica — chunk lazy
 * 404 pós-redeploy ("Failed to fetch dynamically imported module"), erros do
 * heic2any (ERR_LIBHEIF / "Cannot enlarge memory arrays"), sessão expirada e
 * "mídia" COM acento (a regex antiga só casava "media").
 */
export function humanizeSendError(raw: unknown, opts: { isImage: boolean } = { isImage: false }): string {
  // heic2any rejeita com objetos {code, message} (não Error) — extrai a message real.
  const msg = raw instanceof Error
    ? raw.message
    : typeof raw === 'string'
      ? raw
      : (raw && typeof raw === 'object' && typeof (raw as { message?: unknown }).message === 'string')
        ? (raw as { message: string }).message
        : '';
  const lower = msg.toLowerCase();
  const noun = opts.isImage ? 'a imagem' : 'o arquivo';

  // Chunk lazy sumiu (deploy no meio da sessão) — a aba está rodando versão velha.
  if (
    msg.includes(CHUNK_LOAD_FAILED) ||
    /failed to fetch dynamically imported|importing a module script failed|error loading dynamically imported|chunkloaderror/.test(lower)
  ) {
    return 'O sistema foi atualizado enquanto esta aba estava aberta. Recarregue a página e tente de novo.';
  }
  // Sessão expirada/inválida (upload ou INSERT recusado por auth/RLS)
  if (/sessão expirada|jwt expired|invalid claim|refresh token|row-level security|not authenticated/.test(lower)) {
    return 'Sua sessão expirou. Recarregue a página e, se preciso, faça login de novo.';
  }
  // Conversão HEIC falhou (lib não converteu / worker morreu / demorou demais)
  if (
    msg.includes(HEIC_CONVERSION_FAILED) || msg.includes(HEIC_CONVERSION_TIMEOUT) ||
    /err_libheif|format not supported|cannot enlarge memory|err_user|err_dom/.test(lower)
  ) {
    return 'Não consegui converter essa foto (formato HEIC do celular). Tire um print da imagem e envie o print — ou envie como JPEG.';
  }
  // Formato não decodificável (HEIC cru, arquivo corrompido, etc.)
  if (msg.includes(UNSUPPORTED_IMAGE_FORMAT) || /unsupported image format|failed to decode|failed to convert|decode image/.test(lower)) {
    return 'Não consegui enviar essa foto: o formato não é suportado pelo WhatsApp. Tente reenviar como JPEG (ou tire um print da imagem).';
  }
  // Timeout (envio demorou demais — arquivo grande/rede lenta/sessão presa)
  if (/timed out|timeout|aborterror|demorou/.test(lower)) {
    return `O envio de ${noun} demorou demais. Verifique a conexão, tente uma versão menor ou tente de novo em instantes.`;
  }
  // Tamanho acima do limite
  if (/too large|exceed|maximum|máximo|payload|413|file size/.test(lower)) {
    return `${opts.isImage ? 'A imagem' : 'O arquivo'} é grande demais. Reduza o tamanho e tente de novo.`;
  }
  // Foto "na nuvem" (Google Fotos cloud-only chega com 0 bytes)
  if (/arquivo vazio|empty file|0 bytes/.test(lower)) {
    return 'Essa foto parece estar só na nuvem (Google Fotos). Abra a foto no aparelho primeiro e tente de novo.';
  }
  // WhatsApp recusou a mídia (502 do proxy) / não confirmou
  if (/não confirmou|502|recusou|media|mídia|midia|whatsapp/.test(lower)) {
    return `O WhatsApp não confirmou o envio de ${noun}. Verifique a conexão da instância e tente de novo.`;
  }
  // Fallback: mensagem genérica clara (nunca a string técnica crua)
  return opts.isImage ? 'Não foi possível enviar a imagem. Tente de novo.' : 'Não foi possível enviar o arquivo. Tente de novo.';
}
