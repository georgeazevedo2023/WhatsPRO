import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionFetch, type EdgeFunctionError } from "@/lib/edgeFunctionClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrainCircuit, ExternalLink, User, Clock, Copy, CheckCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { AnalysisResult, ConversationDetail } from "@/components/intelligence/types";
import { PERIOD_OPTIONS } from "@/components/intelligence/types";
import { IntelligenceFilters } from "@/components/intelligence/IntelligenceFilters";
import { IntelligenceKPICards } from "@/components/intelligence/IntelligenceKPICards";
import { IntelligenceCharts } from "@/components/intelligence/IntelligenceCharts";
import { useFunnelsList } from "@/hooks/useFunnels";

function ConversationDetailDialog({
  open,
  onOpenChange,
  title,
  conversationIds,
  allDetails,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  conversationIds: string[];
  allDetails: ConversationDetail[];
}) {
  const filtered = allDetails.filter(d => conversationIds.includes(d.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conversa encontrada</p>
          ) : (
            <div className="flex flex-col">
              {filtered.map((conv, idx) => {
                const phone = conv.contact_phone?.replace(/\D/g, "") || "";
                const waLink = phone ? `https://wa.me/${phone}` : null;
                const displayName = conv.contact_name || phone || "Desconhecido";
                let formattedDate = "";
                try {
                  formattedDate = format(new Date(conv.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                } catch {
                  formattedDate = conv.created_at;
                }

                return (
                  <div key={conv.id}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
                        </div>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed mt-0.5">{conv.summary}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function formatAnalysisForCopy(analysis: AnalysisResult, periodDays: string, generatedAt: Date | null): string {
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === periodDays)?.label || `${periodDays} dias`;
  const dateStr = generatedAt ? format(generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "N/A";

  let text = `INTELIGÊNCIA DE NEGÓCIOS — WhatsPRO\n`;
  text += `Período: ${periodLabel}\n`;
  text += `Gerado em: ${dateStr}\n`;
  text += `Conversas analisadas: ${analysis.total_analyzed}`;
  if (analysis.total_available && analysis.total_available > analysis.total_analyzed) {
    text += ` (de ${analysis.total_available} disponíveis)`;
  }
  text += `\n\n`;

  if (analysis.top_reasons.length > 0) {
    text += `PRINCIPAIS MOTIVOS DE CONTATO:\n`;
    analysis.top_reasons.forEach((r, i) => { text += `${i + 1}. ${r.reason} (${r.count}x)\n`; });
    text += `\n`;
  }

  if (analysis.top_products.length > 0) {
    text += `PRODUTOS MAIS CITADOS:\n`;
    analysis.top_products.forEach((p, i) => { text += `${i + 1}. ${p.product} (${p.count}x)\n`; });
    text += `\n`;
  }

  if (analysis.top_objections.length > 0) {
    text += `PRINCIPAIS OBJEÇÕES:\n`;
    analysis.top_objections.forEach((o, i) => { text += `${i + 1}. ${o.objection} (${o.count}x)\n`; });
    text += `\n`;
  }

  text += `SENTIMENTO:\n`;
  text += `Positivo: ${analysis.sentiment.positive}% | Neutro: ${analysis.sentiment.neutral}% | Negativo: ${analysis.sentiment.negative}%\n\n`;

  if (analysis.key_insights) {
    text += `INSIGHTS ESTRATÉGICOS:\n${analysis.key_insights}\n`;
  }

  return text;
}

export default function Intelligence() {
  const queryClient = useQueryClient();
  const [periodDays, setPeriodDays] = useState("30");
  const [selectedInbox, setSelectedInbox] = useState("all");
  const [selectedFunnel, setSelectedFunnel] = useState("all");
  const { data: funnelsList } = useFunnelsList();
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; title: string; ids: string[] }>({
    open: false,
    title: "",
    ids: [],
  });
  const prevKeyRef = useRef<string>("");

  const analysisQueryKey = ["intelligence-analysis", selectedInbox, periodDays];
  const currentKey = `${selectedInbox}-${periodDays}`;

  // Reset enabled when filters change
  if (currentKey !== prevKeyRef.current) {
    prevKeyRef.current = currentKey;
    if (analysisEnabled) {
      setAnalysisEnabled(false);
    }
  }

  const { data: inboxes } = useQuery({
    queryKey: ["inboxes-for-intelligence"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inboxes").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: summaryCount } = useQuery({
    queryKey: ["summary-count", selectedInbox, periodDays],
    queryFn: async () => {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - parseInt(periodDays));

      let query = supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .not("ai_summary", "is", null)
        .gte("created_at", sinceDate.toISOString());

      if (selectedInbox !== "all") {
        query = query.eq("inbox_id", selectedInbox);
      }

      const { count } = await query;
      return count || 0;
    },
  });

  const {
    data: analysis,
    isFetching: loading,
    dataUpdatedAt,
    isStale,
  } = useQuery({
    queryKey: analysisQueryKey,
    queryFn: async () => {
      const data = await edgeFunctionFetch<AnalysisResult>("analyze-summaries", {
        inbox_id: selectedInbox === "all" ? null : selectedInbox,
        period_days: parseInt(periodDays),
      });
      setGeneratedAt(new Date());
      return data;
    },
    enabled: analysisEnabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    meta: {
      onError: (err: unknown) => {
        const e = err as EdgeFunctionError;
        if (e.status === 429) {
          toast.error("Limite de IA atingido. Tente novamente em alguns minutos.");
        } else if (e.status === 402) {
          toast.error("Créditos de IA insuficientes. Adicione créditos ao workspace.");
        } else {
          console.error("[Intelligence] Error:", err);
          toast.error(e.message || "Erro inesperado ao gerar análise.");
        }
      },
    },
  });

  // Check if we have cached data from a previous run (same key, data exists, but not currently fetching)
  const isCachedResult = !!analysis && !loading && dataUpdatedAt > 0 && !analysisEnabled;

  const handleAnalyze = useCallback(() => {
    setAnalysisEnabled(true);
  }, []);

  const handleRegenerate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: analysisQueryKey });
    setAnalysisEnabled(true);
  }, [queryClient, analysisQueryKey]);

  const handleCopy = useCallback(async () => {
    if (!analysis) return;
    const text = formatAnalysisForCopy(analysis, periodDays, generatedAt);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Análise copiada!");
    setTimeout(() => setCopied(false), 2000);
  }, [analysis, periodDays, generatedAt]);

  const openDetail = (title: string, ids: string[]) => {
    if (ids.length > 0) {
      setDetailDialog({ open: true, title, ids });
    }
  };

  const dominantSentiment = analysis
    ? analysis.sentiment.positive >= analysis.sentiment.neutral &&
      analysis.sentiment.positive >= analysis.sentiment.negative
      ? "positive"
      : analysis.sentiment.neutral >= analysis.sentiment.negative
      ? "neutral"
      : "negative"
    : null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Detail Dialog */}
      <ConversationDetailDialog
        open={detailDialog.open}
        onOpenChange={(open) => setDetailDialog(prev => ({ ...prev, open }))}
        title={detailDialog.title}
        conversationIds={detailDialog.ids}
        allDetails={analysis?.conversations_detail || []}
      />

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <BrainCircuit className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inteligência de Negócios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Análise estratégica extraída dos resumos de IA das conversas de atendimento
          </p>
        </div>
      </div>

      {/* Filters, empty/initial/loading states */}
      <IntelligenceFilters
        periodDays={periodDays}
        setPeriodDays={(v) => { setPeriodDays(v); setAnalysisEnabled(false); }}
        selectedInbox={selectedInbox}
        setSelectedInbox={(v) => { setSelectedInbox(v); setAnalysisEnabled(false); }}
        inboxes={inboxes}
        funnels={(funnelsList || []).map(f => ({ slug: f.slug, name: f.name }))}
        selectedFunnel={selectedFunnel}
        setSelectedFunnel={(v) => { setSelectedFunnel(v); setAnalysisEnabled(false); }}
        summaryCount={summaryCount}
        loading={loading}
        hasAnalysis={!!analysis}
        onAnalyze={handleAnalyze}
      />

      {/* Results */}
      {analysis && !loading && (
        <>
          {/* Analysis metadata bar */}
          <div className="flex flex-wrap items-center gap-2 -mt-2">
            {generatedAt && (
              <span className="text-xs text-muted-foreground">
                Análise gerada em {format(generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            {isCachedResult && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Clock className="w-2.5 h-2.5" />
                Cache
              </Badge>
            )}
            {isStale && (
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                Dados podem estar desatualizados
              </Badge>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleRegenerate}
              >
                <RefreshCw className="w-3 h-3" />
                Regenerar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <><CheckCheck className="w-3 h-3 text-primary" /> Copiado!</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copiar Análise</>
                )}
              </Button>
            </div>
          </div>

          <IntelligenceKPICards
            analysis={analysis}
            dominantSentiment={dominantSentiment!}
            onOpenDetail={openDetail}
          />

          <IntelligenceCharts
            analysis={analysis}
            periodDays={periodDays}
          />
        </>
      )}
    </div>
  );
}
