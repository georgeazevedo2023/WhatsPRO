import { CAMPAIGN_TEMPLATES, getCampaignTemplate } from '@/data/campaignTemplates';
import type { CampaignType } from '@/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CampaignAiTemplateProps {
  campaignType: CampaignType;
  aiTemplate: string;
  aiCustomText: string;
  onTypeChange: (type: CampaignType) => void;
  onTemplateChange: (template: string) => void;
  onCustomTextChange: (text: string) => void;
}

export function CampaignAiTemplate({
  campaignType,
  aiTemplate,
  aiCustomText,
  onTypeChange,
  onTemplateChange,
  onCustomTextChange,
}: CampaignAiTemplateProps) {
  const handleTypeChange = (type: CampaignType) => {
    onTypeChange(type);
    const tpl = getCampaignTemplate(type);
    if (tpl) onTemplateChange(tpl.template);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de campanha</Label>
        <Select value={campaignType} onValueChange={(v) => handleTypeChange(v as CampaignType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TEMPLATES.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                <div className="flex flex-col">
                  <span>{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Instrucao base para IA</Label>
        <Textarea
          value={aiTemplate}
          onChange={(e) => onTemplateChange(e.target.value)}
          rows={3}
          placeholder="Instrucao automatica baseada no tipo..."
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Esta instrucao e enviada ao Agente IA quando um lead chega por esta campanha.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Detalhes personalizados</Label>
        <Textarea
          value={aiCustomText}
          onChange={(e) => onCustomTextChange(e.target.value)}
          rows={3}
          placeholder="Ex: Oferecer combo Dia dos Pais com 20% OFF. Codigo PAIS20. Valido ate 15/08."
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Informacoes especificas desta campanha (produtos, precos, codigos, prazos).
        </p>
      </div>
    </div>
  );
}
