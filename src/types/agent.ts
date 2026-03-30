/**
 * Typed interfaces for ai_agents Json fields.
 * Replaces `Json | null` from Supabase generated types.
 * Created in Phase 05 (DT-05).
 */

/** Agent business hours window */
export interface BusinessHours {
  start: string;  // "HH:MM" 24h format
  end: string;    // "HH:MM" 24h format
}

/** Single extraction field configured for the agent */
export interface ExtractionField {
  key: string;
  label: string;
  enabled: boolean;
}

/** Follow-up cadence rule */
export interface FollowUpRule {
  days: number;
  message: string;
}

/** Sub-agent configuration */
export interface SubAgentConfig {
  mode: string;
  prompt: string;
}

/**
 * Helper to represent a JSON field that can be null.
 * Usage: `const hours: JsonField<BusinessHours> = agent.business_hours as JsonField<BusinessHours>`
 */
export type JsonField<T> = T | null;
