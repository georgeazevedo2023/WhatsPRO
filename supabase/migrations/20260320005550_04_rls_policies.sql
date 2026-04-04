
-- broadcast_logs
CREATE POLICY "Super admins can delete broadcast logs" ON public.broadcast_logs FOR DELETE USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view all broadcast logs" ON public.broadcast_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can delete own broadcast logs" ON public.broadcast_logs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own broadcast logs" ON public.broadcast_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own broadcast logs" ON public.broadcast_logs FOR SELECT USING (auth.uid() = user_id);

-- contacts
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Inbox users can view their contacts" ON public.contacts FOR SELECT USING (EXISTS (SELECT 1 FROM conversations c WHERE c.contact_id = contacts.id AND has_inbox_access(auth.uid(), c.inbox_id)));
CREATE POLICY "Super admins can manage all contacts" ON public.contacts FOR ALL USING (is_super_admin(auth.uid()));

-- conversation_labels
CREATE POLICY "Inbox users can manage conversation_labels" ON public.conversation_labels FOR ALL USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_labels.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id)));
CREATE POLICY "Inbox users can view conversation_labels" ON public.conversation_labels FOR SELECT USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_labels.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id)));
CREATE POLICY "Super admins can manage all conversation_labels" ON public.conversation_labels FOR ALL USING (is_super_admin(auth.uid()));

-- conversation_messages
CREATE POLICY "Inbox users can delete private notes" ON public.conversation_messages FOR DELETE USING (direction = 'private_note' AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id)));
CREATE POLICY "Inbox users can insert messages" ON public.conversation_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id)));
CREATE POLICY "Inbox users can view messages" ON public.conversation_messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id)));
CREATE POLICY "Super admins can manage all messages" ON public.conversation_messages FOR ALL USING (is_super_admin(auth.uid()));

-- conversations
CREATE POLICY "Inbox users can insert conversations" ON public.conversations FOR INSERT WITH CHECK (has_inbox_access(auth.uid(), inbox_id));
CREATE POLICY "Inbox users can update conversations" ON public.conversations FOR UPDATE USING (has_inbox_access(auth.uid(), inbox_id) AND (department_id IS NULL OR is_super_admin(auth.uid()) OR (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role])) OR (EXISTS (SELECT 1 FROM department_members dm WHERE dm.department_id = conversations.department_id AND dm.user_id = auth.uid()))));
CREATE POLICY "Inbox users can view conversations" ON public.conversations FOR SELECT USING (has_inbox_access(auth.uid(), inbox_id) AND (department_id IS NULL OR is_super_admin(auth.uid()) OR (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role])) OR (EXISTS (SELECT 1 FROM department_members dm WHERE dm.department_id = conversations.department_id AND dm.user_id = auth.uid()))));
CREATE POLICY "Super admins can manage all conversations" ON public.conversations FOR ALL USING (is_super_admin(auth.uid()));

-- department_members
CREATE POLICY "Inbox users can view department members" ON public.department_members FOR SELECT USING (EXISTS (SELECT 1 FROM departments d WHERE d.id = department_members.department_id AND has_inbox_access(auth.uid(), d.inbox_id)));
CREATE POLICY "Super admins can manage all department members" ON public.department_members FOR ALL USING (is_super_admin(auth.uid()));

-- departments
CREATE POLICY "Inbox users can view departments" ON public.departments FOR SELECT USING (has_inbox_access(auth.uid(), inbox_id));
CREATE POLICY "Super admins can manage all departments" ON public.departments FOR ALL USING (is_super_admin(auth.uid()));

-- inbox_users
CREATE POLICY "Inbox admins and gestors can manage members" ON public.inbox_users FOR ALL USING (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role]));
CREATE POLICY "Inbox members can view co-members" ON public.inbox_users FOR SELECT USING (is_inbox_member(auth.uid(), inbox_id));
CREATE POLICY "Super admins can manage all inbox_users" ON public.inbox_users FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view own inbox memberships" ON public.inbox_users FOR SELECT USING (auth.uid() = user_id);

-- inboxes
CREATE POLICY "Inbox admins can update inboxes" ON public.inboxes FOR UPDATE USING (is_super_admin(auth.uid()) OR (get_inbox_role(auth.uid(), id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role])));
CREATE POLICY "Super admins can manage all inboxes" ON public.inboxes FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view their inboxes" ON public.inboxes FOR SELECT USING (is_super_admin(auth.uid()) OR has_inbox_access(auth.uid(), id));

-- instance_connection_logs
CREATE POLICY "Users can insert logs for assigned instances" ON public.instance_connection_logs FOR INSERT WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_instance_access WHERE user_instance_access.instance_id = instance_connection_logs.instance_id AND user_instance_access.user_id = auth.uid()));
CREATE POLICY "Users can view logs of assigned instances" ON public.instance_connection_logs FOR SELECT USING (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_instance_access WHERE user_instance_access.instance_id = instance_connection_logs.instance_id AND user_instance_access.user_id = auth.uid()));

-- instances
CREATE POLICY "Super admin can delete instances" ON public.instances FOR DELETE USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert instances" ON public.instances FOR INSERT WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Users can update assigned instances" ON public.instances FOR UPDATE USING (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_instance_access WHERE user_instance_access.instance_id = instances.id AND user_instance_access.user_id = auth.uid()));
CREATE POLICY "Users can view assigned instances" ON public.instances FOR SELECT USING (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_instance_access WHERE user_instance_access.instance_id = instances.id AND user_instance_access.user_id = auth.uid()));

-- kanban_board_members
CREATE POLICY "Super admins gerenciam membros do board" ON public.kanban_board_members FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários veem seus próprios acessos" ON public.kanban_board_members FOR SELECT USING (auth.uid() = user_id);

-- kanban_boards
CREATE POLICY "Apenas super admins atualizam boards" ON public.kanban_boards FOR UPDATE USING (is_super_admin(auth.uid()));
CREATE POLICY "Apenas super admins criam boards" ON public.kanban_boards FOR INSERT WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Apenas super admins excluem boards" ON public.kanban_boards FOR DELETE USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins gerenciam todos os boards" ON public.kanban_boards FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários podem ver boards acessíveis" ON public.kanban_boards FOR SELECT USING (is_super_admin(auth.uid()) OR created_by = auth.uid() OR (inbox_id IS NOT NULL AND has_inbox_access(auth.uid(), inbox_id)) OR EXISTS (SELECT 1 FROM kanban_board_members m WHERE m.board_id = kanban_boards.id AND m.user_id = auth.uid()));

-- kanban_card_data
CREATE POLICY "Super admins gerenciam todos os dados" ON public.kanban_card_data FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários atualizam dados de cards acessíveis" ON public.kanban_card_data FOR UPDATE USING (can_access_kanban_card(auth.uid(), card_id));
CREATE POLICY "Usuários excluem dados de cards acessíveis" ON public.kanban_card_data FOR DELETE USING (can_access_kanban_card(auth.uid(), card_id));
CREATE POLICY "Usuários inserem dados em cards acessíveis" ON public.kanban_card_data FOR INSERT WITH CHECK (can_access_kanban_card(auth.uid(), card_id));
CREATE POLICY "Usuários veem dados de cards acessíveis" ON public.kanban_card_data FOR SELECT USING (can_access_kanban_card(auth.uid(), card_id));

-- kanban_cards
CREATE POLICY "Criadores e responsáveis atualizam cards" ON public.kanban_cards FOR UPDATE USING (created_by = auth.uid() OR assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM kanban_boards b WHERE b.id = kanban_cards.board_id AND b.created_by = auth.uid()));
CREATE POLICY "Criadores excluem seus cards" ON public.kanban_cards FOR DELETE USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM kanban_boards b WHERE b.id = kanban_cards.board_id AND b.created_by = auth.uid()));
CREATE POLICY "Super admins gerenciam todos os cards" ON public.kanban_cards FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários criam cards em boards acessíveis" ON public.kanban_cards FOR INSERT WITH CHECK (auth.uid() = created_by AND can_access_kanban_board(auth.uid(), board_id));
CREATE POLICY "Usuários veem cards respeitando visibilidade" ON public.kanban_cards FOR SELECT USING (EXISTS (SELECT 1 FROM kanban_boards b WHERE b.id = kanban_cards.board_id AND (is_super_admin(auth.uid()) OR (b.visibility = 'shared' AND can_access_kanban_board(auth.uid(), b.id)) OR (b.visibility = 'private' AND (b.created_by = auth.uid() OR kanban_cards.assigned_to = auth.uid())))));

-- kanban_columns
CREATE POLICY "Super admins gerenciam todas as colunas" ON public.kanban_columns FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários veem colunas de boards acessíveis" ON public.kanban_columns FOR SELECT USING (can_access_kanban_board(auth.uid(), board_id));

-- kanban_entities
CREATE POLICY "Super admins gerenciam todas as entidades" ON public.kanban_entities FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários veem entidades de boards acessíveis" ON public.kanban_entities FOR SELECT USING (can_access_kanban_board(auth.uid(), board_id));

-- kanban_entity_values
CREATE POLICY "Super admins gerenciam todos os valores" ON public.kanban_entity_values FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários veem valores de entidades acessíveis" ON public.kanban_entity_values FOR SELECT USING (EXISTS (SELECT 1 FROM kanban_entities e WHERE e.id = kanban_entity_values.entity_id AND can_access_kanban_board(auth.uid(), e.board_id)));

-- kanban_fields
CREATE POLICY "Super admins gerenciam todos os campos" ON public.kanban_fields FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Usuários veem campos de boards acessíveis" ON public.kanban_fields FOR SELECT USING (can_access_kanban_board(auth.uid(), board_id));

-- labels
CREATE POLICY "Inbox admins can manage labels" ON public.labels FOR ALL USING (get_inbox_role(auth.uid(), inbox_id) = ANY (ARRAY['admin'::inbox_role, 'gestor'::inbox_role]));
CREATE POLICY "Inbox users can view labels" ON public.labels FOR SELECT USING (has_inbox_access(auth.uid(), inbox_id));
CREATE POLICY "Super admins can manage all labels" ON public.labels FOR ALL USING (is_super_admin(auth.uid()));

-- lead_database_entries
CREATE POLICY "Super admins can view all lead entries" ON public.lead_database_entries FOR SELECT USING (EXISTS (SELECT 1 FROM lead_databases WHERE lead_databases.id = lead_database_entries.database_id AND is_super_admin(auth.uid())));
CREATE POLICY "Users can manage entries via database ownership" ON public.lead_database_entries FOR ALL USING (EXISTS (SELECT 1 FROM lead_databases WHERE lead_databases.id = lead_database_entries.database_id AND lead_databases.user_id = auth.uid()));

-- lead_databases
CREATE POLICY "Super admins can view all lead databases" ON public.lead_databases FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can manage own lead databases" ON public.lead_databases FOR ALL USING (auth.uid() = user_id);

-- message_templates
CREATE POLICY "Users can create their own templates" ON public.message_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON public.message_templates FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON public.message_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own templates" ON public.message_templates FOR SELECT USING (auth.uid() = user_id);

-- scheduled_message_logs
CREATE POLICY "Super admins can view all logs" ON public.scheduled_message_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view own logs" ON public.scheduled_message_logs FOR SELECT USING (EXISTS (SELECT 1 FROM scheduled_messages sm WHERE sm.id = scheduled_message_logs.scheduled_message_id AND sm.user_id = auth.uid()));

-- scheduled_messages
CREATE POLICY "Super admins can view all scheduled messages" ON public.scheduled_messages FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can manage own scheduled messages" ON public.scheduled_messages FOR ALL USING (auth.uid() = user_id);

-- shift_report_configs
CREATE POLICY "Super admins can manage shift report configs" ON public.shift_report_configs FOR ALL USING (is_super_admin(auth.uid()));

-- shift_report_logs
CREATE POLICY "Super admins can view shift report logs" ON public.shift_report_logs FOR ALL USING (is_super_admin(auth.uid()));

-- user_instance_access
CREATE POLICY "Super admin can manage all access" ON public.user_instance_access FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view own access" ON public.user_instance_access FOR SELECT USING (auth.uid() = user_id);

-- user_profiles
CREATE POLICY "Inbox co-members can view limited profiles" ON public.user_profiles FOR SELECT USING (auth.uid() = id OR is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM (inbox_users iu1 JOIN inbox_users iu2 ON iu1.inbox_id = iu2.inbox_id) WHERE iu1.user_id = auth.uid() AND iu2.user_id = user_profiles.id));
CREATE POLICY "Super admin can delete profiles" ON public.user_profiles FOR DELETE USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert profiles" ON public.user_profiles FOR INSERT WITH CHECK (is_super_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Super admin can update all profiles" ON public.user_profiles FOR UPDATE USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admin can view all profiles" ON public.user_profiles FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Super admin can manage all roles" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admin can view all roles" ON public.user_roles FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
;
