import { useState, useMemo } from 'react';
import { MessageTemplate, useMessageTemplates } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookMarked,
  FileText,
  Image,
  Video,
  Mic,
  FileIcon,
  Trash2,
  Loader2,
  Search,
  X,
  FolderOpen,
  Plus,
  Pencil,
  LayoutGrid,
} from 'lucide-react';

const getMediaIcon = (type: string) => {
  switch (type) {
    case 'image': return <Image className="w-4 h-4" />;
    case 'video': return <Video className="w-4 h-4" />;
    case 'audio': case 'ptt': return <Mic className="w-4 h-4" />;
    case 'document': return <FileIcon className="w-4 h-4" />;
    case 'carousel': return <LayoutGrid className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

const getMediaLabel = (type: string) => {
  switch (type) {
    case 'image': return 'Imagem';
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'ptt': return 'Voz';
    case 'document': return 'Documento';
    case 'carousel': return 'Carrossel';
    default: return 'Texto';
  }
};

const getTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'image': return 'default';
    case 'video': return 'secondary';
    case 'carousel': return 'outline';
    default: return 'secondary';
  }
};

const MessageTemplatesPage = () => {
  const { templates, categories, isLoading, createTemplate, updateTemplate, deleteTemplate } = useMessageTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createNewCategory, setCreateNewCategory] = useState('');
  const [showCreateNewCategory, setShowCreateNewCategory] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Edit dialog
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNewCategory, setEditNewCategory] = useState('');
  const [showEditNewCategory, setShowEditNewCategory] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;
    if (filterCategory === 'uncategorized') {
      filtered = filtered.filter(t => !t.category);
    } else if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.message_type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.content && t.content.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [templates, searchQuery, filterType, filterCategory]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setIsCreating(true);
    const cat = showCreateNewCategory ? createNewCategory.trim() : (createCategory === '__none__' ? '' : createCategory);
    await createTemplate({
      name: createName.trim(),
      content: createContent || undefined,
      message_type: 'text',
      category: cat || undefined,
    });
    setIsCreating(false);
    setShowCreateDialog(false);
    setCreateName('');
    setCreateContent('');
    setCreateCategory('');
    setCreateNewCategory('');
    setShowCreateNewCategory(false);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditContent(template.content || '');
    setEditCategory(template.category || '');
    setEditNewCategory('');
    setShowEditNewCategory(false);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !editName.trim()) return;
    setIsUpdating(true);
    const cat = showEditNewCategory ? editNewCategory.trim() : (editCategory === '__none__' ? '' : editCategory);
    await updateTemplate(editingTemplate.id, {
      name: editName.trim(),
      content: editContent || undefined,
      category: cat || null,
    });
    setIsUpdating(false);
    setEditingTemplate(null);
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    await deleteTemplate(deletingTemplate.id);
    setIsDeleting(false);
    setDeletingTemplate(null);
  };

  const renderCategorySelect = (
    value: string,
    onChange: (v: string) => void,
    showNew: boolean,
    setShowNew: (v: boolean) => void,
    newValue: string,
    setNewValue: (v: string) => void,
  ) => (
    <div className="space-y-2">
      <Label>Categoria (opcional)</Label>
      {!showNew ? (
        <div className="flex gap-2">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => setShowNew(true)} title="Nova categoria">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input placeholder="Nome da nova categoria..." value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <Button type="button" variant="outline" size="icon" onClick={() => { setShowNew(false); setNewValue(''); }} title="Cancelar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookMarked className="w-6 h-6" />
            Templates de Mensagens
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus templates reutilizaveis para disparos
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="uncategorized">Sem categoria</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="ptt">Voz (PTT)</SelectItem>
            <SelectItem value="document">Documento</SelectItem>
            <SelectItem value="carousel">Carrossel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredTemplates.length} de {templates.length} templates</span>
        {categories.length > 0 && <span>{categories.length} categorias</span>}
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookMarked className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum template criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie templates para reutilizar mensagens nos seus disparos
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum template encontrado</h3>
            <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou busca</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="shrink-0 text-muted-foreground">{getMediaIcon(template.message_type)}</div>
                    <h3 className="font-medium truncate">{template.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(template)} title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingTemplate(template)} title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {template.content && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{template.content}</p>
                )}

                {template.media_url && template.message_type === 'image' && (
                  <div className="rounded-md overflow-hidden bg-muted h-32">
                    <img src={template.media_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                {template.message_type === 'carousel' && template.carousel_data && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{(template.carousel_data as any)?.cards?.length || 0} cards</span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getTypeBadgeVariant(template.message_type) as any} className="text-xs">
                    {getMediaLabel(template.message_type)}
                  </Badge>
                  {template.category && (
                    <Badge variant="outline" className="text-xs">
                      <FolderOpen className="w-3 h-3 mr-1" />
                      {template.category}
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {new Date(template.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Template de Texto</DialogTitle>
            <DialogDescription>
              Crie um template reutilizavel. Para templates de midia ou carrossel, salve diretamente do formulario de disparo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nome</Label>
              <Input id="create-name" placeholder="Ex: Boas-vindas, Promocao..." value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-content">Conteudo</Label>
              <Textarea id="create-content" placeholder="Texto da mensagem..." value={createContent} onChange={(e) => setCreateContent(e.target.value)} rows={5} />
            </div>
            {renderCategorySelect(createCategory, setCreateCategory, showCreateNewCategory, setShowCreateNewCategory, createNewCategory, setCreateNewCategory)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || isCreating}>
              {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>Edite o nome, conteudo e categoria do template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            {editingTemplate?.message_type === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="edit-content">Conteudo</Label>
                <Textarea id="edit-content" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} />
              </div>
            )}
            {editingTemplate?.message_type !== 'text' && editingTemplate?.media_url && (
              <div className="space-y-2">
                <Label>URL da Midia</Label>
                <Input value={editingTemplate.media_url} disabled className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">A URL da midia nao pode ser editada.</p>
              </div>
            )}
            {renderCategorySelect(editCategory, setEditCategory, showEditNewCategory, setShowEditNewCategory, editNewCategory, setEditNewCategory)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={!editName.trim() || isUpdating}>
              {isUpdating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{deletingTemplate?.name}" sera excluido permanentemente. Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessageTemplatesPage;
