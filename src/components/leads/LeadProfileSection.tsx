import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactAvatar } from '@/components/helpdesk/ContactAvatar';
import { User, ShieldBan, Calendar, Phone, MapPin, Globe, Link2, FileText, Megaphone, Target } from 'lucide-react';
import { ORIGIN_OPTIONS } from './types';
import type { ExtractionField, InstanceOption } from './types';

interface LeadProfileSectionProps {
  contact: {
    display_name: string;
    phone: string;
    profile_pic_url: string | null;
    first_contact_at: string;
    tags: string[];
    label_names: string[];
    ia_blocked_instances: string[];
    kanban_stage: string | null;
    kanban_color: string | null;
    kanban_board_id: string | null;
  };
  leadProfile: any;
  extractionFields: ExtractionField[];
  extractedData: Record<string, string>;
  instances: InstanceOption[];
  editOrigin: string;
  setEditOrigin: (v: string) => void;
  editBirthDate: string;
  setEditBirthDate: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editDocument: string;
  setEditDocument: (v: string) => void;
  onToggleBlockInstance: (instanceId: string) => void;
}

/** M15 — Visual badge showing lead origin (campanha, bio, formulario, organic) */
function OriginBadge({ origin, tags }: { origin: string; tags: string[] }) {
  // Extract specific source name from tags
  const bioTag = tags.find(t => t.startsWith('bio_page:'))
  const campaignTag = tags.find(t => t.startsWith('campanha:'))
  const formTag = tags.find(t => t.startsWith('formulario:'))
  const funnelTag = tags.find(t => t.startsWith('funil:'))

  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    bio: {
      icon: <Link2 className="w-3 h-3" />,
      label: bioTag ? `Bio Link: ${bioTag.split(':')[1]}` : 'Bio Link',
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    campanha: {
      icon: <Megaphone className="w-3 h-3" />,
      label: campaignTag ? `Campanha: ${campaignTag.split(':')[1]}` : 'Campanha',
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    formulario: {
      icon: <FileText className="w-3 h-3" />,
      label: formTag ? `Formulário: ${formTag.split(':')[1]}` : 'Formulário',
      className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    },
    funil: {
      icon: <Target className="w-3 h-3" />,
      label: funnelTag ? `Funil: ${funnelTag.split(':')[1]}` : 'Funil',
      className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    },
  }

  const c = config[origin] || {
    icon: <Globe className="w-3 h-3" />,
    label: origin || 'Orgânico',
    className: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <Badge variant="outline" className={`text-xs px-2.5 py-1 gap-1.5 font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </Badge>
  )
}

export function LeadProfileSection({
  contact, leadProfile, extractionFields, extractedData, instances,
  editOrigin, setEditOrigin, editBirthDate, setEditBirthDate,
  editEmail, setEditEmail, editDocument, setEditDocument,
  onToggleBlockInstance,
}: LeadProfileSectionProps) {
  const lp = leadProfile || {};
  const profileFields = extractionFields.filter(f =>
    f.section === 'profile' || (!f.section && ['nome', 'cidade', 'bairro', 'interesses', 'orcamento', 'aniversario'].includes(f.key))
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Perfil do Lead
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Header with avatar */}
        <div className="flex items-start gap-4">
          <ContactAvatar src={contact.profile_pic_url} name={contact.display_name} size={80} />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">{contact.display_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span className="text-base font-mono">{contact.phone}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Desde {new Date(contact.first_contact_at).toLocaleDateString('pt-BR')}</span>
              {lp.total_interactions && <span>· {lp.total_interactions} interações</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contact.label_names.map(l => (
                <Badge key={l} className="text-xs bg-primary/15 text-primary">{l}</Badge>
              ))}
              {contact.kanban_stage && (
                <Badge variant="outline" className="text-xs" style={{ borderColor: contact.kanban_color || undefined, color: contact.kanban_color || undefined }}>
                  {contact.kanban_stage}
                </Badge>
              )}
              {contact.ia_blocked_instances.length > 0 && (
                <Badge variant="destructive" className="text-xs">IA Bloqueada ({contact.ia_blocked_instances.length})</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Extracted data from tags */}
        {profileFields.filter(f => f.enabled && extractedData[f.key]).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {profileFields.filter(f => f.enabled && extractedData[f.key]).map(f => (
              <div key={f.key} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium truncate mt-0.5">{extractedData[f.key]}</p>
              </div>
            ))}
          </div>
        )}

        {/* Origin badge — M15 */}
        {lp.origin && (
          <div>
            <Label className="text-xs text-muted-foreground">Origem do Lead</Label>
            <div className="mt-1.5">
              <OriginBadge origin={lp.origin} tags={contact.tags} />
            </div>
          </div>
        )}

        {/* Tags */}
        {contact.tags.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {contact.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
            </div>
          </div>
        )}

        {/* Editable fields grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Select value={editOrigin} onValueChange={setEditOrigin}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
              <SelectContent>
                {ORIGIN_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Aniversário</Label>
            <Input value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)} placeholder="DD/MM/AAAA" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cidade</Label>
            <Input value={extractedData['cidade'] || lp.city || ''} readOnly className="mt-1 bg-muted/30" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Bairro</Label>
            <Input value={extractedData['bairro'] || ''} readOnly className="mt-1 bg-muted/30" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@exemplo.com" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Documento (CPF/CNPJ)</Label>
            <Input value={editDocument} onChange={e => setEditDocument(e.target.value)} placeholder="000.000.000-00" className="mt-1" />
          </div>
        </div>

        {/* Block IA per instance */}
        <div className="p-4 rounded-lg border space-y-3">
          <div className="flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-medium">Bloquear IA por instância</p>
          </div>
          <div className="space-y-2">
            {instances.map(inst => {
              const blocked = contact.ia_blocked_instances.includes(inst.id);
              return (
                <div key={inst.id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{inst.name}</span>
                  <Switch checked={blocked} onCheckedChange={() => onToggleBlockInstance(inst.id)} />
                </div>
              );
            })}
            {instances.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma instância</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
