import React, { useState } from 'react'
import { Inbox, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useFormSubmissions, useFormStats } from '@/hooks/useFormSubmissions'
import type { FormSubmission } from '@/types/forms'

// ─── Props ────────────────────────────────────────────────────────────────────
interface SubmissionsTableProps {
  formId: string
}

// ─── exportToCSV ──────────────────────────────────────────────────────────────
function exportToCSV(submissions: FormSubmission[], formId: string) {
  if (submissions.length === 0) return
  const allKeys = [...new Set(submissions.flatMap((s) => Object.keys(s.data)))]
  const header = ['Data', ...allKeys].join(',')
  const rows = submissions.map((s) =>
    [
      new Date(s.submitted_at).toLocaleString('pt-BR'),
      ...allKeys.map((k) => JSON.stringify(s.data[k] ?? '')),
    ].join(','),
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `submissoes_${formId}_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── DataPreview ──────────────────────────────────────────────────────────────
// Exibe os 2 primeiros campos no formato key: value
function DataPreview({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).slice(0, 2)
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="text-xs text-muted-foreground">
      {entries.map(([k, v]) => `${k}: ${String(v ?? '')}`).join(' · ')}
    </span>
  )
}

// ─── ExpandedData ─────────────────────────────────────────────────────────────
function ExpandedData({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <p className="text-xs text-muted-foreground px-4 py-2">Sem dados.</p>
  return (
    <table className="w-full text-xs">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-border last:border-0">
            <td className="py-1.5 pr-4 font-medium text-muted-foreground w-1/3 pl-4 align-top">{k}</td>
            <td className="py-1.5 pr-4 break-all">{String(v ?? '—')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── SubmissionsTable ─────────────────────────────────────────────────────────
export function SubmissionsTable({ formId }: SubmissionsTableProps) {
  const { data: submissions = [], isLoading } = useFormSubmissions(formId)
  const { data: stats } = useFormStats(formId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Submissões</h3>
          {stats && (
            <>
              <Badge variant="secondary">{stats.total} total</Badge>
              <Badge variant="outline">hoje: {stats.today}</Badge>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(submissions, formId)}
          disabled={submissions.length === 0}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && submissions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma submissão ainda</p>
        </div>
      )}

      {/* Tabela */}
      {!isLoading && submissions.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Data/Hora</TableHead>
                <TableHead>Dados</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => {
                const isExpanded = expandedId === submission.id
                return (
                  <React.Fragment key={submission.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(submission.id)}
                    >
                      {/* Chevron */}
                      <TableCell className="pr-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </TableCell>

                      {/* Data/Hora */}
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(submission.submitted_at).toLocaleString('pt-BR')}
                      </TableCell>

                      {/* Preview dos dados */}
                      <TableCell>
                        <DataPreview data={submission.data} />
                      </TableCell>

                      {/* Ações */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            exportToCSV([submission], formId)
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Linha expandida */}
                    {isExpanded && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4} className="p-0">
                          <ExpandedData data={submission.data} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
