import { supabase } from '@/integrations/supabase/client';
import { getSessionUserId } from '@/hooks/useAuthSession';

/**
 * Upload an image file to carousel-images bucket and return the public URL
 */
export const uploadCarouselImage = async (file: File): Promise<string> => {
  const userId = await getSessionUserId();

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('carousel-images')
    .upload(filePath, file, {
      cacheControl: '3600',
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
