import { supabase } from '@/integrations/supabase/client';

/**
 * Sobe um arquivo de mídia OUTBOUND pro Storage e devolve a URL pública, para o
 * UAZAPI baixar do CDN.
 *
 * NUNCA envie mídia como base64: esta instância UAZAPI rejeita imagem base64 no
 * `/send/media` ("failed to decode image: unsupported image format"); a URL
 * pública é aceita e entregue (ver v7.71.4 / `useSendFile`). Reusa o bucket
 * público `helpdesk-media` (sem limite de tamanho).
 *
 * @param file       arquivo selecionado pelo usuário.
 * @param pathPrefix pasta lógica por origem (ex.: 'group', 'lead', 'broadcast').
 * @returns URL pública do arquivo no Storage.
 */
export async function uploadOutboundMedia(file: File, pathPrefix = 'outbound'): Promise<string> {
  const isImage = file.type.startsWith('image/');
  // contentType/extensão robustos: foto de câmera/share mobile às vezes vem com
  // file.type vazio → o Storage gravaria octet-stream e o UAZAPI não decodifica.
  const contentType = file.type || (isImage ? 'image/jpeg' : 'application/octet-stream');
  const extFromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const extFromType = contentType.split('/')[1]?.split(';')[0];
  const ext = extFromName || extFromType || (isImage ? 'jpg' : 'bin');
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('helpdesk-media')
    .upload(path, file, { contentType });
  if (error) throw error;

  const { data } = supabase.storage.from('helpdesk-media').getPublicUrl(path);
  return data.publicUrl;
}
