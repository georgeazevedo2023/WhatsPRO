import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BrainCircuit,
  Sparkles,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { PERIOD_OPTIONS } from "./types";

interface IntelligenceFiltersProps {
  periodDays: string;
  setPeriodDays: (value: string) => void;
  selectedInbox: string;
  setSelectedInbox: (value: string) => void;
  inboxes: { id: string; name: string }[] | undefined;
  summaryCount: number | undefined;
  loading: boolean;
  hasAnalysis: boolean;
  onAnalyze: () => void;
}

export function IntelligenceFilters({
  periodDays,
  setPeriodDays,
  selectedInbox,
  setSelectedInbox,
  inboxes,
  summaryCount,
  loading,
  hasAnalysis,
  onAnalyze,
}: IntelligenceFiltersProps) {
  return (
    <>
      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Período
              </label>
              <Select value={periodDays} onValueChange={setPeriodDays}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Caixa de entrada
              </label>
              <Select value={selectedInbox} onValueChange={setSelectedInbox}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as caixas</SelectItem>
                  {(inboxes || []).map((inbox) => (
                    <SelectItem key={inbox.id} value={inbox.id}>
                      {inbox.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="h-5" />
              <Button
                onClick={onAnalyze}
                disabled={loading || (summaryCount !== undefined && summaryCount === 0)}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading ? `Analisando ${summaryCount} conversas...` : "Gerar Análise"}
              </Button>
            </div>

            {summaryCount !== undefined && (
              <div className="flex items-center gap-2 mt-auto">
                <Badge
                  variant={summaryCount === 0 ? "destructive" : summaryCount < 5 ? "secondary" : "default"}
                  className="text-xs"
                >
                  {summaryCount} resumo{summaryCount !== 1 ? "s" : ""} disponível{summaryCount !== 1 ? "is" : ""}
                </Badge>
                {summaryCount > 0 && summaryCount < 5 && (
                  <span className="text-xs text-muted-foreground">
                    Poucos dados — análise pode não ser representativa
                  </span>
                )}
                {summaryCount > 200 && (
                  <span className="text-xs text-amber-500">
                    Apenas 200 das {summaryCount} serão analisadas
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!loading && !hasAnalysis && summaryCount === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhum resumo disponível</p>
            <p className="text-sm text-muted-foreground mt-1">
              Não há conversas com resumo de IA no período e caixa selecionados.
              <br />
              Ajuste os filtros ou gere resumos nas conversas do helpdesk.
            </p>
          </div>
        </div>
      )}

      {/* Initial state */}
      {!loading && !hasAnalysis && summaryCount !== undefined && summaryCount > 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BrainCircuit className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Pronto para analisar</p>
            <p className="text-sm text-muted-foreground mt-1">
              {summaryCount} conversa{summaryCount !== 1 ? "s" : ""} com resumo disponível
              {summaryCount !== 1 ? "s" : ""} para análise.
              <br />
              Clique em <strong>Gerar Análise</strong> para extrair insights de negócio.
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Use o botão <strong>Gerar Análise</strong> acima para começar.
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="pt-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-full bg-card border-border">
            <CardContent className="pt-5">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
