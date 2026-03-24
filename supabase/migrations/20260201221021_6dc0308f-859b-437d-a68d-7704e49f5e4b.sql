ALTER TABLE broadcast_logs 
ADD COLUMN group_names text[] DEFAULT '{}';