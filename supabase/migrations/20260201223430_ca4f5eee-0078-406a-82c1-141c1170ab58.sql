-- Add carousel_data column to store carousel configuration in templates
ALTER TABLE message_templates 
ADD COLUMN carousel_data jsonb DEFAULT NULL;