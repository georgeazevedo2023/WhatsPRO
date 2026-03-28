import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Scan, Plus, Trash2, User, MapPin, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExtractionField {
  key: string;
  label: string;
  type: 'text' | 'tags';
  enabled: boolean;
  section?: string;
}

interface ExtractionConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

const PROFILE_FIELDS: ExtractionField[] = [
  { key: 'nome', label: 'Nome completo', type: 'text', enabled: true, section: 'profile' },
  { key: 'aniversario', label: 'Data de aniversário', type: 'text', enabled: false, section: 'profile' },
  { key: 'cidade', label: 'Cidade', type: 'text', enabled: true, section: 'profile' },
  { key: 'bairro', label: 'Bairro', type: 'text', enabled: true, section: 'profile' },
  { key: 'interesses', label: 'Interesses / Produtos', type: 'tags', enabled: true, section: 'profile' },
  { key: 'motivo', label: 'Motivo do contato', type: 'text', enabled: true, section: 'profile' },
  { key: 'ticket_medio', label: 'Ticket médio (R$)', type: 'text', enabled: true, section: 'profile' },
  { key: 'orcamento', label: 'Orçamento / Faixa de preço', type: 'text', enabled: false, section: 'profile' },
];

const ADDRESS_FIELDS: ExtractionField[] = [
  { key: 'rua', label: 'Rua', type: 'text', enabled: true, section: 'address' },
  { key: 'numero', label: 'Número', type: 'text', enabled: true, section: 'address' },
  { key: 'bairro_end', label: 'Bairro', type: 'text', enabled: true, section: 'address' },
  { key: 'cidade_end', label: 'Cidade', type: 'text', enabled: true, section: 'address' },
  { key: 'cep', label: 'CEP', type: 'text', enabled: true, section: 'address' },
];

const CUSTOM_DEFAULTS: ExtractionField[] = [
  { key: 'email', label: 'E-mail', type: 'text', enabled: true, section: 'custom' },
  { key: 'documento', label: 'CPF / CNPJ', type: 'text', enabled: true, section: 'custom' },
  { key: 'profissao', label: 'Profissão', type: 'text', enabled: false, section: 'custom' },
  { key: 'site', label: 'Site', type: 'text', enabled: false, section: 'custom' },
];

const ALL_DEFAULTS = [...PROFILE_FIELDS, ...ADDRESS_FIELDS, ...CUSTOM_DEFAULTS];

export function ExtractionConfig({ config, onChange }: ExtractionConfigProps) {
  const fields: ExtractionField[] = config.extraction_fields?.length
    ? config.extraction_fields
    : ALL_DEFAULTS;

  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const addressEnabled = config.extraction_address_enabled ?? false;

  const updateFields = (updated: ExtractionField[]) => {
    onChange({ extraction_fields: updated });
  };

  const toggleField = (index: number) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    updateFields(updated);
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], label };
    updateFields(updated);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const addField = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const label = newLabel.trim();
    if (!key || !label) {
      if (!key && newKey.trim()) toast?.error?.('Chave inválida — use apenas letras, números e _');
      return;
    }
    if (fields.some(f => f.key === key)) {
      toast?.error?.(`Campo "${key}" já existe`);
      return;
    }

    updateFields([...fields, { key, label, type: 'text', enabled: true, section: 'custom' }]);
    setNewKey('');
    setNewLabel('');
  };

  const profileFields = fields.filter(f => f.section === 'profile' || (!f.section && PROFILE_FIELDS.some(d => d.key === f.key)));
  const addressFields = fields.filter(f => f.section === 'address');
  const customFields = fields.filter(f => f.section === 'custom' || (!f.section && !PROFILE_FIELDS.some(d => d.key === f.key) && !ADDRESS_FIELDS.some(d => d.key === f.key)));

  const renderFieldRow = (field: ExtractionField, globalIndex: number) => (
    <div key={field.key} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <Switch checked={field.enabled} onCheckedChange={() => toggleField(globalIndex)} />
      <div className="flex-1 min-w-0">
        <Input
          value={field.label}
          onChange={(e) => updateLabel(globalIndex, e.target.value)}
          className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
        />
        <span className="text-[9px] text-muted-foreground font-mono">chave: {field.key}</span>
      </div>
      {!ALL_DEFAULTS.some(d => d.key === field.key) && (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeField(globalIndex)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scan className="w-4 h-4 text-primary" />
            Campos de Extração
          </CardTitle>
          <CardDescription>
            Configure quais dados o agente deve extrair das conversas. Campos ativos aparecem no prompt do agente e no cartão do lead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={['profile', 'custom']} className="w-full">
            {/* Perfil */}
            <AccordionItem value="profile">
              <AccordionTrigger className="text-sm font-medium gap-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Perfil do Lead
                  <span className="text-[10px] text-muted-foreground font-normal">({profileFields.filter(f => f.enabled).length} ativos)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {profileFields.map((f) => renderFieldRow(f, fields.indexOf(f)))}
              </AccordionContent>
            </AccordionItem>

            {/* Endereço */}
            <AccordionItem value="address">
              <AccordionTrigger className="text-sm font-medium gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Endereço
                  <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={addressEnabled}
                      onCheckedChange={(v) => onChange({ extraction_address_enabled: v })}
                      className="scale-75"
                    />
                    <span className="text-[10px] text-muted-foreground font-normal">{addressEnabled ? 'Ativo' : 'Desativado'}</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className={`space-y-2 pt-2 ${!addressEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {addressFields.map((f) => renderFieldRow(f, fields.indexOf(f)))}
              </AccordionContent>
            </AccordionItem>

            {/* Campos Adicionais */}
            <AccordionItem value="custom">
              <AccordionTrigger className="text-sm font-medium gap-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Campos Adicionais
                  <span className="text-[10px] text-muted-foreground font-normal">({customFields.filter(f => f.enabled).length} ativos)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {customFields.map((f) => renderFieldRow(f, fields.indexOf(f)))}

                {/* Add custom field */}
                <div className="border-t pt-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">Adicionar campo</Label>
                  <div className="flex items-center gap-2">
                    <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Chave" className="h-7 text-sm flex-1" />
                    <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nome" className="h-7 text-sm flex-1" />
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addField} disabled={!newKey.trim() || !newLabel.trim()}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
