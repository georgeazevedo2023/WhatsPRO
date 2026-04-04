-- S5.4: Link kanban_cards to contacts for CRM ↔ Leads integration
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kanban_cards_contact_id ON kanban_cards(contact_id);
;
