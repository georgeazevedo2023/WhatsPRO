export interface ConversationDetail {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
  summary: string;
}

export interface AnalysisResult {
  total_analyzed: number;
  total_available?: number;
  top_reasons: { reason: string; count: number; conversation_ids?: string[] }[];
  top_products: { product: string; count: number; conversation_ids?: string[] }[];
  top_objections: { objection: string; count: number; conversation_ids?: string[] }[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    positive_ids?: string[];
    neutral_ids?: string[];
    negative_ids?: string[];
  };
  key_insights: string;
  conversations_detail?: ConversationDetail[];
}

export const SENTIMENT_COLORS = {
  positive: "hsl(142, 70%, 45%)",
  neutral: "hsl(215, 20%, 55%)",
  negative: "hsl(0, 72%, 51%)",
};

export const BAR_COLOR = "hsl(142, 70%, 45%)";

export const PERIOD_OPTIONS = [
  { value: "1", label: "Últimas 24 horas" },
  { value: "2", label: "Últimas 48 horas" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];
