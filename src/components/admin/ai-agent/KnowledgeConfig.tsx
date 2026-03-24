import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, Plus, Pencil, Trash2, HelpCircle, FileText, Loader2, Upload, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';

interface KnowledgeItem {
  id: string; type: string; title: string; content: string; media_url: string | null; metadata: Record<string, any> | null; position: number; created_at: string;
}

interface KnowledgeConfigProps { agentId: string }

const DOC_ACCEPTED = '.pdf,.txt,.doc,.docx';
const DOC_TYPES = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20MB

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(url: string | null) {
  if (!url) return '📄';
  if (url.endsWith('.pdf')) return '📕';
  if (url.endsWith('.doc') || url.endsWith('.docx')) return '📘';
  if (url.endsWith('.txt')) return '📝';
  return '📄';
}

export function KnowledgeConfig({ agentId }: KnowledgeConfigProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [form, setForm] = useState({ type: 'faq', title: '', content: '', media_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('ai_agent_knowledge').select('*').eq('agent_id', agentId).order('position');
    setItems((data || []) as KnowledgeItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [agentId]);

  const openNew = (type = 'faq') => {
    setEditing(null);
    setForm({ type, title: '', content: '', media_url: '' });
    setUploadedFileName('');
    setDialogOpen(true);
  };
  const openEdit = (item: KnowledgeItem) => {
    setEditing(item);
    setForm({ type: item.type, title: item.title, content: item.content || '', media_url: item.media_url || '' });
    setUploadedFileName(item.metadata?.file_name || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    setSaving(true);
    try {
      const saveData = {
        ...form,
        metadata: uploadedFileName ? { file_name: uploadedFileName, file_size: 0 } : null,
      };
      if (editing) {
        await supabase.from('ai_agent_knowledge').update(saveData).eq('id', editing.id);
      } else {
        await supabase.from('ai_agent_knowledge').insert({ ...saveData, agent_id: agentId });
      }
      toast.success(editing ? 'Atualizado' : 'Criado');
      setDialogOpen(false);
      fetchItems();
    } catch (err) { handleError(err, 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('ai_agent_knowledge').delete().eq('id', id);
    toast.success('Removido');
    fetchItems();
  };

  const handleFileUpload = async (file: File) => {
    if (!DOC_TYPES.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      toast.error('Formato não aceito. Use PDF, TXT, DOC ou DOCX.');
      return;
    }
    if (file.size > MAX_DOC_SIZE) {
      toast.error(`Arquivo muito grande (${formatFileSize(file.size)}). Máximo: 20MB.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `knowledge/${agentId}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;

      const { error } = await supabase.storage.from('helpdesk-media').upload(path, file, { contentType: file.type });
      if (error) throw error;

      const { data } = supabase.storage.from('helpdesk-media').getPublicUrl(path);
      setForm(prev => ({ ...prev, media_url: data.publicUrl, title: prev.title || file.name.replace(/\.[^.]+$/, '') }));
      setUploadedFileName(file.name);
      toast.success(`${file.name} enviado!`);
    } catch (err) {
      handleError(err, 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const faqs = items.filter(i => i.type === 'faq');
  const docs = items.filter(i => i.type === 'document');

  return (
    <div className="space-y-6">
      {/* FAQ Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Perguntas Frequentes
            <Badge variant="outline" className="text-[10px]">{faqs.length}</Badge>
          </h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNew('faq')}>
            <Plus className="w-3.5 h-3.5" /> Nova FAQ
          </Button>
        </div>
        {faqs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma FAQ cadastrada</p>
            <p className="text-xs mt-1">Cadastre perguntas frequentes para o agente responder</p>
          </div>
        ) : (
          <div className="space-y-2">
            {faqs.map(item => (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Documents Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Documentos
            <Badge variant="outline" className="text-[10px]">{docs.length}</Badge>
          </h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNew('document')}>
            <Plus className="w-3.5 h-3.5" /> Novo Documento
          </Button>
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum documento cadastrado</p>
            <p className="text-xs mt-1">Faça upload de PDFs, catálogos, manuais para o agente consultar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map(item => (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{getFileIcon(item.media_url)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {item.content && <p className="text-[11px] text-muted-foreground line-clamp-1">{item.content}</p>}
                      {item.metadata?.file_name && (
                        <p className="text-[10px] text-muted-foreground/60 truncate">{item.metadata.file_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {item.media_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={item.media_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} {form.type === 'faq' ? 'FAQ' : 'Documento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{form.type === 'faq' ? 'Pergunta' : 'Título'} *</Label>
              <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={form.type === 'faq' ? 'Qual o horário de funcionamento?' : 'Catálogo 2026'} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{form.type === 'faq' ? 'Resposta' : 'Descrição (opcional)'}</Label>
              <Textarea value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder={form.type === 'faq' ? 'Funcionamos de segunda a sexta, das 8h às 18h.' : 'Descrição do documento...'}
                className="min-h-[80px] resize-none" />
            </div>

            {/* File upload for documents */}
            {form.type === 'document' && (
              <div className="space-y-2">
                <Label className="text-xs">Arquivo</Label>
                <div
                  className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('border-primary')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-primary'); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={DOC_ACCEPTED}
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Enviando...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-1">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Clique ou arraste um arquivo aqui</p>
                      <p className="text-[10px] text-muted-foreground/60">PDF, TXT, DOC, DOCX · Máximo 20MB</p>
                    </div>
                  )}
                </div>

                {/* Uploaded file preview */}
                {(uploadedFileName || form.media_url) && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/50">
                    <span className="text-lg">{getFileIcon(form.media_url)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{uploadedFileName || 'Arquivo'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{form.media_url}</p>
                    </div>
                    {form.media_url && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                        <a href={form.media_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive"
                      onClick={() => { setForm(prev => ({ ...prev, media_url: '' })); setUploadedFileName(''); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
