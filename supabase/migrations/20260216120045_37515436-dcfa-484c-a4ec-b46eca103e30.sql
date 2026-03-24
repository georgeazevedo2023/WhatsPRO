
-- Add last_message column to conversations table for performance optimization
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message text;
