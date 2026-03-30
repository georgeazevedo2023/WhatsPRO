import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ImageIcon, Loader2, Upload, Star, Sparkles, Trash2, Link2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import type { Product } from './CatalogConfig';

const EMPTY_PRODUCT = { sku: '', title: '', category: '', subcategory: '', description: '', price: 0, in_stock: true, images: [] as string[], enabled: true };
const ACCEPTED_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/jpg'];

interface CatalogProductFormProps {
  agentId: string;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  deleteTarget: Product | null;
  editing: Product | null;
  form: typeof EMPTY_PRODUCT;
  saving: boolean;
  uploading: boolean;
  onFormChange: (updater: (prev: typeof EMPTY_PRODUCT) => typeof EMPTY_PRODUCT) => void;
  onSave: () => void;
  onDelete: () => void;
  onFileUpload: (files: FileList | null) => void;
  onRemoveImage: (idx: number) => void;
  onSetFeaturedImage: (idx: number) => void;
}

export function CatalogProductForm({
  agentId,
  dialogOpen,
  onDialogOpenChange,
  deleteOpen,
  onDeleteOpenChange,
  deleteTarget,
  editing,
  form,
  saving,
  uploading,
  onFormChange,
  onSave,
  onDelete,
  onFileUpload,
  onRemoveImage,
  onSetFeaturedImage,
}: CatalogProductFormProps) {
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) { toast.error('Cole a URL do produto'); return; }
    setImporting(true);
    setImportStatus('Acessando pagina...');
    try {
      setImportStatus('Extraindo dados do produto...');
      console.log('[import] Starting import for:', importUrl.trim());

      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;

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

        const safeStr = (v: unknown): string => {
          if (typeof v === 'string') return v;
          if (v && typeof v === 'object' && 'name' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).name || '');
          return v ? String(v) : '';
        };

        onFormChange(() => ({
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
        }));

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
        onFormChange(prev => ({ ...prev, description: desc.trim() }));
        toast.success('Descrição gerada!');
      } else {
        toast.error('Não foi possível gerar descrição');
      }
    } catch (err) { handleError(err, 'Erro ao gerar descrição'); }
    finally { setGeneratingDesc(false); }
  };

  return (
    <>
      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
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
                <Input
                  value={form.title}
                  onChange={e => onFormChange(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="iPhone 16 Pro Max 256GB Azul"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Input
                  value={form.category}
                  onChange={e => onFormChange(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Celulares"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subcategoria</Label>
                <Input
                  value={form.subcategory}
                  onChange={e => onFormChange(prev => ({ ...prev, subcategory: e.target.value }))}
                  placeholder="Apple"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price || ''}
                  onChange={e => onFormChange(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  placeholder="9999.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU</Label>
                <Input
                  value={form.sku}
                  onChange={e => onFormChange(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="IPH16PM256AZ"
                />
              </div>
            </div>

            {/* Description with AI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Descrição</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-primary"
                  onClick={handleGenerateDescription}
                  disabled={generatingDesc || !form.title.trim()}
                >
                  {generatingDesc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Gerar com IA
                </Button>
              </div>
              <Textarea
                value={form.description}
                onChange={e => onFormChange(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição detalhada do produto..."
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.in_stock}
                  onCheckedChange={v => onFormChange(prev => ({ ...prev, in_stock: v }))}
                />
                <Label className="text-xs">Em estoque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={v => onFormChange(prev => ({ ...prev, enabled: v }))}
                />
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
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); onFileUpload(e.dataTransfer.files); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".webp,.png,.jpg,.jpeg"
                  multiple
                  className="hidden"
                  onChange={e => onFileUpload(e.target.files)}
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
                          <button
                            onClick={() => onSetFeaturedImage(idx)}
                            className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center"
                            title="Definir como destaque"
                          >
                            <Star className="w-3 h-3 text-amber-500" />
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveImage(idx)}
                          className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                          title="Remover"
                        >
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
            <Button variant="outline" onClick={() => onDialogOpenChange(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? 'Salvar Alterações' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>O produto será removido permanentemente do catálogo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
