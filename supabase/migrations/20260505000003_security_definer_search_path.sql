-- P1-3: Adiciona SET search_path em 24 funções SECURITY DEFINER públicas
-- Motivação: Auditoria 2026-05-05 (Onda C) descobriu que estas funções não têm
-- search_path fixo. Em SECURITY DEFINER, sem search_path, atacante com permissão
-- de criar schema/tabela poderia injetar `auth.users` fake e bypass dos checks
-- de role (defense-in-depth Supabase advisor).
--
-- 9 destas são helpers críticos de RLS: is_super_admin, has_role, has_inbox_access,
-- is_inbox_member, get_inbox_role, is_gerente, can_access_kanban_board,
-- can_access_kanban_card, handle_new_user.
--
-- Pulado: dblink_connect_u (extension function, não nossa).
--
-- Padrão: ALTER FUNCTION (não DROP+CREATE) preserva corpo, assinatura e ACLs.

ALTER FUNCTION public.backup_query(text, text)                                    SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.can_access_kanban_board(uuid, uuid)                         SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.can_access_kanban_card(uuid, uuid)                          SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.cleanup_expired_lead_memory()                               SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.cleanup_old_e2e_runs()                                      SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.create_flow_report_share(uuid)                              SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.get_active_form_session(uuid)                               SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.get_e2e_results()                                           SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.get_form_stats(uuid)                                        SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.get_funnel_lead_count(text)                                 SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.get_inbox_role(uuid, uuid)                                  SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.handle_new_user()                                           SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.has_inbox_access(uuid, uuid)                                SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.has_role(uuid, app_role)                                    SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.increment_bio_click(uuid)                                   SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.increment_bio_view(uuid)                                    SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.increment_lead_msg_count(uuid)                              SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.install_flow_template(text, text, text, text, text, jsonb, jsonb, jsonb, boolean) SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.is_gerente(uuid)                                            SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.is_inbox_member(uuid, uuid)                                 SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.is_super_admin(uuid)                                        SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.reset_e2e_conversation()                                    SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.upsert_lead_long_memory(uuid, text, text, jsonb)            SET search_path TO 'public', 'auth', 'storage';
ALTER FUNCTION public.upsert_lead_short_memory(uuid, text, text, jsonb, integer)  SET search_path TO 'public', 'auth', 'storage';
