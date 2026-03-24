-- Add carousel_data column to broadcast_logs table
ALTER TABLE public.broadcast_logs 
ADD COLUMN carousel_data jsonb;