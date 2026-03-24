-- Add category column to message_templates
ALTER TABLE public.message_templates 
ADD COLUMN category TEXT DEFAULT NULL;

-- Create index for faster category lookups
CREATE INDEX idx_message_templates_category ON public.message_templates(category);