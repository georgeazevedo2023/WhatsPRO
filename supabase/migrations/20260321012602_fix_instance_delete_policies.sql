
-- instance_connection_logs: add DELETE policy for super admins
CREATE POLICY "Super admin can delete connection logs"
ON public.instance_connection_logs FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- lead_databases: add DELETE policy for super admins
CREATE POLICY "Super admins can delete lead databases"
ON public.lead_databases FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- lead_database_entries: add DELETE policy for super admins  
CREATE POLICY "Super admins can delete lead entries"
ON public.lead_database_entries FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);
;
