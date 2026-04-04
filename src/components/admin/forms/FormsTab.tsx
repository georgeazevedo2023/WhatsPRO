import { useState } from 'react'
import {
  FileText,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Inbox as InboxIcon,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { useFormsForAgent, useCreateForm, useUpdateForm, useDeleteForm, useFormWithFields } from '@/hooks/useForms'
import type { WhatsappForm, FormTemplate } from '@/types/forms'
import { FormBuilder } from './FormBuilder'
import { TemplateGallery } from './TemplateGallery'
import { SubmissionsTable } from './SubmissionsTable'

// ─── Props ────────────────────────────────────────────────────────────────────
interface FormsTabProps {
  agentId: string
}

// ─── Status badge helper ──────────────────────────────────────────────────────
const STATUS_LABEL: Record<WhatsappForm['status'], string> = {
  active: 'Ativo',
  draft: 'Rascunho',
  archived: 'Arquivado',
}

const STATUS_CLASS: Record<WhatsappForm['status'], string> = {
  active: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
  draft: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  archived: 'bg-muted text-muted-foreground',
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
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      {/* Topo: título + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-medium text-sm leading-tight truncate">{form.name}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {form.template_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {form.template_type}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${STATUS_CLASS[form.status]}`}
            >
              {STATUS_LABEL[form.status]}
            </Badge>
          </div>
        </div>

        {/* Menu de ações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(form.id)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewSubmissions(form.id)}>
              <TableOfContents className="h-3.5 w-3.5 mr-2" />
              Ver Submissões
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(form)}>
              <Share2 className="h-3.5 w-3.5 mr-2" />
              Compartilhar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

      {/* Descrição */}
      {form.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{form.description}</p>
      )}

      {/* Rodapé */}
      <div className="mt-auto pt-1 text-[10px] text-muted-foreground">
        Criado em {createdAt}
      </div>
    </div>
  )
}

// ─── EditSheetContent ─────────────────────────────────────────────────────────
// Componente separado para carregar o form completo antes de passar ao FormBuilder
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

  // Filtered list
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
      toast.success('Link copiado para a área de transferência!')
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Formulários WhatsApp</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar formulário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={() => setShowTemplateGallery(true)}
            className="gap-1.5"
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

      {/* Template gallery */}
      {showTemplateGallery && (
        <div className="rounded-lg border border-border bg-card p-4">
          <TemplateGallery onSelect={handleSelectTemplate} onBlank={handleBlank} />
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplateGallery(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && !showTemplateGallery && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !showTemplateGallery && filteredForms.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum formulário encontrado' : 'Nenhum formulário criado'}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Crie seu primeiro formulário para coletar dados via WhatsApp.
              </p>
            )}
          </div>
          {!search && (
            <Button
              size="sm"
              variant="outline"
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

      {/* Sheet de edição (FormBuilder) */}
      <Sheet
        open={!!editFormId}
        onOpenChange={(open) => {
          if (!open) setEditFormId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-[90vw] max-w-4xl overflow-y-auto p-0"
        >
          {editFormId && (
            <EditSheetContent
              formId={editFormId}
              onClose={() => setEditFormId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet de submissões */}
      <Sheet
        open={!!viewSubmissionsFormId}
        onOpenChange={(open) => {
          if (!open) setViewSubmissionsFormId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-[90vw] max-w-3xl overflow-y-auto"
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
