import { supabase } from '@/integrations/supabase/client';
import { getSessionUserId } from '@/hooks/useAuthSession';

/**
 * v7.102.0 (dieta de egress): memoização por File. No Disparador, o MESMO
 * arquivo era re-uploadado por DESTINATÁRIO (sendCarouselToNumber roda por jid)
 * e de novo no espelho do Helpdesk — N leads = N objetos novos (UUID) no bucket
 * + N downloads cold pela UAZAPI. Memoizando aqui (fonte única), o 1º upload
 * vale pra todos os call sites: mesma URL → o CDN aquece (cached egress tem
 * cota separada e mais barata). Falha NÃO fica cacheada (retry re-sobe).
 */
const uploadedUrls = new WeakMap<File, Promise<string>>();

/**
 * Upload an image file to carousel-images bucket and return the public URL
 */
export const uploadCarouselImage = (file: File): Promise<string> => {
  const pending = uploadedUrls.get(file);
  if (pending) return pending;
  const promise = doUploadCarouselImage(file);
  uploadedUrls.set(file, promise);
  promise.catch(() => uploadedUrls.delete(file));
  return promise;
};

const doUploadCarouselImage = async (file: File): Promise<string> => {
  const userId = await getSessionUserId();

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('carousel-images')
    .upload(filePath, file, {
      // 30d: a UAZAPI baixa a MESMA URL pra cada destinatário — com cache curto
      // (1h) toda campanha era 100% cache-miss (uncached egress, o caro).
      cacheControl: '2592000',
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('carousel-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Convert a base64 data URL to a File object
 */
export const base64ToFile = async (base64: string, filename: string): Promise<File> => {
  const response = await fetch(base64);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
};
