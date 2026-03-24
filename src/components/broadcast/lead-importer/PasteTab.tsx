import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parsePhoneToJid, formatPhoneDisplay } from '@/lib/phoneUtils';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

interface PasteTabProps {
  onLeadsImported: (leads: Lead[]) => void;
}

const PasteTab = ({ onLeadsImported }: PasteTabProps) => {
  const [pasteText, setPasteText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const handlePasteImport = () => {
    if (!pasteText.trim()) {
      toast.error('Cole os números para importar');
      return;
    }

    setIsParsing(true);

    const lines = pasteText.split(/[\n,;\t]+/).map(l => l.trim()).filter(Boolean);
    const leads: Lead[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      let name: string | undefined;
      let phone: string;

      if (line.includes('-')) {
        const parts = line.split('-').map(p => p.trim());
        if (parts.length >= 2) {
          const firstIsPhone = /\d{8,}/.test(parts[0].replace(/\D/g, ''));
          if (firstIsPhone) {
            phone = parts[0];
            name = parts.slice(1).join('-');
          } else {
            name = parts[0];
            phone = parts.slice(1).join('-');
          }
        } else {
          phone = line;
        }
      } else {
        phone = line;
      }

      const jid = parsePhoneToJid(phone);
      if (jid) {
        leads.push({
          id: crypto.randomUUID(),
          phone: formatPhoneDisplay(phone),
          name: name || undefined,
          jid,
          source: 'paste',
        });
      } else {
        errors.push(`Linha ${index + 1}: "${line}" - número inválido`);
      }
    });

    setIsParsing(false);

    if (leads.length > 0) {
      onLeadsImported(leads);
      setPasteText('');
      toast.success(`${leads.length} contato${leads.length !== 1 ? 's' : ''} importado${leads.length !== 1 ? 's' : ''}`);
    }

    if (errors.length > 0 && errors.length <= 3) {
      toast.error(errors.join('\n'));
    } else if (errors.length > 3) {
      toast.error(`${errors.length} números inválidos não foram importados`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Cole a lista de números</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Um número por linha, ou separados por vírgula. Formato: "Nome - Número" ou apenas o número.
        </p>
        <Textarea
          placeholder={`Exemplos:\n11999998888\n+55 21 98765-4321\nJoão Silva - 11988887777\nMaria, 21999996666`}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
      </div>
      <Button onClick={handlePasteImport} disabled={isParsing || !pasteText.trim()}>
        {isParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardPaste className="w-4 h-4 mr-2" />}
        Importar Contatos
      </Button>
    </div>
  );
};

export default PasteTab;
