import { UNSUPPORTED_IMAGE_FORMAT } from '@/lib/normalizeOutboundImage';

/**
 * Traduz o erro cru de envio de mídia (UAZAPI/proxy/normalização) numa mensagem
 * em pt-BR ACIONÁVEL pro atendente. Antes a string técnica em inglês
 * ("failed to decode image: unsupported image format", "...timed out after
 * 30000ms") vazava crua no toast — sem dizer que o problema é FORMATO/TAMANHO.
 */
export function humanizeSendError(raw: unknown, opts: { isImage: boolean } = { isImage: false }): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  const lower = msg.toLowerCase();
  const noun = opts.isImage ? 'a imagem' : 'o arquivo';

  // Formato não decodificável (HEIC cru, arquivo corrompido, etc.)
  if (msg.includes(UNSUPPORTED_IMAGE_FORMAT) || /unsupported image format|failed to decode|failed to convert|decode image/.test(lower)) {
    return 'Não consegui enviar essa foto: o formato não é suportado pelo WhatsApp. Tente reenviar como JPEG (ou tire um print da imagem).';
  }
  // Timeout (envio demorou demais — arquivo grande/rede lenta)
  if (/timed out|timeout|aborterror|demorou/.test(lower)) {
    return `O envio de ${noun} demorou demais. Tente uma versão menor ou tente de novo em instantes.`;
  }
  // Tamanho acima do limite
  if (/too large|exceed|maximum|máximo|payload|413|file size/.test(lower)) {
    return `${opts.isImage ? 'A imagem' : 'O arquivo'} é grande demais. Reduza o tamanho e tente de novo.`;
  }
  // WhatsApp recusou a mídia (502 do proxy) / não confirmou
  if (/não confirmou|502|recusou|media|whatsapp/.test(lower)) {
    return `O WhatsApp não confirmou o envio de ${noun}. Verifique a conexão da instância e tente de novo.`;
  }
  // Fallback: mensagem genérica clara (nunca a string técnica crua)
  return opts.isImage ? 'Não foi possível enviar a imagem. Tente de novo.' : 'Não foi possível enviar o arquivo. Tente de novo.';
}
