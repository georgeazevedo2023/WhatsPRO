import { Search, ImageIcon, Loader2, Package, Plus, Pencil, Trash2, ArrowUpDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Product } from './CatalogConfig';

interface CatalogTableProps {
  products: Product[];
  filtered: Product[];
  loading: boolean;
  search: string;
  categoryFilter: string;
  stockFilter: string;
  sortBy: 'position' | 'title' | 'price' | 'created_at';
  selectedIds: Set<string>;
  categories: string[];
  hasActiveFilters: boolean;
  onSearchChange: (v: string) => void;
  onCategoryFilterChange: (v: string) => void;
  onStockFilterChange: (v: string) => void;
  onSortByChange: (v: 'position' | 'title' | 'price' | 'created_at') => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkAction: (action: 'enable' | 'disable' | 'delete') => void;
  onEdit: (p: Product) => void;
  onDeleteRequest: (p: Product) => void;
  onAddNew: () => void;
  onClearFilters: () => void;
}

export function CatalogTable({
  products,
  filtered,
  loading,
  search,
  categoryFilter,
  stockFilter,
  sortBy,
  selectedIds,
  categories,
  hasActiveFilters,
  onSearchChange,
  onCategoryFilterChange,
  onStockFilterChange,
  onSortByChange,
  onToggleSelect,
  onToggleSelectAll,
  onBulkAction,
  onEdit,
  onDeleteRequest,
  onAddNew,
  onClearFilters,
}: CatalogTableProps) {
  return (
    <>
      {/* Filters bar */}
      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              className="pl-9 h-8 text-xs"
            />
          </div>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={onStockFilterChange}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Estoque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in_stock">Em estoque</SelectItem>
              <SelectItem value="out_of_stock">Sem estoque</SelectItem>
              <SelectItem value="disabled">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: string) => onSortByChange(v as 'position' | 'title' | 'price' | 'created_at')}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <ArrowUpDown className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="position">Posição</SelectItem>
              <SelectItem value="title">Nome A-Z</SelectItem>
              <SelectItem value="price">Maior preço</SelectItem>
              <SelectItem value="created_at">Mais recente</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive gap-1"
              onClick={onClearFilters}
            >
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Package className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium">Nenhum produto cadastrado</p>
          <p className="text-xs">Adicione produtos para o agente consultar e enviar ao lead</p>
          <Button variant="outline" className="gap-1.5 mt-2" onClick={onAddNew}>
            <Plus className="w-4 h-4" /> Adicionar Primeiro Produto
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum produto encontrado com estes filtros</p>
        </div>
      ) : (
        <>
          {/* Bulk actions bar */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={onToggleSelectAll}
                  className="rounded border-border"
                />
                {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : 'Selecionar todos'}
              </label>
              {selectedIds.size > 0 && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => onBulkAction('enable')}>
                    Ativar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => onBulkAction('disable')}>
                    Desativar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs gap-1"
                    onClick={() => { if (confirm(`Excluir ${selectedIds.size} produto(s)?`)) onBulkAction('delete'); }}
                  >
                    Excluir
                  </Button>
                </>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <Card
                key={p.id}
                className={`group overflow-hidden transition-all hover:border-primary/30 ${!p.enabled ? 'opacity-50' : ''} ${selectedIds.has(p.id) ? 'ring-2 ring-primary' : ''}`}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Selection checkbox */}
                  <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => onToggleSelect(p.id)}
                      className="rounded border-white/50 bg-black/30 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {p.images?.length > 1 && (
                    <Badge className="absolute top-2 left-8 bg-black/60 text-white text-[10px] border-0">
                      {p.images.length} fotos
                    </Badge>
                  )}
                  {!p.in_stock && (
                    <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px]">
                      Sem estoque
                    </Badge>
                  )}
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => onEdit(p)}>
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={() => onDeleteRequest(p)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {/* Info */}
                <CardContent className="p-3">
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    {p.price > 0 ? (
                      <p className="text-sm font-bold text-primary">
                        R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sob consulta</p>
                    )}
                    {p.sku && <Badge variant="outline" className="text-[9px]">{p.sku}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
