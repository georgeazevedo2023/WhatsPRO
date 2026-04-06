import { useState } from 'react'
import {
  FileText,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Loader2,
  Share2,
  Archive,
  ArchiveRestore,
  Trash2,
  TableOfContents,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useFormsForAgent, useCreateForm, useUpdateForm, useDeleteForm, useFormWithFields } from '@/hooks/useForms'
import type { WhatsappForm, FormTemplate } from '@/types/forms'
import { FormBuilder } from './FormBuilder'
import { TemplateGallery } from './TemplateGallery'
import { SubmissionsTable } from './SubmissionsTable'

// ─── Props ────────────────────────────────────────────────────────────────────
interface FormsTabProps {
  agentId: string
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_LABEL: Record<WhatsappForm['status'], string> = {
  active: 'Ativo',
  draft: 'Rascunho',
  archived: 'Arquivado',
}

const STATUS_BADGE_CLASS: Record<WhatsappForm['status'], string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  draft: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  archived: 'bg-muted text-muted-foreground',
}

const STATUS_BORDER: Record<WhatsappForm['status'], string> = {
  active: 'border-l-emerald-500',
  draft: 'border-l-amber-500',
  archived: 'border-l-border',
}

// ─── FormCard ─────────────────────────────────────────────────────────────────
interface FormCardProps {
  form: WhatsappForm
  onEdit: (id: string) => void
  onViewSubmissions: (id: string) => void
  onShare: (form: WhatsappForm) => void
  onToggleStatus: (form: WhatsappForm) => void
  onDelete: (form: WhatsappForm) => void
}

function FormCard({
  form,
  onEdit,
  onViewSubmissions,
  onShare,
  onToggleStatus,
  onDelete,
}: FormCardProps) {
  const createdAt = new Date(form.created_at).toLocaleDateString('pt-BR')

  return (
    <div
      onClick={() => onEdit(form.id)}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border-l-4 border border-border bg-card p-4 cursor-pointer',
        'transition-all duration-200 hover:shadow-md hover:shadow-black/10 hover:border-border/80 active:scale-[0.98]',
        STATUS_BORDER[form.status],
      )}
    >
      {/* Topo: título + status badge */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="font-semibold text-base leading-tight line-clamp-2 pr-2">{form.name}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {form.template_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {form.template_type}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 h-4', STATUS_BADGE_CLASS[form.status])}
          >
            {STATUS_LABEL[form.status]}
          </Badge>
        </div>
      </div>

      {/* Descrição */}
      {form.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{form.description}</p>
      )}

      {/* Rodapé: data + ações */}
      <div
        className="mt-auto flex items-center justify-between pt-2 border-t border-border/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Data */}
        <span className="text-[11px] text-muted-foreground">Criado em {createdAt}</span>

        {/* Action buttons — sempre visíveis (não hover-only) */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(form.id)}
            title="Editar formulário"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => onViewSubmissions(form.id)}
            title="Ver submissões"
          >
            <TableOfContents className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => onShare(form)}
            title="Copiar trigger"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                title="Mais opções"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onToggleStatus(form)}>
                {form.status === 'archived' ? (
                  <>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-2" />
                    Ativar
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5 mr-2" />
                    Arquivar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(form)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

// ─── EditSheetContent ─────────────────────────────────────────────────────────
function EditSheetContent({ formId, onClose }: { formId: string; onClose: () => void }) {
  const { data: form, isLoading } = useFormWithFields(formId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!form) return null

  return <FormBuilder form={form} onClose={onClose} />
}

// ─── FormsTab ─────────────────────────────────────────────────────────────────
export function FormsTab({ agentId }: FormsTabProps) {
  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const [editFormId, setEditFormId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WhatsappForm | null>(null)
  const [search, setSearch] = useState('')
  const [viewSubmissionsFormId, setViewSubmissionsFormId] = useState<string | null>(null)

  const { data: forms = [], isLoading } = useFormsForAgent(agentId)
  const createForm = useCreateForm()
  const updateForm = useUpdateForm()
  const deleteForm = useDeleteForm()

  const filteredForms = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleBlank() {
    try {
      const created = await createForm.mutateAsync({ agentId, name: 'Novo Formulário' })
      setShowTemplateGallery(false)
      setEditFormId(created.id)
    } catch {
      // error handled in hook
    }
  }

  async function handleSelectTemplate(template: FormTemplate) {
    try {
      const created = await createForm.mutateAsync({
        agentId,
        name: template.name,
        templateType: template.type,
        welcomeMessage: template.welcome_message,
        completionMessage: template.completion_message,
        fields: template.fields,
      })
      setShowTemplateGallery(false)
      setEditFormId(created.id)
    } catch {
      // error handled in hook
    }
  }

  function handleShare(form: WhatsappForm) {
    navigator.clipboard.writeText(`FORM:${form.slug}`).then(() => {
      toast.success('Trigger copiado para a área de transferência!')
    })
  }

  function handleToggleStatus(form: WhatsappForm) {
    const nextStatus: WhatsappForm['status'] = form.status === 'archived' ? 'active' : 'archived'
    updateForm.mutate({ id: form.id, agentId, updates: { status: nextStatus } })
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    deleteForm.mutate(
      { id: deleteTarget.id, agentId },
      { onSettled: () => setDeleteTarget(null) },
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Formulários WhatsApp</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar formulário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-full sm:w-52 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={() => setShowTemplateGallery(true)}
            className="gap-1.5 h-9 w-full sm:w-auto"
            disabled={createForm.isPending}
          >
            {createForm.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Novo Formulário
          </Button>
        </div>
      </div>

      {/* Modal: escolha de template */}
      <Dialog open={showTemplateGallery} onOpenChange={setShowTemplateGallery}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[88vh] overflow-y-auto">
          <DialogTitle className="sr-only">Escolha um Template</DialogTitle>
          <TemplateGallery onSelect={handleSelectTemplate} onBlank={handleBlank} />
        </DialogContent>
      </Dialog>

      {/* Loading skeletons */}
      {isLoading && !showTemplateGallery && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !showTemplateGallery && filteredForms.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 border border-border">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum formulário encontrado' : 'Nenhum formulário criado'}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground mt-1">
                Crie seu primeiro formulário para coletar dados via WhatsApp.
              </p>
            )}
          </div>
          {!search && (
            <Button
              size="sm"
              onClick={() => setShowTemplateGallery(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar primeiro formulário
            </Button>
          )}
        </div>
      )}

      {/* Grid de formulários */}
      {!isLoading && filteredForms.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredForms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              onEdit={setEditFormId}
              onViewSubmissions={setViewSubmissionsFormId}
              onShare={handleShare}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Modal: editor de formulário (FormBuilder) */}
      <Dialog
        open={!!editFormId}
        onOpenChange={(open) => {
          if (!open) setEditFormId(null)
        }}
      >
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden [&>button:first-of-type]:hidden">
          <DialogTitle className="sr-only">Editar Formulário</DialogTitle>
          {editFormId && (
            <EditSheetContent
              formId={editFormId}
              onClose={() => setEditFormId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sheet de submissões */}
      <Sheet
        open={!!viewSubmissionsFormId}
        onOpenChange={(open) => {
          if (!open) setViewSubmissionsFormId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-[95vw] max-w-3xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {forms.find((f) => f.id === viewSubmissionsFormId)?.name ?? 'Submissões'}
            </SheetTitle>
          </SheetHeader>
          {viewSubmissionsFormId && (
            <div className="mt-4">
              <SubmissionsTable formId={viewSubmissionsFormId} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong className="text-foreground">{deleteTarget?.name}</strong>? Esta ação não pode
              ser desfeita e todas as submissões serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteForm.isPending}
            >
              {deleteForm.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
