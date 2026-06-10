import { supabase } from '@/integrations/supabase/client';
import { detectImageKind, normalizeImageForSend } from '@/lib/normalizeOutboundImage';

/**
 * Sobe um arquivo de mídia OUTBOUND pro Storage e devolve a URL pública, para o
 * UAZAPI baixar do CDN.
 *
 * NUNCA envie mídia como base64: esta instância UAZAPI rejeita imagem base64 no
 * `/send/media` ("failed to decode image: unsupported image format"); a URL
 * pública é aceita e entregue (ver v7.71.4 / `useSendFile`). Reusa o bucket
 * público `helpdesk-media` (sem limite de tamanho).
 *
 * Imagens são NORMALIZADAS antes do upload (HEIC/HEIF → JPEG; ver
 * `normalizeImageForSend`): o UAZAPI não decodifica HEIC.
 *
 * @param file       arquivo selecionado pelo usuário.
 * @param pathPrefix pasta lógica por origem (ex.: 'group', 'lead', 'broadcast').
 * @returns URL pública do arquivo no Storage.
 */
export async function uploadOutboundMedia(file: File, pathPrefix = 'outbound'): Promise<string> {
  // Decide imagem por magic bytes (file.type vem vazio no mobile).
  const kind = await detectImageKind(file);
  const isImage = kind !== 'unknown' || file.type.startsWith('image/');

  let uploadFile = file;
  let contentType: string;
  let ext: string;
  if (isImage) {
    const norm = await normalizeImageForSend(file);
    uploadFile = norm.file;
    contentType = norm.contentType;
    ext = norm.ext;
  } else {
    contentType = file.type || 'application/octet-stream';
    const extFromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    const extFromType = contentType.split('/')[1]?.split(';')[0];
    ext = extFromName || extFromType || 'bin';
  }
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Teto de wall-clock no upload (anti sessão-zumbi — mesmo padrão do
  // useSendFile): o supabase-js resolve getSession() antes do fetch e podia
  // pendurar indefinidamente em aba mobile retomada.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('upload timeout: o envio demorou demais (conexão ou sessão)')),
      120_000,
    );
  });
  try {
    const { error } = await Promise.race([
      supabase.storage.from('helpdesk-media').upload(path, uploadFile, { contentType }),
      timeout,
    ]);
    if (error) throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const { data } = supabase.storage.from('helpdesk-media').getPublicUrl(path);
  return data.publicUrl;
}
