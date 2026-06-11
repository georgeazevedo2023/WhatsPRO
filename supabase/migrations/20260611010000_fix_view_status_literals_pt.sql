-- Fix: views comparavam conversations.status com literais em INGLÊS
-- ('resolved'/'pending'), mas os valores reais são 'resolvida'/'pendente'/'aberta'.
-- Efeito: Ranking Vendedores sempre "0 resolv. / 0%", v_handoff_details.converteu
-- sempre false, v_lead_metrics.resolved_count sempre 0, v_ia_vs_vendor.vendor_resolved
-- sempre 0 (herda de v_vendor_activity).
-- CREATE OR REPLACE preserva grants existentes.

CREATE OR REPLACE VIEW public.v_vendor_activity AS
SELECT ib.instance_id,
    conv.assigned_to AS seller_id,
    date(conv.updated_at) AS activity_date,
    count(DISTINCT conv.id) AS conversations_handled,
    count(DISTINCT
        CASE
            WHEN conv.status = 'resolvida'::text THEN conv.id
            ELSE NULL::uuid
        END) AS resolved_count,
    count(DISTINCT
        CASE
            WHEN conv.status = 'pendente'::text THEN conv.id
            ELSE NULL::uuid
        END) AS pending_count,
    round(avg(
        CASE
            WHEN conv.status = 'resolvida'::text THEN EXTRACT(epoch FROM conv.updated_at - conv.created_at) / 60::numeric
            ELSE NULL::numeric
        END), 1) AS avg_resolution_minutes,
    count(DISTINCT ct.id) AS unique_contacts
   FROM conversations conv
     JOIN inboxes ib ON ib.id = conv.inbox_id
     JOIN contacts ct ON ct.id = conv.contact_id
  WHERE conv.assigned_to IS NOT NULL
  GROUP BY ib.instance_id, conv.assigned_to, (date(conv.updated_at));

CREATE OR REPLACE VIEW public.v_handoff_details AS
SELECT ib.instance_id,
    al.conversation_id,
    conv.assigned_to AS seller_id,
    al.created_at AS handoff_at,
    conv.created_at AS conversation_started_at,
    round(EXTRACT(epoch FROM al.created_at - conv.created_at) / 60::numeric, 1) AS minutes_before_handoff,
    al.metadata ->> 'reason'::text AS handoff_reason,
    al.metadata ->> 'trigger'::text AS handoff_trigger,
        CASE
            WHEN (al.metadata ->> 'trigger'::text) = ANY (ARRAY['lead_asked'::text, 'buy_confirm'::text, 'lead_request'::text]) THEN false
            ELSE true
        END AS evitavel,
        CASE
            WHEN conv.status = 'resolvida'::text THEN round(EXTRACT(epoch FROM conv.updated_at - al.created_at) / 60::numeric, 1)
            ELSE NULL::numeric
        END AS minutes_to_resolve_after_handoff,
    conv.status AS conversation_status,
        CASE
            WHEN conv.status = 'resolvida'::text THEN true
            ELSE false
        END AS converteu
   FROM ai_agent_logs al
     JOIN conversations conv ON conv.id = al.conversation_id
     JOIN inboxes ib ON ib.id = conv.inbox_id
  WHERE al.event = ANY (ARRAY['handoff'::text, 'handoff_to_human'::text, 'handoff_trigger'::text]);

CREATE OR REPLACE VIEW public.v_lead_metrics AS
SELECT lp.id AS lead_id,
    ib.instance_id,
    lp.full_name,
    lp.origin,
    lp.current_score,
    lp.average_ticket,
    lp.tags,
    lp.metadata,
    count(DISTINCT conv.id) AS total_conversations,
    min(conv.created_at) AS first_contact_at,
    max(conv.created_at) AS last_contact_at,
    count(DISTINCT
        CASE
            WHEN conv.assigned_to IS NOT NULL THEN conv.id
            ELSE NULL::uuid
        END) AS handoff_count,
    count(DISTINCT
        CASE
            WHEN conv.status = 'resolvida'::text THEN conv.id
            ELSE NULL::uuid
        END) AS resolved_count,
    lp.created_at AS lead_created_at
   FROM lead_profiles lp
     JOIN contacts ct ON ct.id = lp.contact_id
     LEFT JOIN conversations conv ON conv.contact_id = ct.id
     LEFT JOIN inboxes ib ON ib.id = conv.inbox_id
  GROUP BY lp.id, ib.instance_id, lp.full_name, lp.origin, lp.current_score, lp.average_ticket, lp.tags, lp.metadata, lp.created_at;
