import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BookmarkPlus, 
  FileText, 
  Image, 
  Video, 
  Mic, 
  FileIcon, 
  ChevronDown, 
  Trash2, 
  Loader2,
  BookMarked,
  Search,
  X,
  FolderOpen,
  Plus,
  Pencil
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MessageTemplate, useMessageTemplates } from '@/hooks/useMessageTemplates';
import type { CarouselData } from './CarouselEditor';

type TemplateData = { 
  name: string; 
  content?: string; 
  message_type: string; 
  media_url?: string; 
  filename?: string;
  carousel_data?: CarouselData;
} | null;

interface TemplateSelectorProps {
  onSelect: (template: MessageTemplate) => void;
  onSave: () => TemplateData | Promise<TemplateData>;
  disabled?: boolean;
}

const getMediaIcon = (type: string) => {
  switch (type) {
    case 'image':
      return <Image className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'audio':
    case 'ptt':
      return <Mic className="w-4 h-4" />;
    case 'document':
      return <FileIcon className="w-4 h-4" />;
    case 'carousel':
      return <FolderOpen className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

const getMediaLabel = (type: string) => {
  switch (type) {
    case 'image':
      return 'Imagem';
    case 'video':
      return 'Vídeo';
    case 'audio':
      return 'Áudio';
    case 'ptt':
      return 'Voz';
    case 'document':
      return 'Documento';
    case 'carousel':
      return 'Carrossel';
    default:
      return 'Texto';
  }
};

export function TemplateSelector({ onSelect, onSave, disabled }: TemplateSelectorProps) {
  const { templates, categories, isLoading, createTemplate, deleteTemplate, updateTemplate } = useMessageTemplates();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['uncategorized']));
  
  // Edit state
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNewCategory, setEditNewCategory] = useState('');
  const [showEditNewCategory, setShowEditNewCategory] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by category
    if (filterCategory === 'uncategorized') {
      filtered = filtered.filter(t => !t.category);
    } else if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }

    // Filter by type
    if (filterType === 'text') {
      filtered = filtered.filter(t => t.message_type === 'text');
    } else if (filterType === 'media') {
      filtered = filtered.filter(t => t.message_type !== 'text');
    } else if (filterType !== 'all') {
      filtered = filtered.filter(t => t.message_type === filterType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        (t.content && t.content.toLowerCase().includes(query)) ||
        (t.category && t.category.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [templates, searchQuery, filterType, filterCategory]);

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, typeof filteredTemplates> = {};
    
    filteredTemplates.forEach(template => {
      const category = template.category || 'Sem categoria';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(template);
    });

    // Sort categories alphabetically, but keep "Sem categoria" at the end
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Sem categoria') return 1;
      if (b === 'Sem categoria') return -1;
      return a.localeCompare(b);
    });

    return { groups, sortedKeys };
  }, [filteredTemplates]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;

    setIsSaving(true);
    const templateData = await Promise.resolve(onSave());
    if (!templateData) {
      setIsSaving(false);
      return;
    }

    const finalCategory = showNewCategory ? newCategoryName.trim() : (templateCategory === '__none__' ? '' : templateCategory);

    const result = await createTemplate({
      ...templateData,
      name: templateName.trim(),
      category: finalCategory || undefined,
    });
    setIsSaving(false);

    if (result) {
      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateCategory('');
      setNewCategoryName('');
      setShowNewCategory(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await deleteTemplate(id);
    setDeletingId(null);
  };

  const handleEdit = (e: React.MouseEvent, template: MessageTemplate) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setEditName(template.name);
    setEditContent(template.content || '');
    setEditCategory(template.category || '');
    setEditNewCategory('');
    setShowEditNewCategory(false);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !editName.trim()) return;

    const finalCategory = showEditNewCategory ? editNewCategory.trim() : (editCategory === '__none__' ? '' : editCategory);

    setIsUpdating(true);
    const success = await updateTemplate(editingTemplate.id, {
      name: editName.trim(),
      content: editContent || undefined,
      category: finalCategory || null,
    });
    setIsUpdating(false);

    if (success) {
      setEditingTemplate(null);
      setEditName('');
      setEditContent('');
      setEditCategory('');
      setEditNewCategory('');
      setShowEditNewCategory(false);
    }
  };

  const renderTemplateItem = (template: typeof templates[0]) => (
    <DropdownMenuItem
      key={template.id}
      onClick={() => onSelect(template)}
      className="flex items-center justify-between group pl-6"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getMediaIcon(template.message_type)}
        <span className="truncate">{template.name}</span>
        {template.message_type !== 'text' && (
          <span className="text-xs text-muted-foreground">
            ({getMediaLabel(template.message_type)})
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => handleEdit(e, template)}
          title="Editar template"
        >
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => handleDelete(e, template.id)}
          disabled={deletingId === template.id}
          title="Excluir template"
        >
          {deletingId === template.id ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3 text-destructive" />
          )}
        </Button>
      </div>
    </DropdownMenuItem>
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled || isLoading}>
              <BookMarked className="w-4 h-4 mr-2" />
              Templates
              {templates.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({templates.length})</span>
              )}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {/* Category Filter */}
            <div className="p-2 space-y-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 h-8 text-sm"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-8 text-sm flex-1">
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
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos tipos</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="media">Mídia</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="ptt">Voz (PTT)</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum template salvo
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum template encontrado
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                {groupedTemplates.sortedKeys.map((category) => (
                  <Collapsible
                    key={category}
                    open={expandedCategories.has(category)}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between px-2 py-1.5 hover:bg-accent cursor-pointer">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FolderOpen className="w-4 h-4 text-muted-foreground" />
                          <span>{category}</span>
                          <span className="text-xs text-muted-foreground">
                            ({groupedTemplates.groups[category].length})
                          </span>
                        </div>
                        <ChevronDown 
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            expandedCategories.has(category) ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {groupedTemplates.groups[category].map(renderTemplateItem)}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSaveDialog(true)}
          disabled={disabled}
          title="Salvar como template"
        >
          <BookmarkPlus className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar como Template</DialogTitle>
            <DialogDescription>
              Dê um nome e categoria para este template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do template</Label>
              <Input
                id="template-name"
                placeholder="Ex: Boas-vindas, Promoção..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria (opcional)</Label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <Select value={templateCategory} onValueChange={setTemplateCategory}>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewCategory(true)}
                    title="Criar nova categoria"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da nova categoria..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setShowNewCategory(false);
                      setNewCategoryName('');
                    }}
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!templateName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Edite o nome, conteúdo e categoria do template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-template-name">Nome do template</Label>
              <Input
                id="edit-template-name"
                placeholder="Ex: Boas-vindas, Promoção..."
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            {editingTemplate?.message_type === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="edit-template-content">Conteúdo</Label>
                <Textarea
                  id="edit-template-content"
                  placeholder="Texto da mensagem..."
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                />
              </div>
            )}
            {editingTemplate?.message_type !== 'text' && editingTemplate?.media_url && (
              <div className="space-y-2">
                <Label>URL da Mídia</Label>
                <Input
                  value={editingTemplate.media_url}
                  disabled
                  className="text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  A URL da mídia não pode ser editada. Crie um novo template se precisar alterar.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Categoria</Label>
              {!showEditNewCategory ? (
                <div className="flex gap-2">
                  <Select value={editCategory} onValueChange={setEditCategory}>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowEditNewCategory(true)}
                    title="Criar nova categoria"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da nova categoria..."
                    value={editNewCategory}
                    onChange={(e) => setEditNewCategory(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setShowEditNewCategory(false);
                      setEditNewCategory('');
                    }}
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!editName.trim() || isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
