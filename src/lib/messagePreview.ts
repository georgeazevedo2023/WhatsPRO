/**
 * Preview emoji + label para o `last_message` de uma conversa quando ela é mídia.
 * Usado no helpdesk (lista de conversas, broadcasts) e em saveToHelpdesk.
 *
 * Para texto, retorna string vazia — o caller deve usar `content` original.
 */
export function mediaPreview(mediaType: string | null | undefined): string {
  switch (mediaType) {
    case 'image': return '📷 Foto';
    case 'video': return '🎥 Vídeo';
    case 'audio': return '🎵 Áudio';
    case 'document': return '📎 Documento';
    case 'sticker': return '🌟 Figurinha';
    case 'carousel': return '🎠 Carrossel';
    case 'poll': return '📊 Enquete';
    case 'contact': return '👤 Contato';
    default: return '';
  }
}

/**
 * Resolve o `last_message` para uma conversa: usa o `content` se houver,
 * senão volta ao preview da mídia. Centraliza a lógica antes espalhada
 * por ChatInput, useSendFile, saveToHelpdesk.
 */
export function resolveLastMessage(
  content: string | null | undefined,
  mediaType: string | null | undefined,
): string {
  return content || mediaPreview(mediaType);
}
