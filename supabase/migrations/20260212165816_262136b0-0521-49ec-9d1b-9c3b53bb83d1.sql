
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-messages', 'audio-messages', true);

CREATE POLICY "Anyone can read audio messages" ON storage.objects FOR SELECT USING (bucket_id = 'audio-messages');

CREATE POLICY "Authenticated users can upload audio messages" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-messages' AND auth.role() = 'authenticated');
