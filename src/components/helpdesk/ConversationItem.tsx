import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { smartDateBR } from '@/lib/dateUtils';
import { ConversationLabels } from './ConversationLabels';
import type { Label, Conversation } from '@/types';
import { PRIORITY_COLOR_MAP } from '@/lib/constants';
import { UserCheck, StickyNote, Building2, Clock } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  labels?: Label[];
  agentName?: string | null;
  hasNotes?: boolean;
}

export const ConversationItem = memo(function ConversationItem({ conversation, isSelected, onClick, labels = [], agentName, hasNotes }: ConversationItemProps) {
  const contact = conversation.contact;
  const name = contact?.name || contact?.phone || 'Desconhecido';
  const initials = name.charAt(0).toUpperCase();

  // Calculate wait time for unresolved conversations
  const getWaitInfo = () => {
    if (conversation.status === 'resolvida' || !conversation.last_message_at) return null;
    const now = Date.now();
    const lastMsg = new Date(conversation.last_message_at).getTime();
    const diffMin = Math.floor((now - lastMsg) / 60000);
    if (diffMin < 1) return null;

    let label: string;
    if (diffMin < 60) {
      label = `${diffMin}m`;
    } else if (diffMin < 1440) {
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      label = mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
    } else {
      const days = Math.floor(diffMin / 1440);
      label = `${days}d`;
    }

    // Subtle opacity-based urgency (no harsh reds)
    let opacity: string;
    if (diffMin < 15) opacity = 'opacity-50';
    else if (diffMin < 60) opacity = 'opacity-70';
    else opacity = 'opacity-90';

    return { label, opacity };
  };

  const waitInfo = getWaitInfo();
  const hasDraft = !!localStorage.getItem(`helpdesk-draft-${conversation.id}`);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left pl-4 pr-4 py-3 min-h-[60px] flex items-start gap-3 transition-all duration-150 hover:bg-muted/50 active:bg-muted/70 border-l-[3px] border-transparent',
        isSelected && 'bg-primary/8 !border-primary',
        !isSelected && !conversation.is_read && 'bg-primary/[0.03]'
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="w-10 h-10">
          <AvatarImage src={contact?.profile_pic_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
            PRIORITY_COLOR_MAP[conversation.priority] || 'bg-muted'
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm truncate', !conversation.is_read && 'font-bold')}>
            {name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {waitInfo && (
              <span className={cn('inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums', waitInfo.opacity)}>
                <Clock className="w-2.5 h-2.5" />
                {waitInfo.label}
              </span>
            )}
            <span className="text-xs text-muted-foreground/80 tabular-nums">
              {conversation.last_message_at
                ? smartDateBR(conversation.last_message_at)
                : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate flex-1">
            {conversation.last_message || conversation.inbox?.name || ''}
          </p>
          {!conversation.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          )}
        </div>

        {(labels.length > 0 || agentName || hasNotes || hasDraft || conversation.department_name) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {conversation.department_name && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 rounded px-1 py-0.5">
                <Building2 className="w-2.5 h-2.5" />
                {conversation.department_name}
              </span>
            )}
            {agentName && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-secondary/50 rounded px-1 py-0.5">
                <UserCheck className="w-2.5 h-2.5" />
                {agentName}
              </span>
            )}
            {hasNotes && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-warning bg-secondary/50 rounded px-1 py-0.5">
                <StickyNote className="w-2.5 h-2.5" />
                Nota
              </span>
            )}
            {hasDraft && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 rounded px-1 py-0.5">
                Rascunho
              </span>
            )}
            {labels.length > 0 && <ConversationLabels labels={labels} size="sm" />}
          </div>
        )}
      </div>
    </button>
  );
});
