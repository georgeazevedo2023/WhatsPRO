import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, UserCheck, Percent, Clock, FileText, FileCheck, FileX, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MetricsData {
  total_visits: number;
  total_conversions: number;
  total_expired: number;
  conversion_rate: number;
  daily: { date: string; visits: number; conversions: number }[];
  // Form abandonment metrics
  form_started?: number;
  form_completed?: number;
  form_abandoned?: number;
  form_completion_rate?: number;
}

interface CampaignMetricsProps {
  data: MetricsData | null | undefined;
  loading?: boolean;
}

export function CampaignMetrics({ data, loading }: CampaignMetricsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-16 bg-muted/50 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    { label: 'Visitas', value: data.total_visits, icon: Eye, color: 'text-blue-500' },
    { label: 'Conversoes', value: data.total_conversions, icon: UserCheck, color: 'text-emerald-500' },
    { label: 'Taxa de conversao', value: `${data.conversion_rate}%`, icon: Percent, color: 'text-purple-500' },
    { label: 'Expirados', value: data.total_expired, icon: Clock, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted/50 ${k.color}`}>
                  <k.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(data.form_started ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formulario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Iniciaram', value: data.form_started ?? 0, icon: FileText, color: 'text-blue-500' },
                { label: 'Completaram', value: data.form_completed ?? 0, icon: FileCheck, color: 'text-emerald-500' },
                { label: 'Abandonaram', value: data.form_abandoned ?? 0, icon: FileX, color: 'text-orange-500' },
                { label: 'Taxa conclusao', value: `${data.form_completion_rate ?? 0}%`, icon: Activity, color: 'text-purple-500' },
              ].map(k => (
                <div key={k.label} className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted/50 ${k.color}`}>
                    <k.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{k.value}</p>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.daily.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitas e conversoes por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const [, m, day] = d.split('-');
                    return `${day}/${m}`;
                  }}
                  className="text-xs"
                />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  labelFormatter={(d: string) => {
                    const [y, m, day] = d.split('-');
                    return `${day}/${m}/${y}`;
                  }}
                />
                <Area type="monotone" dataKey="visits" name="Visitas" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                <Area type="monotone" dataKey="conversions" name="Conversoes" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
