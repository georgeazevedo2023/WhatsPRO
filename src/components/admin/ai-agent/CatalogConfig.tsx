import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Download, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CsvProductImport } from './CsvProductImport';
import { BatchScrapeImport } from './BatchScrapeImport';
import { CatalogTable } from './CatalogTable';
import { CatalogProductForm } from './CatalogProductForm';

export interface Product {
  id: string; sku: string; title: string; category: string; subcategory: string;
  description: string; price: number; in_stock: boolean; images: string[];
  enabled: boolean; position: number; created_at: string;
}

interface CatalogConfigProps { agentId: string }

export const EMPTY_PRODUCT = { sku: '', title: '', category: '', subcategory: '', description: '', price: 0, in_stock: true, images: [] as string[], enabled: true };
const ACCEPTED_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/jpg'];

export function CatalogConfig({ agentId }: CatalogConfigProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'position' | 'title' | 'price' | 'created_at'>('position');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  };
  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('ai_agent_products').delete().in('id', ids);
        if (error) throw error;
        toast.success(`${ids.length} produto(s) excluído(s)`);
      } else {
        const { error } = await supabase.from('ai_agent_products').update({ enabled: action === 'enable' }).in('id', ids);
        if (error) throw error;
        toast.success(`${ids.length} produto(s) ${action === 'enable' ? 'ativado(s)' : 'desativado(s)'}`);
      }
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err) {
      console.error('[catalog] bulk action failed:', err);
      toast.error('Erro na ação em massa');
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('ai_agent_products').select('*').eq('agent_id', agentId).order('position');
      if (error) console.error('[catalog] fetch error:', error);
      setProducts((data || []) as Product[]);
    } catch (err) {
      console.error('[catalog] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);

  const filtered = useMemo(() => products
    .filter(p => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !(p.sku || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (stockFilter === 'in_stock' && !p.in_stock) return false;
      if (stockFilter === 'out_of_stock' && p.in_stock) return false;
      if (stockFilter === 'disabled' && p.enabled) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title': return a.title.localeCompare(b.title);
        case 'price': return (b.price || 0) - (a.price || 0);
        case 'created_at': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return a.position - b.position;
      }
    }), [products, search, categoryFilter, stockFilter, sortBy]);

  const openNew = () => { setEditing(null); setForm(EMPTY_PRODUCT); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ ...p }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('ai_agent_products').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success('Produto atualizado');
      } else {
        const { error } = await supabase.from('ai_agent_products').insert({ ...form, agent_id: agentId, position: products.length });
        if (error) throw error;
        toast.success('Produto criado');
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (err) { handleError(err, 'Erro ao salvar produto'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('ai_agent_products').delete().eq('id', deleteTarget.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Produto excluído');
    setDeleteOpen(false);
    setDeleteTarget(null);
    fetchProducts();
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          toast.error(`${file.name}: formato não aceito (use webp, png ou jpg)`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: máximo 5MB`);
          continue;
        }
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `catalog/${agentId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('helpdesk-media').upload(path, file, { contentType: file.type });
        if (error) { toast.error(`Erro ao enviar ${file.name}`); continue; }
        const { data } = supabase.storage.from('helpdesk-media').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      if (newUrls.length > 0) {
        setForm(prev => ({ ...prev, images: [...prev.images, ...newUrls] }));
        toast.success(`${newUrls.length} foto${newUrls.length > 1 ? 's' : ''} adicionada${newUrls.length > 1 ? 's' : ''}`);
      }
    } catch (err) { handleError(err, 'Erro ao fazer upload'); }
    finally { setUploading(false); }
  };

  const removeImage = (idx: number) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const setFeaturedImage = (idx: number) => {
    setForm(prev => {
      const imgs = [...prev.images];
      const [featured] = imgs.splice(idx, 1);
      return { ...prev, images: [featured, ...imgs] };
    });
  };

  const hasActiveFilters = search || categoryFilter !== 'all' || stockFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Catálogo de Produtos
            <Badge variant="outline" className="text-[10px] ml-1">{products.length} produto{products.length !== 1 ? 's' : ''}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">Produtos que o agente consulta e envia para o lead</p>
        </div>
        <Button className="gap-1.5" onClick={openNew}>
          <Plus className="w-4 h-4" /> Novo Produto
        </Button>
      </div>

      {/* CSV Import */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
            <Download className="w-3.5 h-3.5" /> Importar Planilha (CSV/Excel)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 p-4 border rounded-lg">
          <CsvProductImport
            agentId={agentId}
            existingProducts={products.map(p => ({ title: p.title, sku: p.sku }))}
            onImported={fetchProducts}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Batch Scraping */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
            <Link2 className="w-3.5 h-3.5" /> Importar de Site (Web Scraping)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 p-4 border rounded-lg">
          <BatchScrapeImport agentId={agentId} onImported={fetchProducts} />
        </CollapsibleContent>
      </Collapsible>

      <CatalogTable
        products={products}
        filtered={filtered}
        loading={loading}
        search={search}
        categoryFilter={categoryFilter}
        stockFilter={stockFilter}
        sortBy={sortBy}
        selectedIds={selectedIds}
        categories={categories}
        hasActiveFilters={!!hasActiveFilters}
        onSearchChange={setSearch}
        onCategoryFilterChange={setCategoryFilter}
        onStockFilterChange={setStockFilter}
        onSortByChange={setSortBy}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onBulkAction={handleBulkAction}
        onEdit={openEdit}
        onDeleteRequest={(p) => { setDeleteTarget(p); setDeleteOpen(true); }}
        onAddNew={openNew}
        onClearFilters={() => { setSearch(''); setCategoryFilter('all'); setStockFilter('all'); }}
      />

      <CatalogProductForm
        agentId={agentId}
        dialogOpen={dialogOpen}
        onDialogOpenChange={setDialogOpen}
        deleteOpen={deleteOpen}
        onDeleteOpenChange={setDeleteOpen}
        deleteTarget={deleteTarget}
        editing={editing}
        form={form}
        saving={saving}
        uploading={uploading}
        onFormChange={setForm}
        onSave={handleSave}
        onDelete={handleDelete}
        onFileUpload={handleFileUpload}
        onRemoveImage={removeImage}
        onSetFeaturedImage={setFeaturedImage}
      />
    </div>
  );
}
