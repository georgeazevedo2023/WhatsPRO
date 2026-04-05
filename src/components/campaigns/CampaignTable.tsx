import { Link } from 'react-router-dom';
import type { UtmCampaignWithMetrics } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Pencil, Trash2, Pause, Play, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUpdateCampaign, useDeleteCampaign, useCreateCampaign, generateSlug } from '@/hooks/useCampaigns';

interface CampaignTableProps {
  campaigns: UtmCampaignWithMetrics[];
}

const statusBadge = (status: string) => {
  if (status === 'active') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativa</Badge>;
  if (status === 'paused') return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Pausada</Badge>;
  return <Badge variant="secondary">Arquivada</Badge>;
};

const typeBadge = (type: string) => {
  const map: Record<string, string> = {
    venda: 'Vendas',
    suporte: 'Suporte',
    promocao: 'Promocao',
    evento: 'Evento',
    recall: 'Re-engajamento',
    fidelizacao: 'Fidelizacao',
  };
  return <Badge variant="outline" className="text-xs">{map[type] || type}</Badge>;
};

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateCampaign();
  const deleteMutation = useDeleteCampaign();
  const cloneMutation = useCreateCampaign();

  const toggleStatus = (c: UtmCampaignWithMetrics) => {
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ id: c.id, status: newStatus });
  };

  const cloneCampaign = async (c: UtmCampaignWithMetrics) => {
    const clone = {
      name: `${c.name} (copia)`,
      slug: generateSlug(`${c.name} copia`),
      instance_id: c.instance_id,
      created_by: c.created_by,
      utm_source: c.utm_source,
      utm_medium: c.utm_medium,
      utm_campaign: c.utm_campaign,
      destination_phone: c.destination_phone,
      welcome_message: c.welcome_message,
      campaign_type: c.campaign_type,
      ai_template: c.ai_template,
      ai_custom_text: c.ai_custom_text,
      status: 'paused' as const,
      starts_at: null,
      expires_at: null,
    };
    const result = await cloneMutation.mutateAsync(clone);
    if (result?.id) navigate(`/dashboard/campaigns/${result.id}/edit`);
  };

  const actionMenu = (c: UtmCampaignWithMetrics) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/dashboard/campaigns/${c.id}`}>
            <Eye className="w-4 h-4 mr-2" /> Ver detalhes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/dashboard/campaigns/${c.id}/edit`}>
            <Pencil className="w-4 h-4 mr-2" /> Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleStatus(c)}>
          {c.status === 'active' ? (
            <><Pause className="w-4 h-4 mr-2" /> Pausar</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Ativar</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => cloneCampaign(c)}>
          <Copy className="w-4 h-4 mr-2" /> Clonar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => { if (confirm('Excluir esta campanha?')) deleteMutation.mutate(c.id); }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div>
      {/* ── Desktop table (sm+) ── */}
      <div className="hidden sm:block rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Instancia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-center">Visitas</TableHead>
              <TableHead className="text-center">Conversoes</TableHead>
              <TableHead className="text-center">Taxa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhuma campanha criada ainda.
                </TableCell>
              </TableRow>
            )}
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/dashboard/campaigns/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{c.slug}</div>
                </TableCell>
                <TableCell className="text-sm">{c.instance_name || '-'}</TableCell>
                <TableCell>{typeBadge(c.campaign_type)}</TableCell>
                <TableCell className="text-sm">{c.utm_source || '-'}</TableCell>
                <TableCell className="text-center font-medium">{c.total_visits}</TableCell>
                <TableCell className="text-center font-medium">{c.total_conversions}</TableCell>
                <TableCell className="text-center">
                  <span className={c.conversion_rate > 20 ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                    {c.conversion_rate}%
                  </span>
                </TableCell>
                <TableCell>{statusBadge(c.status)}</TableCell>
                <TableCell>{actionMenu(c)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile cards (xs) ── */}
      <div className="sm:hidden space-y-3">
        {campaigns.length === 0 && (
          <div className="text-center text-muted-foreground py-10 text-sm rounded-lg border bg-card">
            Nenhuma campanha criada ainda.
          </div>
        )}
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-lg border bg-card p-4 active:scale-[0.99] transition-transform">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/dashboard/campaigns/${c.id}`}
                  className="font-semibold text-sm hover:underline block truncate"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.slug}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {typeBadge(c.campaign_type)}
                  {c.utm_source && (
                    <span className="text-[10px] text-muted-foreground">{c.utm_source}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {statusBadge(c.status)}
                {actionMenu(c)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Visitas</p>
                <p className="font-semibold text-sm mt-0.5">{c.total_visits}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Conversões</p>
                <p className="font-semibold text-sm mt-0.5">{c.total_conversions}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Taxa</p>
                <p className={`font-semibold text-sm mt-0.5 ${c.conversion_rate > 20 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  {c.conversion_rate}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
