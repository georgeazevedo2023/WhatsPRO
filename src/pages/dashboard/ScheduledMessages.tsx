import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatBR } from "@/lib/dateUtils";
import {
  Calendar,
  Clock,
  Repeat,
  Pause,
  Play,
  Trash2,
  MessageSquare,
  Image,
  FileText,
  Music,
  Video,
  Mic,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ScheduledMessage {
  id: string;
  group_jid: string;
  group_name: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  scheduled_at: string;
  next_run_at: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_interval: number;
  random_delay: 'none' | '5-10' | '10-20' | null;
  status: string;
  executions_count: number;
  last_executed_at: string | null;
  last_error: string | null;
  created_at: string;
  instances: {
    name: string;
  };
}

interface MessageLog {
  id: string;
  executed_at: string;
  status: string;
  recipients_total: number | null;
  recipients_success: number | null;
  recipients_failed: number | null;
  error_message: string | null;
}

const MESSAGE_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <MessageSquare className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  audio: <Music className="h-4 w-4" />,
  ptt: <Mic className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
};

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "default" },
  processing: { label: "Processando", variant: "secondary" },
  completed: { label: "Concluído", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
  paused: { label: "Pausado", variant: "secondary" },
};

function ScheduledMessageCard({ 
  message, 
  onPause, 
  onResume, 
  onCancel,
  isUpdating 
}: { 
  message: ScheduledMessage;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: logs } = useQuery({
    queryKey: ["scheduled-message-logs", message.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_message_logs")
        .select("*")
        .eq("scheduled_message_id", message.id)
        .order("executed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as MessageLog[];
    },
    enabled: isOpen,
  });

  const statusBadge = STATUS_BADGES[message.status] || STATUS_BADGES.pending;

  return (
    <Card className="glass-card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {MESSAGE_TYPE_ICONS[message.message_type]}
              {message.group_name || message.group_jid}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <span>{message.instances?.name}</span>
              {message.is_recurring && (
                <span className="flex items-center gap-1 text-xs">
                  <Repeat className="h-3 w-3" />
                  {message.recurrence_type === "daily" && `A cada ${message.recurrence_interval} dia(s)`}
                  {message.recurrence_type === "weekly" && `A cada ${message.recurrence_interval} semana(s)`}
                  {message.recurrence_type === "monthly" && `A cada ${message.recurrence_interval} mês(es)`}
                </span>
              )}
              {message.random_delay && message.random_delay !== 'none' && (
                <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <Shield className="h-3 w-3" />
                  {message.random_delay === '5-10' ? '5-10s' : '10-20s'}
                </span>
              )}
            </CardDescription>
          </div>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Content Preview */}
        {message.content && (
          <p className="text-sm text-muted-foreground line-clamp-2 bg-muted/50 p-2 rounded">
            {message.content}
          </p>
        )}

        {/* Schedule Info */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Próximo: {formatBR(message.next_run_at, "dd/MM/yyyy 'às' HH:mm")}
            </span>
          </div>
          {message.executions_count > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{message.executions_count} execução(ões)</span>
            </div>
          )}
        </div>

        {/* Last Error */}
        {message.last_error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{message.last_error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {message.status === "pending" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPause}
              disabled={isUpdating}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pausar
            </Button>
          )}
          {message.status === "paused" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResume}
              disabled={isUpdating}
            >
              <Play className="h-4 w-4 mr-1" />
              Retomar
            </Button>
          )}
          {(message.status === "pending" || message.status === "paused") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O agendamento será cancelado permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancel}>
                    Confirmar Cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Logs Collapsible */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-auto">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                Histórico
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {logs && logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {log.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {log.status === "partial" && (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        {log.status === "failed" && (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span>
                          {formatBR(log.executed_at, "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {log.recipients_success}/{log.recipients_total} enviados
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma execução registrada ainda.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScheduledMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("active");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["scheduled-messages", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*, instances(name)")
        .order("next_run_at", { ascending: true });

      if (error) throw error;
      return data as unknown as ScheduledMessage[];
    },
    enabled: !!user,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("scheduled_messages")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast.success("Status atualizado");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Erro ao atualizar";
      toast.error(msg);
    },
  });

  const activeMessages = messages?.filter(m => ["pending", "processing", "paused"].includes(m.status)) || [];
  const completedMessages = messages?.filter(m => m.status === "completed") || [];
  const failedMessages = messages?.filter(m => ["failed", "cancelled"].includes(m.status)) || [];

  const getTabMessages = () => {
    switch (activeTab) {
      case "active":
        return activeMessages;
      case "completed":
        return completedMessages;
      case "failed":
        return failedMessages;
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mensagens Agendadas</h1>
        <p className="text-muted-foreground">
          Gerencie seus envios programados e recorrentes.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Clock className="h-4 w-4" />
            Ativos ({activeMessages.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Concluídos ({completedMessages.length})
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-2">
            <XCircle className="h-4 w-4" />
            Falhas ({failedMessages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : getTabMessages().length === 0 ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">Nenhum agendamento</h3>
                <p className="text-muted-foreground max-w-sm">
                  {activeTab === "active" && "Você não tem mensagens agendadas no momento. Vá para um grupo e agende uma mensagem."}
                  {activeTab === "completed" && "Nenhum agendamento concluído ainda."}
                  {activeTab === "failed" && "Nenhum agendamento com falha."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {getTabMessages().map((message) => (
                <ScheduledMessageCard
                  key={message.id}
                  message={message}
                  onPause={() => updateStatusMutation.mutate({ id: message.id, status: "paused" })}
                  onResume={() => updateStatusMutation.mutate({ id: message.id, status: "pending" })}
                  onCancel={() => updateStatusMutation.mutate({ id: message.id, status: "cancelled" })}
                  isUpdating={updateStatusMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
