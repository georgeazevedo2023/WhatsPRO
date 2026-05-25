-- 2026-05-24 (pedido do dono): atendente só vê "Minhas" por padrão.
-- Safe-by-default (least privilege): o default das colunas de visibilidade vira
-- false. Quem precisa ver "Não atribuídas"/"Todas" recebe o flag explícito
-- (UsersTab seta por papel: gestor/admin amplos, agente restrito; admin libera
-- caso a caso pelos toggles). Antes o default true fazia membro novo ver tudo.
-- Não altera linhas existentes — só o default de novas inserções.
alter table public.inbox_users alter column can_view_unassigned set default false;
alter table public.inbox_users alter column can_view_all_in_dept set default false;
-- can_view_all já era default false.
