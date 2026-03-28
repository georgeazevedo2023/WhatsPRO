import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, Plus, Pencil, Trash2, ImageIcon, Loader2, Upload, Star, StarOff, Sparkles, Search, SlidersHorizontal, ArrowUpDown, X, Link2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CsvProductImport } from './CsvProductImport';
import { BatchScrapeImport } from './BatchScrapeImport';

interface Product {
  id: string; sku: string; title: string; category: string; subcategory: string;
  description: string; price: number; in_stock: boolean; images: string[];
  enabled: boolean; position: number; created_at: string;
}

interface CatalogConfigProps { agentId: string }

const EMPTY_PRODUCT = { sku: '', title: '', category: '', subcategory: '', description: '', price: 0, in_stock: true, images: [] as string[], enabled: true };
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
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Unique categories for filter (memoized to avoid recalculating on every render)
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);

  // Filter & sort (memoized — avoids re-filtering on unrelated state changes)
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

  const openNew = () => { setEditing(null); setForm(EMPTY_PRODUCT); setImportUrl(''); setImportOpen(false); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ ...p }); setImportOpen(false); setDialogOpen(true); };

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) { toast.error('Cole a URL do produto'); return; }
    setImporting(true);
    setImportStatus('Acessando pagina...');
    try {
      setImportStatus('Extraindo dados do produto...');
      console.log('[import] Starting import for:', importUrl.trim());

      // Direct fetch bypassing getSession() which can be slow on overloaded servers
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Get cached token from localStorage (faster than getSession RPC)
      const storageKey = `sb-${new URL(baseUrl).hostname.split('.')[0]}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      const token = stored ? JSON.parse(stored)?.access_token : null;

      if (!token) {
        toast.error('Sessao expirada. Faca login novamente.');
        setImporting(false);
        setImportStatus('');
        return;
      }

      console.log('[import] Token OK, fetching...');
      const response = await fetch(`${baseUrl}/functions/v1/scrape-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      const result = await response.json();
      console.log('[import] Result:', result);

      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);

      if (result.product) {
        const p = result.product;
        console.log('[import] Product details:', JSON.stringify(p, null, 2));
        setImportStatus('Preenchendo formulario...');

        // Safely extract string values (edge function may return objects)
        const safeStr = (v: unknown): string => {
          if (typeof v === 'string') return v;
          if (v && typeof v === 'object' && 'name' in (v as Record<string,unknown>)) return String((v as Record<string,unknown>).name || '');
          return v ? String(v) : '';
        };

        // Reset form first, then fill with imported data
        setForm({
          ...EMPTY_PRODUCT,
          title: safeStr(p.title),
          price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
          description: safeStr(p.description) !== safeStr(p.title) ? safeStr(p.description) : '',
          category: safeStr(p.category) || safeStr(p.brand) || '',
          subcategory: safeStr(p.subcategory) || '',
          sku: safeStr(p.sku),
          images: Array.isArray(p.images) ? p.images.filter((i: unknown) => typeof i === 'string') : [],
          in_stock: true,
          enabled: true,
        });

        const fields = [
          p.title && 'titulo',
          p.price && `preco (R$ ${p.price.toFixed(2)})`,
          p.description && p.description !== p.title && 'descricao',
          p.images?.length > 0 && `${p.images.length} foto(s)`,
          (p.category || p.brand) && 'categoria',
          p.sku && 'SKU',
        ].filter(Boolean);

        toast.success(`Importado com sucesso!`, {
          description: `Campos preenchidos: ${fields.join(', ')}. Revise antes de salvar.`,
        });
        setImportOpen(false);
        setImportStatus('');
      } else {
        setImportStatus('');
        toast.error('Nenhum dado encontrado na pagina');
      }
    } catch (err: unknown) {
      console.error('[import] Error:', err);
      setImportStatus('');
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao importar', { description: msg });
    } finally {
      setImporting(false);
    }
  };

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

  // File upload handler
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
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
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

  // AI description generation
  const handleGenerateDescription = async () => {
    if (!form.title.trim()) { toast.error('Preencha o título primeiro'); return; }
    setGeneratingDesc(true);
    try {
      const GEMINI_KEY = await supabase.from('system_settings').select('value').eq('key', 'GEMINI_API_KEY').maybeSingle();
      const apiKey = GEMINI_KEY?.data?.value;
      if (!apiKey) { toast.error('GEMINI_API_KEY não configurada nos secrets'); return; }

      const prompt = `Gere uma descrição comercial curta (2-3 frases) para o seguinte produto de uma loja:
Título: ${form.title}
${form.category ? `Categoria: ${form.category}` : ''}
${form.subcategory ? `Subcategoria: ${form.subcategory}` : ''}
${form.price ? `Preço: R$ ${form.price.toFixed(2)}` : ''}

A descrição deve ser persuasiva, destacar benefícios e ser em português do Brasil. Não use markdown, retorne apenas o texto.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        }),
      });
      const data = await resp.json();
      const desc = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (desc) {
        setForm(prev => ({ ...prev, description: desc.trim() }));
        toast.success('Descrição gerada!');
      } else {
        toast.error('Não foi possível gerar descrição');
      }
    } catch (err) { handleError(err, 'Erro ao gerar descrição'); }
    finally { setGeneratingDesc(false); }
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

      {/* Filters bar */}
      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou SKU..." className="pl-9 h-8 text-xs" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
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
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
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
            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive gap-1" onClick={() => { setSearch(''); setCategoryFilter('all'); setStockFilter('all'); }}>
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Package className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium">Nenhum produto cadastrado</p>
          <p className="text-xs">Adicione produtos para o agente consultar e enviar ao lead</p>
          <Button variant="outline" className="gap-1.5 mt-2" onClick={openNew}><Plus className="w-4 h-4" /> Adicionar Primeiro Produto</Button>
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
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-border" />
              {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : 'Selecionar todos'}
            </label>
            {selectedIds.size > 0 && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleBulkAction('enable')}>Ativar</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleBulkAction('disable')}>Desativar</Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => { if (confirm(`Excluir ${selectedIds.size} produto(s)?`)) handleBulkAction('delete'); }}>Excluir</Button>
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => (
            <Card key={p.id} className={`group overflow-hidden transition-all hover:border-primary/30 ${!p.enabled ? 'opacity-50' : ''} ${selectedIds.has(p.id) ? 'ring-2 ring-primary' : ''}`}>
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
                <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded border-white/50 bg-black/30 w-4 h-4 cursor-pointer" />
                </div>
                {p.images?.length > 1 && (
                  <Badge className="absolute top-2 left-8 bg-black/60 text-white text-[10px] border-0">{p.images.length} fotos</Badge>
                )}
                {!p.in_stock && (
                  <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px]">Sem estoque</Badge>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" className="h-8 gap-1" onClick={() => openEdit(p)}>
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={() => { setDeleteTarget(p); setDeleteOpen(true); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {/* Info */}
              <CardContent className="p-3">
                <p className="text-sm font-semibold truncate">{p.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}</p>
                <div className="flex items-center justify-between mt-2">
                  {p.price > 0 ? (
                    <p className="text-sm font-bold text-primary">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Quick Import — only for new products */}
            {!editing && (
              <Collapsible open={importOpen} onOpenChange={setImportOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 transition-all text-left">
                    <Link2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-primary">Importacao Rapida</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">Cole URL de qualquer site</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={importUrl}
                      onChange={e => setImportUrl(e.target.value)}
                      placeholder="https://www.exemplo.com/produto/..."
                      className="flex-1 text-sm"
                      disabled={importing}
                      onKeyDown={e => e.key === 'Enter' && !importing && handleImportFromUrl()}
                    />
                    <Button
                      onClick={handleImportFromUrl}
                      disabled={importing || !importUrl.trim()}
                      size="sm"
                      className="gap-1.5 shrink-0"
                    >
                      {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Importar
                    </Button>
                  </div>
                  {importing && importStatus ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span className="text-xs text-primary font-medium">{importStatus}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Extrai titulo, preco, descricao e fotos automaticamente. Revise antes de salvar.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Título *</Label>
                <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="iPhone 16 Pro Max 256GB Azul" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Input value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} placeholder="Celulares" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subcategoria</Label>
                <Input value={form.subcategory} onChange={e => setForm(prev => ({ ...prev, subcategory: e.target.value }))} placeholder="Apple" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.price || ''} onChange={e => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} placeholder="9999.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU</Label>
                <Input value={form.sku} onChange={e => setForm(prev => ({ ...prev, sku: e.target.value }))} placeholder="IPH16PM256AZ" />
              </div>
            </div>

            {/* Description with AI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Descrição</Label>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-primary" onClick={handleGenerateDescription} disabled={generatingDesc || !form.title.trim()}>
                  {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Gerar com IA
                </Button>
              </div>
              <Textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Descrição detalhada do produto..." className="min-h-[80px] resize-none" />
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.in_stock} onCheckedChange={v => setForm(prev => ({ ...prev, in_stock: v }))} />
                <Label className="text-xs">Em estoque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.enabled} onCheckedChange={v => setForm(prev => ({ ...prev, enabled: v }))} />
                <Label className="text-xs">Ativo no catálogo</Label>
              </div>
            </div>

            {/* Images — Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Fotos ({form.images.length})
                </Label>
                <p className="text-[10px] text-muted-foreground">Formatos: webp, png, jpg · Máx: 5MB cada</p>
              </div>

              {/* Upload zone */}
              <div
                className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-primary'); }}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); handleFileUpload(e.dataTransfer.files); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".webp,.png,.jpg,.jpeg"
                  multiple
                  className="hidden"
                  onChange={e => handleFileUpload(e.target.files)}
                />
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-1">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Clique ou arraste fotos aqui</p>
                  </div>
                )}
              </div>

              {/* Image grid with reorder + featured + delete */}
              {form.images.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {form.images.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {/* Featured badge */}
                      {idx === 0 && (
                        <div className="absolute top-1 left-1">
                          <Badge className="bg-primary text-primary-foreground text-[8px] px-1 py-0 gap-0.5">
                            <Star className="w-2 h-2" /> Destaque
                          </Badge>
                        </div>
                      )}
                      {/* Actions overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {idx !== 0 && (
                          <button onClick={() => setFeaturedImage(idx)} className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center" title="Definir como destaque">
                            <Star className="w-3 h-3 text-amber-500" />
                          </button>
                        )}
                        <button onClick={() => removeImage(idx)} className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center" title="Remover">
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Salvar Alterações' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>O produto será removido permanentemente do catálogo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
