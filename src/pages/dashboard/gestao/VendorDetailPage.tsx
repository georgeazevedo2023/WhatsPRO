// M19 S4: Ficha do Vendedor
// Rota: /dashboard/gestao/vendedor/:sellerId
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ManagerFilters, { type ManagerFiltersState } from '@/components/manager/ManagerFilters';
import LazySection from '@/components/dashboard/LazySection';
import VendorKPICards from '@/components/gestao/VendorKPICards';
import VendorTrendChart from '@/components/gestao/VendorTrendChart';
import { useManagerInstances } from '@/hooks/useManagerInstances';
import { useVendorDetail } from '@/hooks/useVendorDetail';
import { useUserProfiles } from '@/hooks/useUserProfiles';

export default function VendorDetailPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();

  const { data: instances = [] } = useManagerInstances();

  const [filters, setFilters] = useState<ManagerFiltersState>({
    instanceId: null,
    periodDays: 30,
  });

  // Auto-seleciona primeira instância se nenhuma foi escolhida
  const effectiveInstanceId = filters.instanceId ?? (instances[0]?.id ?? null);

  const filtersDisplay: ManagerFiltersState = {
    ...filters,
    instanceId: effectiveInstanceId,
  };

  const { data: vendorData, isLoading, refetch } = useVendorDetail(
    sellerId ?? null,
    effectiveInstanceId,
    filters.periodDays,
  );

  // Busca nome do vendedor
  const { namesMap } = useUserProfiles({
    userIds: sellerId ? [sellerId] : [],
    enabled: !!sellerId,
  });
  const vendorName = (sellerId && namesMap[sellerId]) ? namesMap[sellerId] : (sellerId?.slice(0, 8) ?? 'Vendedor');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">Ficha: {vendorName}</h1>
            <p className="text-xs text-muted-foreground">
              Métricas individuais do vendedor
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Filtros */}
      <ManagerFilters
        instances={instances}
        filters={filtersDisplay}
        onFiltersChange={setFilters}
      />

      {/* Estado: sem instância */}
      {!effectiveInstanceId && (
        <div className="text-center py-20 text-muted-foreground">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecione uma instância para ver as métricas</p>
          <p className="text-xs mt-1 opacity-60">As métricas são calculadas por instância</p>
        </div>
      )}

      {effectiveInstanceId && (
        <>
          {/* KPI Cards */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : vendorData ? (
            <VendorKPICards kpis={vendorData.kpis} periodDays={filters.periodDays} />
          ) : null}

          {/* Gráfico de evolução diária */}
          <LazySection height="260px">
            {vendorData ? (
              <VendorTrendChart data={vendorData.trend} />
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            )}
          </LazySection>
        </>
      )}
    </div>
  );
}
