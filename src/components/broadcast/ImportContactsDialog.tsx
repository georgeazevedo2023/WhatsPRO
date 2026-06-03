import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ClipboardPaste, FileSpreadsheet, Contact, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';
import { jidToDigits } from '@/lib/phoneUtils';
import { useInstances } from '@/hooks/useInstances';
import PasteTab from './lead-importer/PasteTab';
import CsvTab from './lead-importer/CsvTab';
import VcfTab from './lead-importer/VcfTab';
import GroupsTab from './lead-importer/GroupsTab';
import type { LeadDatabase } from './leadDatabaseTypes';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: LeadDatabase | null;
  /** Telefones já presentes na base (qualquer formato) — usados para dedup. */
  existingPhones: string[];
  /** Chamado após uma importação bem-sucedida (o pai recarrega a lista + contador). */
  onImported: () => void;
}

const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');

const ImportContactsDialog = ({ open, onOpenChange, database, existingPhones, onImported }: ImportContactsDialogProps) => {
  const { instances } = useInstances();
  const [activeTab, setActiveTab] = useState<'paste' | 'csv' | 'vcf' | 'groups'>('paste');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // Instância para a aba Grupos: a vinculada à base, ou uma escolhida pelo usuário.
  const linkedInstance = database?.instance_id
    ? instances?.find((i) => i.id === database.instance_id)
    : undefined;
  const groupsInstance = linkedInstance || instances?.find((i) => i.id === selectedInstanceId);

  const handleImport = async (leads: Lead[]) => {
    if (!database || leads.length === 0) return;
    setImporting(true);
    try {
      // Telefone sempre como dígitos (derivado do jid) — casa com o resto da base
      // e é pré-requisito da UNIQUE (database_id, phone). Dedup normalizada por dígitos.
      const existing = new Set(existingPhones.map(onlyDigits).filter(Boolean));
      const byPhone = new Map<string, Record<string, unknown>>();

      for (const l of leads) {
        const phone = jidToDigits(l.jid);
        if (phone.length < 10) continue;
        if (existing.has(phone) || byPhone.has(phone)) continue;
        byPhone.set(phone, {
          database_id: database.id,
          phone,
          jid: l.jid,
          name: l.name || null,
          source: l.source,
          group_name: l.groupName || null,
          is_verified: false,
        });
      }

      const rows = Array.from(byPhone.values());
      const skipped = leads.length - rows.length;

      if (rows.length === 0) {
        toast.info('Nenhum contato novo — todos já estavam na base.');
        return;
      }

      const { error } = await supabase
        .from('lead_database_entries')
        .upsert(rows, { onConflict: 'database_id,phone', ignoreDuplicates: true });
      if (error) throw error;

      // Recontagem autoritativa via UPDATE direto (authenticated tem permissão via RLS).
      // NÃO usar a RPC recalc_lead_database_count: ela é service-only (REVOKE de
      // authenticated na migration v7.69.0) e dá 403 a partir do frontend.
      const { count } = await supabase
        .from('lead_database_entries')
        .select('*', { count: 'exact', head: true })
        .eq('database_id', database.id);
      if (count !== null) {
        await supabase.from('lead_databases').update({ leads_count: count }).eq('id', database.id);
      }

      toast.success(
        `${rows.length} contato${rows.length !== 1 ? 's' : ''} adicionado${rows.length !== 1 ? 's' : ''} à base` +
          (skipped > 0 ? ` (${skipped} já existia${skipped !== 1 ? 'm' : ''})` : ''),
      );
      onImported();
    } catch (e) {
      handleError(e, 'Erro ao importar contatos', 'ImportContacts');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar contatos em massa</DialogTitle>
          <DialogDescription>
            Adicione vários contatos de uma vez à base <strong>{database?.name}</strong>. Telefones já existentes são ignorados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className={importing ? 'pointer-events-none opacity-60' : ''}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'csv' | 'vcf' | 'groups')}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="paste" className="gap-2">
                <ClipboardPaste className="w-4 h-4" />
                <span className="hidden sm:inline">Colar Lista</span>
                <span className="sm:hidden">Lista</span>
              </TabsTrigger>
              <TabsTrigger value="csv" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV</span>
              </TabsTrigger>
              <TabsTrigger value="vcf" className="gap-2">
                <Contact className="w-4 h-4" />
                <span>vCard</span>
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <Users className="w-4 h-4" />
                <span>Grupos</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="paste">
                <PasteTab onLeadsImported={handleImport} />
              </TabsContent>

              <TabsContent value="csv">
                <CsvTab onLeadsImported={handleImport} />
              </TabsContent>

              <TabsContent value="vcf">
                <VcfTab onLeadsImported={handleImport} />
              </TabsContent>

              <TabsContent value="groups">
                {groupsInstance ? (
                  <div className="space-y-3">
                    {!linkedInstance && (
                      <p className="text-xs text-muted-foreground">
                        Grupos da instância <strong>{groupsInstance.name}</strong>.
                      </p>
                    )}
                    <GroupsTab instance={groupsInstance} onLeadsImported={handleImport} />
                  </div>
                ) : (
                  <div className="space-y-3 py-2">
                    <div>
                      <Label>Instância para buscar os grupos</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Esta base não está vinculada a uma instância. Escolha de qual instância carregar os grupos.
                      </p>
                    </div>
                    <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {(instances || []).map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportContactsDialog;
