import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import type { SellerRankData } from '@/hooks/useManagerMetrics';

interface Props {
  sellers: SellerRankData[];
}

const formatMinutes = (minutes: number) => {
  if (minutes === 0) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

export default function SellerRankingChart({ sellers }: Props) {
  const navigate = useNavigate();
  const sellerIds = sellers.map((s) => s.sellerId);
  const { namesMap } = useUserProfiles({ userIds: sellerIds, enabled: sellerIds.length > 0 });

  if (sellers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Ranking Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum dado ainda</p>
        </CardContent>
      </Card>
    );
  }

  const maxConv = sellers[0]?.conversations || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Ranking Vendedores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {sellers.map((seller, idx) => {
          const name = namesMap[seller.sellerId] || seller.sellerName;
          const barPct = Math.round((seller.conversations / maxConv) * 100);

          return (
            <div
              key={seller.sellerId}
              onClick={() => navigate('/dashboard/gestao/vendedor/' + seller.sellerId)}
              className={`flex flex-col gap-1.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors ${
                idx === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-primary w-5 shrink-0">#{idx + 1}</span>
                  <span className="text-sm font-medium truncate">{name}</span>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {seller.resolutionRate}% resolv.
                </Badge>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${Math.max(barPct, 4)}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="w-2.5 h-2.5" />
                  {seller.conversations} conv
                </span>
                <span className="flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {seller.resolved} resolv.
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatMinutes(seller.avgResolutionMin)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
