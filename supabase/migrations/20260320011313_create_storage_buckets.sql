
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('helpdesk-media', 'helpdesk-media', true, 52428800, NULL),
  ('audio-messages', 'audio-messages', true, 26214400, ARRAY['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/aac'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for helpdesk-media (public read, authenticated write)
CREATE POLICY "Public read helpdesk-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'helpdesk-media');

CREATE POLICY "Authenticated insert helpdesk-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'helpdesk-media');

CREATE POLICY "Service role delete helpdesk-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'helpdesk-media');

-- Storage policies for audio-messages (public read, authenticated write)
CREATE POLICY "Public read audio-messages"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-messages');

CREATE POLICY "Authenticated insert audio-messages"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-messages');

CREATE POLICY "Service role delete audio-messages"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-messages');
;
