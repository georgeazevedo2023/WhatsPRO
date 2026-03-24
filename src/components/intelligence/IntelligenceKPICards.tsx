import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageCircle,
  Package,
  AlertCircle,
  SmilePlus,
  Meh,
  Frown,
} from "lucide-react";
import type { AnalysisResult } from "./types";
import { SENTIMENT_COLORS } from "./types";

interface IntelligenceKPICardsProps {
  analysis: AnalysisResult;
  dominantSentiment: "positive" | "neutral" | "negative";
  onOpenDetail: (title: string, ids: string[]) => void;
}

export function IntelligenceKPICards({
  analysis,
  dominantSentiment,
  onOpenDetail,
}: IntelligenceKPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Top reason */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Principal motivo
              </p>
              {analysis.top_reasons[0] ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-snug line-clamp-3">
                    {analysis.top_reasons[0].reason}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {analysis.top_reasons[0].count} ocorrência{analysis.top_reasons[0].count !== 1 ? "s" : ""}
                    </p>
                    {(analysis.top_reasons[0].conversation_ids?.length || 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-primary hover:text-primary"
                        onClick={() => onOpenDetail(
                          `Principal motivo: ${analysis.top_reasons[0].reason}`,
                          analysis.top_reasons[0].conversation_ids || []
                        )}
                      >
                        Abrir
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum dado</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top product */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Produto mais citado
              </p>
              {analysis.top_products[0] ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-snug line-clamp-3">
                    {analysis.top_products[0].product}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {analysis.top_products[0].count} menção{analysis.top_products[0].count !== 1 ? "ões" : ""}
                    </p>
                    {(analysis.top_products[0].conversation_ids?.length || 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-primary hover:text-primary"
                        onClick={() => onOpenDetail(
                          `Produto: ${analysis.top_products[0].product}`,
                          analysis.top_products[0].conversation_ids || []
                        )}
                      >
                        Abrir
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum produto identificado</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top objection */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Principal objeção
              </p>
              {analysis.top_objections[0] ? (
                <>
                  <p className="text-sm font-semibold text-foreground leading-snug line-clamp-3">
                    {analysis.top_objections[0].objection}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {analysis.top_objections[0].count} ocorrência{analysis.top_objections[0].count !== 1 ? "s" : ""}
                    </p>
                    {(analysis.top_objections[0].conversation_ids?.length || 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-primary hover:text-primary"
                        onClick={() => onOpenDetail(
                          `Objeção: ${analysis.top_objections[0].objection}`,
                          analysis.top_objections[0].conversation_ids || []
                        )}
                      >
                        Abrir
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma objeção identificada</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sentiment */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                dominantSentiment === "positive"
                  ? "bg-primary/10"
                  : dominantSentiment === "negative"
                  ? "bg-destructive/10"
                  : "bg-muted"
              }`}
            >
              {dominantSentiment === "positive" ? (
                <SmilePlus className="w-4 h-4 text-primary" />
              ) : dominantSentiment === "negative" ? (
                <Frown className="w-4 h-4 text-destructive" />
              ) : (
                <Meh className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Sentimento geral
              </p>
              <p className="text-sm font-semibold text-foreground">
                {dominantSentiment === "positive"
                  ? "Positivo"
                  : dominantSentiment === "negative"
                  ? "Negativo"
                  : "Neutro"}
              </p>
              <div className="flex gap-2.5 mt-0.5">
                <span className="text-[11px] font-medium" style={{ color: SENTIMENT_COLORS.positive }}>
                  {analysis.sentiment.positive}%
                </span>
                <span className="text-[11px] font-medium" style={{ color: SENTIMENT_COLORS.neutral }}>
                  {analysis.sentiment.neutral}%
                </span>
                <span className="text-[11px] font-medium" style={{ color: SENTIMENT_COLORS.negative }}>
                  {analysis.sentiment.negative}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {analysis.total_analyzed} conversa{analysis.total_analyzed !== 1 ? "s" : ""} analisada{analysis.total_analyzed !== 1 ? "s" : ""}
                </p>
                {(() => {
                  const sentIds = dominantSentiment === "positive"
                    ? analysis.sentiment.positive_ids
                    : dominantSentiment === "negative"
                    ? analysis.sentiment.negative_ids
                    : analysis.sentiment.neutral_ids;
                  const sentLabel = dominantSentiment === "positive"
                    ? "Positivo"
                    : dominantSentiment === "negative"
                    ? "Negativo"
                    : "Neutro";
                  return (sentIds?.length || 0) > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-primary hover:text-primary"
                      onClick={() => onOpenDetail(
                        `Sentimento ${sentLabel}`,
                        sentIds || []
                      )}
                    >
                      Abrir
                    </Button>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
