
-- Create helpdesk-media bucket for persistent media storage
INSERT INTO storage.buckets (id, name, public) VALUES ('helpdesk-media', 'helpdesk-media', true);

-- Allow public read access
CREATE POLICY "Public read access for helpdesk media"
ON storage.objects FOR SELECT
USING (bucket_id = 'helpdesk-media');

-- Allow service role to upload (edge functions use service role)
CREATE POLICY "Service role can upload helpdesk media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'helpdesk-media');
