import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Bot } from 'lucide-react';
import { KnowledgeConfig } from '@/components/admin/ai-agent/KnowledgeConfig';

interface AIAgent {
  id: string;
  name: string;
  instance_id: string;
}

const AIAgentKnowledge = () => {
  const { isSuperAdmin } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, instance_id')
        .order('name');
      if (error) throw error;
      const list = (data || []) as AIAgent[];
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id);
      }
    } catch (err) {
      handleError(err, 'Erro ao carregar agentes', 'Fetch agents for knowledge');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, []);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <p className="font-semibold">Nenhum agente configurado</p>
          <p className="text-sm text-muted-foreground">Crie um agente primeiro na pagina de Configuracao</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground">FAQ, documentos e midias do agente</p>
          </div>
        </div>
        {agents.length > 1 && (
          <Select value={selectedAgentId || ''} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione o agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selectedAgentId && <KnowledgeConfig agentId={selectedAgentId} />}
    </div>
  );
};

export default AIAgentKnowledge;
