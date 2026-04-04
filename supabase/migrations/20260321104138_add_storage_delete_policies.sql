
-- Allow authenticated users to delete their uploaded files from helpdesk-media
CREATE POLICY "Authenticated users can delete helpdesk media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'helpdesk-media' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their uploaded audio messages
CREATE POLICY "Authenticated users can delete audio messages"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-messages' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their carousel images
CREATE POLICY "Authenticated users can delete carousel images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'carousel-images' AND (storage.foldername(name))[1] = auth.uid()::text);
;
