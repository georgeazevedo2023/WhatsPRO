import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Headphones, Send, Users, Clock, BarChart, ShieldCheck, Columns3, Loader2 } from 'lucide-react';
import DocumentViewer from './DocumentViewer';

interface DocModule {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  version: string;
  file: string; // filename in public/docs/
}

const modules: DocModule[] = [
  { id: 'instances', name: 'Instâncias WhatsApp', description: 'Conexão, QR Code, sincronização UAZAPI', icon: Server, version: 'v1.1', file: 'instances-prd' },
  { id: 'helpdesk', name: 'Helpdesk / Atendimento', description: 'Chat real-time, conversas, labels, departamentos', icon: Headphones, version: 'v1.0', file: 'helpdesk-prd' },
  { id: 'helpdesk-media', name: 'Helpdesk: Mídia', description: 'Texto, imagem, áudio, vídeo, documento, sticker', icon: Headphones, version: 'v1.0', file: 'helpdesk-media-prd' },
  { id: 'helpdesk-chat', name: 'Helpdesk: Chat', description: 'Emojis, envio de arquivos, notas privadas, áudio', icon: Headphones, version: 'v1.0', file: 'helpdesk-chat-features-prd' },
  { id: 'helpdesk-filters', name: 'Helpdesk: Filtros', description: 'Filtros avançados, cartão de contato, histórico', icon: Headphones, version: 'v1.0', file: 'helpdesk-filters-contact-prd' },
  { id: 'broadcast-groups', name: 'Broadcast (Grupos)', description: 'Envio em massa, carrossel, templates', icon: Send, version: 'v1.0', file: 'broadcast-groups-prd' },
  { id: 'broadcast-leads', name: 'Broadcast (Leads)', description: 'Base de leads, verificação, envio individual', icon: Users, version: 'v1.0', file: 'broadcast-leads-prd' },
  { id: 'scheduling', name: 'Agendamentos', description: 'Mensagens agendadas, recorrência, logs', icon: Clock, version: 'v1.0', file: 'scheduling-prd' },
  { id: 'kanban', name: 'CRM / Kanban', description: 'Boards, colunas, cards, campos dinâmicos', icon: Columns3, version: 'v1.0', file: 'kanban-prd' },
  { id: 'dashboard', name: 'Dashboard / Analytics', description: 'Métricas, gráficos, filtros', icon: BarChart, version: 'v1.0', file: 'dashboard-prd' },
  { id: 'admin', name: 'Administração', description: 'Caixas, usuários, equipe, departamentos', icon: ShieldCheck, version: 'v1.0', file: 'admin-prd' },
];

const DocumentationTab: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<DocModule | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const openDoc = useCallback(async (mod: DocModule) => {
    setSelectedModule(mod);
    setLoading(true);
    try {
      const res = await fetch(`/docs/${mod.file}.md`);
      setContent(await res.text());
    } catch {
      setContent('Erro ao carregar documentação.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Documentação dos Módulos</h2>
        <p className="text-sm text-muted-foreground mt-1">PRDs completos — clique para visualizar</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.id} className="cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all" onClick={() => openDoc(mod)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <Badge className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{mod.version}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{mod.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedModule && (
        loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : content ? (
          <DocumentViewer
            open={!!selectedModule}
            onOpenChange={(open) => { if (!open) { setSelectedModule(null); setContent(null); } }}
            title={selectedModule.name}
            version={selectedModule.version}
            content={content}
          />
        ) : null
      )}
    </div>
  );
};

export default DocumentationTab;
