import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useInstances } from '@/hooks/useInstances';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContactAvatar } from '@/components/helpdesk/ContactAvatar';
import { PageHeader } from '@/components/ui/page-header';
import StatsCard from '@/components/dashboard/StatsCard';
import { Contact2, Search, Loader2, ShieldBan, UserPlus, Target, CheckCircle2, X, ChevronDown, ChevronUp, Clock, Sun } from 'lucide-react';
import { handleError } from '@/lib/errorUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import type { LeadData } from '@/components/leads/types';

const CHART_COLORS = ['hsl(var(--primary))', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const MOTIVO_COLORS: Record<string, string> = { compra: '#10b981', orcamento: '#3b82f6', duvida: '#f59e0b', suporte: '#ec4899', saudacao: '#8b5cf6', informacao: '#06b6d4' };

const Leads = () => {
  const { isSuperAdmin, isGerente } = useAuth();
  const navigate = useNavigate();
  const { instances, loading: instancesLoading } = useInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Auto-select first instance
  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances]);

  const fetchLeads = useCallback(async () => {
    if (!selectedInstanceId) return;
    setLoading(true);
    try {
      const { data: inboxes } = await supabase
        .from('inboxes')
        .select('id')
        .eq('instance_id', selectedInstanceId);
      const inboxIds = (inboxes || []).map(i => i.id);
      if (inboxIds.length === 0) { setLeads([]); setLoading(false); return; }

      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, contact_id, status, tags, last_message, last_message_at, ai_summary, created_at, contacts!inner(id, phone, jid, name, profile_pic_url, created_at, ia_blocked_instances)')
        .in('inbox_id', inboxIds)
        .order('last_message_at', { ascending: false });
      if (error) throw error;

      const contactMap = new Map<string, { contact: any; convs: any[] }>();
      for (const conv of (conversations || [])) {
        const cid = conv.contact_id;
        if (!contactMap.has(cid)) contactMap.set(cid, { contact: conv.contacts, convs: [] });
        contactMap.get(cid)!.convs.push(conv);
      }

      const contactIds = [...contactMap.keys()];
      if (contactIds.length === 0) { setLeads([]); setLoading(false); return; }

      const { data: profiles } = await supabase
        .from('lead_profiles')
        .select('*')
        .in('contact_id', contactIds);
      const profileMap = new Map((profiles || []).map(p => [p.contact_id, p]));

      const allConvIds = (conversations || []).map(c => c.id);
      const { data: convLabels } = await supabase
        .from('conversation_labels')
        .select('conversation_id, labels(name)')
        .in('conversation_id', allConvIds.slice(0, 500));
      const labelMap = new Map<string, Set<string>>();
      for (const cl of (convLabels || [])) {
        const conv = (conversations || []).find(c => c.id === cl.conversation_id);
        if (conv) {
          if (!labelMap.has(conv.contact_id)) labelMap.set(conv.contact_id, new Set());
          if ((cl as any).labels?.name) labelMap.get(conv.contact_id)!.add((cl as any).labels.name);
        }
      }

      const { data: kanbanCards } = await supabase
        .from('kanban_cards')
        .select('contact_id, board_id, kanban_columns(name, color)')
        .in('contact_id', contactIds.slice(0, 500))
        .not('contact_id', 'is', null);
      const kanbanMap = new Map<string, { stage: string; color: string; board_id: string }>();
      for (const kc of (kanbanCards || [])) {
        if (kc.contact_id && (kc as any).kanban_columns) {
          kanbanMap.set(kc.contact_id, {
            stage: (kc as any).kanban_columns.name,
            color: (kc as any).kanban_columns.color,
            board_id: kc.board_id,
          });
        }
      }

      const leadRows: LeadData[] = [];
      for (const [cid, { contact, convs }] of contactMap) {
        const lp = profileMap.get(cid);
        const allTags = [...new Set(convs.flatMap(c => c.tags || []))];
        const labelNames = [...(labelMap.get(cid) || [])];
        const lastConv = convs[0];
        const lastSummary = convs.find(c => c.ai_summary)?.ai_summary;

        leadRows.push({
          contact_id: cid,
          phone: contact.phone,
          jid: contact.jid,
          name: contact.name,
          profile_pic_url: contact.profile_pic_url,
          ia_blocked_instances: contact.ia_blocked_instances || [],
          first_contact_at: contact.created_at,
          display_name: lp?.full_name || contact.name || contact.phone,
          lead_profile: lp || null,
          conversations: convs,
          tags: allTags,
          label_names: labelNames,
          last_contact_at: lastConv?.last_message_at || null,
          last_summary_reason: lastSummary?.reason || null,
          kanban_stage: kanbanMap.get(cid)?.stage || null,
          kanban_color: kanbanMap.get(cid)?.color || null,
          kanban_board_id: kanbanMap.get(cid)?.board_id || null,
        });
      }

      leadRows.sort((a, b) => {
        const da = a.last_contact_at || a.first_contact_at;
        const db = b.last_contact_at || b.first_contact_at;
        return db.localeCompare(da);
      });

      setLeads(leadRows);
    } catch (err) {
      handleError(err, 'Erro ao carregar leads', 'Leads page');
    } finally {
      setLoading(false);
    }
  }, [selectedInstanceId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // KPIs
  const kpis = useMemo(() => {
    const total = leads.length;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const newThisWeek = leads.filter(l => new Date(l.first_contact_at) >= weekAgo).length;
    const newLastWeek = leads.filter(l => { const d = new Date(l.first_contact_at); return d >= twoWeeksAgo && d < weekAgo; }).length;
    const inCRM = leads.filter(l => l.kanban_stage).length;
    const withProfile = leads.filter(l => l.lead_profile?.full_name || l.lead_profile?.email).length;
    const weekTrend = newLastWeek > 0 ? Math.round(((newThisWeek - newLastWeek) / newLastWeek) * 100) : 0;
    return { total, newThisWeek, inCRM, withProfile, weekTrend };
  }, [leads]);

  // Chart data
  const chartData = useMemo(() => {
    // Leads over time (last 30 days)
    const days = 30;
    const now = new Date();
    const timeData: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const count = leads.filter(l => l.first_contact_at.startsWith(key)).length;
      timeData.push({ date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), count });
    }

    // Leads by origin
    const originMap = new Map<string, number>();
    for (const l of leads) {
      const origin = l.lead_profile?.origin || 'Sem origem';
      originMap.set(origin, (originMap.get(origin) || 0) + 1);
    }
    const originData = [...originMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // Leads by motivo (from tags)
    const motivoMap = new Map<string, number>();
    for (const l of leads) {
      const motivoTag = l.tags.find(t => t.startsWith('motivo:'));
      const motivo = motivoTag ? motivoTag.split(':')[1] : 'Sem motivo';
      motivoMap.set(motivo, (motivoMap.get(motivo) || 0) + 1);
    }
    const motivoData = [...motivoMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    // Top interesses (from tags)
    const interesseMap = new Map<string, number>();
    for (const l of leads) {
      for (const tag of l.tags) {
        if (tag.startsWith('interesse:')) {
          const interesse = tag.split(':')[1];
          interesseMap.set(interesse, (interesseMap.get(interesse) || 0) + 1);
        }
      }
    }
    const interesseData = [...interesseMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    // Business hours distribution
    const hoursMap = new Map<string, { comercial: number; fora: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      hoursMap.set(key, { comercial: 0, fora: 0 });
    }
    for (const l of leads) {
      const d = new Date(l.first_contact_at);
      const hour = d.getHours();
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (hoursMap.has(key)) {
        const entry = hoursMap.get(key)!;
        if (hour >= 8 && hour < 18) entry.comercial++;
        else entry.fora++;
      }
    }
    const hoursData = [...hoursMap.entries()].map(([date, v]) => ({ date, ...v }));

    // Summary counts for KPIs (based on last contact time, not first)
    const comercialTotal = leads.filter(l => {
      const d = l.last_contact_at || l.first_contact_at;
      const h = new Date(d).getHours();
      return h >= 8 && h < 18;
    }).length;
    const foraTotal = leads.length - comercialTotal;

    return { timeData, originData, motivoData, interesseData, hoursData, comercialTotal, foraTotal };
  }, [leads]);

  // Filter options (dynamic from data)
  const filterOptions = useMemo(() => {
    const origins = [...new Set(leads.map(l => l.lead_profile?.origin).filter(Boolean))];
    const stages = [...new Set(leads.map(l => l.kanban_stage).filter(Boolean))];
    return { origins, stages };
  }, [leads]);

  // Apply all filters
  const filtered = useMemo(() => {
    let result = leads;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.display_name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Date range
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const since = new Date(); since.setDate(since.getDate() - days);
      result = result.filter(l => new Date(l.first_contact_at) >= since);
    }

    // Origin
    if (originFilter !== 'all') {
      result = result.filter(l => l.lead_profile?.origin === originFilter);
    }

    // Stage
    if (stageFilter !== 'all') {
      result = result.filter(l => l.kanban_stage === stageFilter);
    }

    return result;
  }, [leads, search, dateRange, originFilter, stageFilter]);

  const hasActiveFilters = search || dateRange !== 'all' || originFilter !== 'all' || stageFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setDateRange('all');
    setOriginFilter('all');
    setStageFilter('all');
  };

  if (!isSuperAdmin && !isGerente) return <Navigate to="/dashboard/helpdesk" replace />;

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={Contact2}
        title="Leads"
        color="violet"
        description={`${leads.length} contato${leads.length !== 1 ? 's' : ''} registrado${leads.length !== 1 ? 's' : ''}`}
        action={
          <Select value={selectedInstanceId || ''} onValueChange={setSelectedInstanceId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Selecione a instancia" />
            </SelectTrigger>
            <SelectContent>
              {instances.map(inst => (
                <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* KPIs */}
      {!loading && leads.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatsCard title="Total de Leads" value={kpis.total} icon={Contact2} />
          <StatsCard
            title="Novos esta semana"
            value={kpis.newThisWeek}
            icon={UserPlus}
            trend={kpis.weekTrend !== 0 ? { value: kpis.weekTrend, positive: kpis.weekTrend > 0 } : undefined}
          />
          <StatsCard title="No CRM" value={kpis.inCRM} icon={Target} description={kpis.total > 0 ? `${Math.round((kpis.inCRM / kpis.total) * 100)}%` : undefined} />
          <StatsCard title="Perfil completo" value={kpis.withProfile} icon={CheckCircle2} description={kpis.total > 0 ? `${Math.round((kpis.withProfile / kpis.total) * 100)}%` : undefined} />
          <StatsCard title="Horario comercial" value={chartData.comercialTotal} icon={Sun} description={kpis.total > 0 ? `${Math.round((chartData.comercialTotal / kpis.total) * 100)}%` : undefined} />
          <StatsCard title="Fora do horario" value={chartData.foraTotal} icon={Clock} description={kpis.total > 0 ? `${Math.round((chartData.foraTotal / kpis.total) * 100)}%` : undefined} />
        </div>
      )}

      {/* Charts (collapsible) */}
      {!loading && leads.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground mb-2" onClick={() => setShowCharts(!showCharts)}>
            {showCharts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showCharts ? 'Ocultar graficos' : 'Mostrar graficos'}
          </Button>

          {showCharts && (
            <div className="space-y-4">
              {/* Row 1: Timeline + Origin */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Leads over time */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Leads por dia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={chartData.timeData}>
                        <defs>
                          <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#leadsFill)" strokeWidth={2} name="Leads" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Horario comercial vs fora */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Horario comercial vs fora</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Comercial (8h-18h)', value: chartData.comercialTotal },
                              { name: 'Fora do horario', value: chartData.foraTotal },
                            ]}
                            cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#6366f1" />
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                          <span className="text-sm flex-1">Comercial (8h-18h)</span>
                          <span className="font-bold text-lg">{chartData.comercialTotal}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-indigo-500" />
                          <span className="text-sm flex-1">Fora do horario</span>
                          <span className="font-bold text-lg">{chartData.foraTotal}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Motivos + Interesses + Origem */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Motivos */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Motivos de contato</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.motivoData.length > 0 ? (
                      <div className="space-y-2">
                        {chartData.motivoData.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MOTIVO_COLORS[item.name] || '#8b5cf6' }} />
                            <span className="text-sm flex-1 capitalize">{item.name}</span>
                            <span className="text-sm font-semibold">{item.value}</span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(item.value / leads.length) * 100}%`, backgroundColor: MOTIVO_COLORS[item.name] || '#8b5cf6' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
                    )}
                  </CardContent>
                </Card>

                {/* Interesses */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Top interesses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.interesseData.length > 0 ? (
                      <div className="space-y-2">
                        {chartData.interesseData.map((item, idx) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            <span className="text-sm flex-1 capitalize">{item.name}</span>
                            <span className="text-sm font-semibold">{item.value}</span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(item.value / leads.length) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
                    )}
                  </CardContent>
                </Card>

                {/* Origem */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Leads por origem</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.originData.length > 0 ? (
                      <div className="space-y-2">
                        {chartData.originData.map((item, idx) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            <span className="text-sm flex-1">{item.name}</span>
                            <span className="text-sm font-semibold">{item.value}</span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(item.value / leads.length) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, telefone ou tag..."
                className="pl-9"
              />
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
            {filterOptions.origins.length > 0 && (
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {filterOptions.origins.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filterOptions.stages.length > 0 && (
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estagio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos estagios</SelectItem>
                  {filterOptions.stages.map(s => (
                    <SelectItem key={s!} value={s!}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={clearFilters}>
                <X className="w-3.5 h-3.5" />Limpar
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground mt-2">
              {filtered.length} de {leads.length} leads
            </p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      {loading || instancesLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Contact2 className="w-12 h-12 opacity-30" />
          <p className="text-base">{search ? 'Nenhum lead encontrado para esta busca' : 'Nenhum lead nesta instancia'}</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead className="text-sm">Nome</TableHead>
                <TableHead className="hidden md:table-cell text-sm">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell text-sm">Primeiro Contato</TableHead>
                <TableHead className="hidden sm:table-cell text-sm">Ultimo Contato</TableHead>
                <TableHead className="hidden xl:table-cell text-sm">Tags</TableHead>
                <TableHead className="hidden lg:table-cell text-sm">Etiqueta</TableHead>
                <TableHead className="hidden lg:table-cell text-sm">Estagio</TableHead>
                <TableHead className="hidden xl:table-cell text-sm">Resumo</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(lead => (
                <TableRow
                  key={lead.contact_id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/dashboard/leads/${lead.contact_id}?instance=${selectedInstanceId}`)}
                >
                  <TableCell>
                    <ContactAvatar src={lead.profile_pic_url} name={lead.display_name} size={40} />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-base truncate max-w-[200px]">{lead.display_name}</p>
                      <p className="text-sm text-muted-foreground md:hidden">{lead.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-mono">{lead.phone}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {new Date(lead.first_contact_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                      {lead.tags.slice(0, 4).map(t => {
                        const [key, ...rest] = t.split(':');
                        const val = rest.join(':') || key;
                        const color = key === 'motivo' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : key === 'interesse' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : key === 'ia' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                          : 'bg-muted text-muted-foreground';
                        return (
                          <Badge key={t} variant="outline" className={`text-[11px] px-2 py-0.5 ${color}`}>
                            {val}
                          </Badge>
                        );
                      })}
                      {lead.tags.length > 4 && <Badge variant="secondary" className="text-[11px]">+{lead.tags.length - 4}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {lead.label_names[0] && (
                      <Badge className="text-xs bg-primary/15 text-primary">{lead.label_names[0]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {lead.kanban_stage && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: lead.kanban_color || undefined, color: lead.kanban_color || undefined }}>
                        {lead.kanban_stage}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground truncate max-w-[160px]">
                    {lead.last_summary_reason || '—'}
                  </TableCell>
                  <TableCell>
                    {lead.ia_blocked_instances.length > 0 && (
                      <ShieldBan className="w-4 h-4 text-orange-500" title={`IA bloqueada em ${lead.ia_blocked_instances.length} instancia(s)`} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Leads;
