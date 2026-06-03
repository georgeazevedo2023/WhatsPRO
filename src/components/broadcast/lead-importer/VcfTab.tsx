import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Loader2, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { parsePhoneToJid, formatPhoneDisplay } from '@/lib/phoneUtils';
import { parseVcards } from '@/lib/vcfParser';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

interface VcfTabProps {
  onLeadsImported: (leads: Lead[]) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const isValidFileType = (fileName: string): boolean => fileName.toLowerCase().endsWith('.vcf');

const VcfTab = ({ onLeadsImported }: VcfTabProps) => {
  const [vcfFile, setVcfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsedLeads, setParsedLeads] = useState<Lead[] | null>(null);
  const [invalidCount, setInvalidCount] = useState(0);

  const resetState = () => {
    setVcfFile(null);
    setParsedLeads(null);
    setInvalidCount(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const parseFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const text = await file.text();
      const contacts = parseVcards(text);
      if (contacts.length === 0) {
        toast.error('Nenhum contato encontrado no arquivo .vcf');
        return;
      }

      const leads: Lead[] = [];
      const seen = new Set<string>();
      let invalid = 0;
      for (const c of contacts) {
        const jid = parsePhoneToJid(c.phone);
        if (!jid) { invalid++; continue; }
        if (seen.has(jid)) continue; // dedup intra-arquivo
        seen.add(jid);
        leads.push({
          id: crypto.randomUUID(),
          phone: formatPhoneDisplay(c.phone),
          name: c.name?.trim() || undefined,
          jid,
          source: 'vcf',
        });
      }

      if (leads.length === 0) {
        toast.error('Nenhum telefone válido no arquivo .vcf');
        return;
      }
      setVcfFile(file);
      setParsedLeads(leads);
      setInvalidCount(invalid);
    } catch (error) {
      handleError(error, 'Erro ao ler o arquivo .vcf', 'Parse VCF');
    } finally {
      setIsProcessing(false);
    }
  };

  const validateAndProcess = async (file: File) => {
    if (!isValidFileType(file.name)) { toast.error('Selecione um arquivo .vcf'); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error(`Arquivo muito grande (máx. ${MAX_FILE_SIZE / 1024 / 1024}MB)`); return; }
    await parseFile(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await validateAndProcess(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await validateAndProcess(file);
  };

  const handleConfirm = () => {
    if (!parsedLeads || parsedLeads.length === 0) return;
    const n = parsedLeads.length;
    onLeadsImported(parsedLeads);
    resetState();
    toast.success(`${n} contato${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''}`);
  };

  if (!parsedLeads) {
    return (
      <div className="space-y-4">
        <div>
          <Label>Arquivo de contatos (.vcf)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Exporte os contatos do seu celular ou do Google Contatos como .vcf (vCard). Pode conter vários contatos.
          </p>
        </div>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".vcf,text/vcard" onChange={handleFileUpload} className="hidden" />
          {isProcessing ? (
            <>
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground animate-spin" />
              <p className="font-medium">Lendo contatos...</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">ou arraste o arquivo aqui</p>
              <p className="text-xs text-muted-foreground mt-3">Formato: .vcf (vCard)</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={resetState}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Badge variant="outline">
          {vcfFile?.name} • {parsedLeads.length} válido{parsedLeads.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {invalidCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {invalidCount} número{invalidCount !== 1 ? 's' : ''} inválido{invalidCount !== 1 ? 's' : ''} ignorado{invalidCount !== 1 ? 's' : ''}.
        </p>
      )}

      <div>
        <Label className="mb-2 block">Preview</Label>
        <div className="border rounded-lg">
          <ScrollArea className="max-h-48">
            <div className="p-2 space-y-1">
              {parsedLeads.slice(0, 8).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 text-sm px-2 py-1">
                  <span className="font-medium truncate">{l.name || 'Sem nome'}</span>
                  <span className="text-muted-foreground shrink-0">{l.phone}</span>
                </div>
              ))}
              {parsedLeads.length > 8 && (
                <p className="text-xs text-muted-foreground px-2 pt-1">+{parsedLeads.length - 8} outro{parsedLeads.length - 8 !== 1 ? 's' : ''}…</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={resetState}>Cancelar</Button>
        <Button onClick={handleConfirm}>
          <Check className="w-4 h-4 mr-2" />
          Importar {parsedLeads.length} contato{parsedLeads.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
};

export default VcfTab;
