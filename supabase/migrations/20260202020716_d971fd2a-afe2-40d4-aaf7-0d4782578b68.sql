-- Add DELETE policy for broadcast_logs so users can delete their own logs
CREATE POLICY "Users can delete own broadcast logs"
ON public.broadcast_logs
FOR DELETE
USING (auth.uid() = user_id);

-- Also allow super admins to delete any log
CREATE POLICY "Super admins can delete broadcast logs"
ON public.broadcast_logs
FOR DELETE
USING (is_super_admin(auth.uid()));