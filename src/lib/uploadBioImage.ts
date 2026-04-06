import { supabase } from '@/integrations/supabase/client'
import { getSessionUserId } from '@/hooks/useAuthSession'

/**
 * Upload an image file to bio-images bucket and return the public URL.
 * Used for: bio page avatars, featured button images, thumbnail images.
 */
export const uploadBioImage = async (file: File): Promise<string> => {
  const userId = await getSessionUserId()

  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${crypto.randomUUID()}.${fileExt}`
  const filePath = `${userId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('bio-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Erro ao fazer upload: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from('bio-images').getPublicUrl(filePath)

  return data.publicUrl
}
