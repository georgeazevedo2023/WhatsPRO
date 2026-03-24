-- Criar bucket para imagens de carrossel
INSERT INTO storage.buckets (id, name, public)
VALUES ('carousel-images', 'carousel-images', true);

-- Politica para usuarios autenticados fazerem upload
CREATE POLICY "Users can upload carousel images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'carousel-images');

-- Politica para leitura publica
CREATE POLICY "Public can read carousel images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'carousel-images');

-- Politica para usuarios deletarem suas proprias imagens
CREATE POLICY "Users can delete their own carousel images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'carousel-images' AND auth.uid()::text = (storage.foldername(name))[1]);