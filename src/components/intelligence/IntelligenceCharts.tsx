import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageCircle,
  Package,
  AlertCircle,
  SmilePlus,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { AnalysisResult } from "./types";
import { SENTIMENT_COLORS, BAR_COLOR, PERIOD_OPTIONS } from "./types";

const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
        <p className="text-muted-foreground mb-1 max-w-[200px] whitespace-normal">{label}</p>
        <p className="font-semibold text-foreground">{payload[0].value} conversa{payload[0].value !== 1 ? "s" : ""}</p>
      </div>
    );
  }
  return null;
};

interface IntelligenceChartsProps {
  analysis: AnalysisResult;
  periodDays: string;
}

export function IntelligenceCharts({ analysis, periodDays }: IntelligenceChartsProps) {
  const sentimentData = [
    { name: "Positivo", value: analysis.sentiment.positive, color: SENTIMENT_COLORS.positive },
    { name: "Neutro", value: analysis.sentiment.neutral, color: SENTIMENT_COLORS.neutral },
    { name: "Negativo", value: analysis.sentiment.negative, color: SENTIMENT_COLORS.negative },
  ].filter((d) => d.value > 0);

  return (
    <>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top reasons chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              Principais motivos de contato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.top_reasons.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={analysis.top_reasons.map((r) => ({
                    name: r.reason.length > 30 ? r.reason.slice(0, 30) + "\u2026" : r.reason,
                    fullName: r.reason,
                    count: r.count,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="count" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment pie */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <SmilePlus className="w-4 h-4 text-primary" />
              Distribuição de sentimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentimentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string) => [`${value}%`, ""]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second charts row: products + objections */}
      {(analysis.top_products.length > 0 || analysis.top_objections.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Products */}
          {analysis.top_products.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  Produtos e serviços mais citados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={analysis.top_products.map((p) => ({
                      name: p.product.length > 25 ? p.product.slice(0, 25) + "\u2026" : p.product,
                      fullName: p.product,
                      count: p.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Objections */}
          {analysis.top_objections.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  Principais objeções dos clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={analysis.top_objections.map((o) => ({
                      name: o.objection.length > 25 ? o.objection.slice(0, 25) + "\u2026" : o.objection,
                      fullName: o.objection,
                      count: o.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Key insights */}
      {analysis.key_insights && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary mb-1.5 uppercase tracking-wider">
                  Insights estratégicos
                </p>
                {(() => {
                  const insights = analysis.key_insights
                    .split(/(?<=[.!?])\s+/)
                    .filter(s => s.trim().length > 5);
                  return insights.length > 1 ? (
                    <ol className="text-sm text-foreground leading-relaxed space-y-1 list-decimal list-inside">
                      {insights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">{analysis.key_insights}</p>
                  );
                })()}
                <p className="text-xs text-muted-foreground mt-3">
                  {analysis.total_available && analysis.total_available > analysis.total_analyzed ? (
                    <>
                      <span className="text-amber-500 font-medium">
                        Analisadas {analysis.total_analyzed} de {analysis.total_available} conversas disponíveis
                      </span>
                      {" \u00B7 "}
                    </>
                  ) : (
                    <>
                      Baseado em {analysis.total_analyzed} conversa{analysis.total_analyzed !== 1 ? "s" : ""} com resumo de IA
                      {" \u00B7 "}
                    </>
                  )}
                  {PERIOD_OPTIONS.find((p) => p.value === periodDays)?.label.toLowerCase()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
