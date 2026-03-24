import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Users,
  MessageSquare,
  Image,
  Video,
  Mic,
  FileIcon,
  ChevronDown,
  ChevronUp,
  Shield,
  StopCircle,
  Timer,
  RefreshCw,
  Play,
  LayoutGrid,
  Trash2,
  User,
} from 'lucide-react';
import { formatBR } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import type { BroadcastLog } from './BroadcastHistoryTypes';
import type { HistoryCarouselData } from './HistoryCarouselPreview';
import { HistoryMessagePreview } from './HistoryMessagePreview';

interface BroadcastLogCardProps {
  log: BroadcastLog;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelection: (id: string, e: React.MouseEvent) => void;
  onDelete: (log: BroadcastLog, e: React.MouseEvent) => void;
  onResend?: (log: BroadcastLog) => void;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Concluído
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          <StopCircle className="w-3 h-3 mr-1" />
          Cancelado
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Erro
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
};

export const getMessageTypeIcon = (type: string) => {
  switch (type) {
    case 'image':
      return <Image className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'audio':
    case 'ptt':
      return <Mic className="w-4 h-4" />;
    case 'document':
      return <FileIcon className="w-4 h-4" />;
    case 'carousel':
      return <LayoutGrid className="w-4 h-4" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
};

export const getMessageTypeLabel = (type: string) => {
  switch (type) {
    case 'image':
      return 'Imagem';
    case 'video':
      return 'Vídeo';
    case 'audio':
    case 'ptt':
      return 'Áudio';
    case 'document':
      return 'Documento';
    case 'carousel':
      return 'Carrossel';
    default:
      return 'Texto';
  }
};

const getDeliveryRate = (success: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((success / total) * 100);
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }
  return secs > 0 ? `${minutes}min ${secs}s` : `${minutes}min`;
};

const BroadcastLogCard = ({
  log,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelection,
  onDelete,
  onResend,
}: BroadcastLogCardProps) => {
  const deliveryRate = getDeliveryRate(log.recipients_success, log.recipients_targeted);

  return (
    <div
      className={cn(
        "border rounded-lg p-2.5 sm:p-3 bg-background/50 hover:bg-background/80 transition-colors",
        isSelected && "ring-2 ring-primary/50 border-primary/50"
      )}
    >
      <div
        className="flex items-start sm:items-center justify-between cursor-pointer gap-2"
        onClick={() => onToggleExpand(log.id)}
      >
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Checkbox for selection */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection(log.id, e as unknown as React.MouseEvent);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-border shrink-0 mt-1 sm:mt-0"
          />
          <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 shrink-0">
            {getMessageTypeIcon(log.message_type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {getStatusBadge(log.status)}
              <Badge variant="outline" className="text-xs">
                {getMessageTypeLabel(log.message_type)}
              </Badge>
              {log.groups_targeted === 0 ? (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                  <User className="w-3 h-3 mr-0.5" />
                  <span className="hidden sm:inline">Leads</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-0.5" />
                  <span>{log.groups_targeted}</span>
                  <span className="hidden sm:inline ml-0.5">grupo{log.groups_targeted !== 1 ? 's' : ''}</span>
                </Badge>
              )}
              {log.random_delay && log.random_delay !== 'none' && (
                <Badge variant="outline" className="text-xs hidden sm:flex">
                  <Shield className="w-3 h-3 mr-1" />
                  {log.random_delay === '5-10' ? '5-10s' : '10-20s'}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
              {log.instance_name || log.instance_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs sm:text-sm font-medium">
              {log.recipients_success}/{log.recipients_targeted}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              {deliveryRate}%
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t space-y-3 sm:space-y-4">
          {/* Group/Lead Names */}
          {log.group_names && log.group_names.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                {log.groups_targeted === 0 ? (
                  <>
                    <User className="w-3 h-3" />
                    Leads ({log.group_names.length}):
                  </>
                ) : (
                  <>
                    <Users className="w-3 h-3" />
                    Grupos ({log.group_names.length}):
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-1">
                {log.group_names.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Message Preview */}
          {(log.content || log.media_url || log.carousel_data) && (
            <HistoryMessagePreview
              type={log.message_type}
              content={log.content}
              mediaUrl={log.media_url}
              carouselData={log.carousel_data as unknown as HistoryCarouselData | null}
            />
          )}

          {/* Stats Grid - Dates */}
          <div className="grid grid-cols-1 gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Play className="w-3.5 h-3.5 text-green-500" />
              <span className="truncate">
                Início: {formatBR(log.started_at, "dd/MM/yy 'às' HH:mm")}
              </span>
            </div>
            {log.completed_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">
                  Fim: {formatBR(log.completed_at, "dd/MM/yy 'às' HH:mm")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="w-3.5 h-3.5" />
              <span>Duração: {formatDuration(log.duration_seconds)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>
                {log.exclude_admins ? 'Excluindo admins' : 'Todos os membros'}
              </span>
            </div>
          </div>

          {/* Recipients Stats */}
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-600">{log.recipients_success} sucesso</span>
            </div>
            {log.recipients_failed > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600">{log.recipients_failed} falha</span>
              </div>
            )}
          </div>

          {log.error_message && (
            <div className="p-2 bg-destructive/10 rounded text-xs sm:text-sm text-destructive">
              <p className="text-xs mb-1">Erro:</p>
              <p>{log.error_message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onResend && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs sm:text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onResend(log);
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reenviar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
              onClick={(e) => onDelete(log, e)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastLogCard;
