import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCampaign, useCampaignMetrics, useCampaignVisits, buildTrackingUrl } from '@/hooks/useCampaigns';
import { CampaignMetrics } from '@/components/campaigns/CampaignMetrics';
import { CampaignLinkPreview } from '@/components/campaigns/CampaignLinkPreview';
import { CampaignQrCode } from '@/components/campaigns/CampaignQrCode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Pencil, Loader2, UserCheck, Clock, Globe } from 'lucide-react';
import { useState } from 'react';

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [visitsPage, setVisitsPage] = useState(0);
  const { data: campaign, isLoading } = useCampaign(id);
  const { data: metrics, isLoading: metricsLoading } = useCampaignMetrics(id);
  const { data: visitsData } = useCampaignVisits(id, visitsPage);
  const visits = visitsData?.rows;
  const hasMoreVisits = visitsData?.hasMore ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-center py-20 text-muted-foreground">Campanha nao encontrada.</div>;
  }

  const trackingUrl = buildTrackingUrl(campaign.slug);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (s: string) => {
    if (s === 'matched') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Convertido</Badge>;
    if (s === 'visited') return <Badge variant="outline" className="text-blue-500 border-blue-500/30">Visitou</Badge>;
    return <Badge variant="secondary">Expirado</Badge>;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/campaigns')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{campaign.utm_source}</span>
              {campaign.utm_medium && <><span>/</span><span>{campaign.utm_medium}</span></>}
              {campaign.utm_campaign && <><span>/</span><span>{campaign.utm_campaign}</span></>}
            </div>
          </div>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link to={`/dashboard/campaigns/${id}/edit`}>
            <Pencil className="w-4 h-4" /> Editar
          </Link>
        </Button>
      </div>

      {/* Metrics */}
      <CampaignMetrics data={metrics} loading={metricsLoading} />

      {/* Link + QR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Link de rastreamento</CardTitle></CardHeader>
          <CardContent>
            <CampaignLinkPreview url={trackingUrl} label="" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">QR Code</CardTitle></CardHeader>
          <CardContent>
            <CampaignQrCode url={trackingUrl} campaignName={campaign.name} size={180} />
          </CardContent>
        </Card>
      </div>

      {/* Recent visits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Data da visita</TableHead>
                <TableHead>Conversao</TableHead>
                <TableHead>Referrer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!visits || visits.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma visita registrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {(visits || []).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>{statusBadge(v.status)}</TableCell>
                  <TableCell>
                    {v.contacts ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={v.contacts.profile_pic_url || undefined} />
                          <AvatarFallback className="text-xs">{(v.contacts.name || v.contacts.phone || '?')[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{v.contacts.name || v.contacts.phone}</div>
                          {v.contacts.name && <div className="text-xs text-muted-foreground">{v.contacts.phone}</div>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(v.visited_at)}</TableCell>
                  <TableCell className="text-sm">{v.matched_at ? formatDate(v.matched_at) : '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {v.referrer || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {((visits || []).length > 0 || visitsPage > 0) && (
            <div className="flex items-center justify-between pt-3 border-t mt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={visitsPage === 0}
                onClick={() => setVisitsPage(p => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">Pagina {visitsPage + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMoreVisits}
                onClick={() => setVisitsPage(p => p + 1)}
              >
                Proxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignDetail;
