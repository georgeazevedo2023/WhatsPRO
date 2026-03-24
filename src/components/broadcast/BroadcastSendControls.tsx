import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, Clock, Image, Video, Mic, FileIcon, Send, LayoutGrid } from 'lucide-react';
import ParticipantSelector from './ParticipantSelector';
import type { Group } from '@/types';
import type { MediaType, ActiveTab } from '@/lib/broadcastSender';

interface BroadcastSendControlsProps {
  activeTab: ActiveTab;
  selectedGroups: Group[];
  excludeAdmins: boolean;
  setExcludeAdmins: (v: boolean) => void;
  selectedParticipants: Set<string>;
  onParticipantSelectionChange: (selected: Set<string>) => void;
  uniqueRegularMembersCount: number;
  totalMembers: number;
  totalRegularMembers: number;
  randomDelay: 'none' | '5-10' | '10-20';
  setRandomDelay: (v: 'none' | '5-10' | '10-20') => void;
  estimatedTime: { min: number; max: number } | null;
  formatDuration: (seconds: number) => string;
  mediaType: MediaType;
  isPtt: boolean;
  carouselCardCount: number;
  isSending: boolean;
  canSend: boolean;
  canSchedule: boolean;
  onSend: () => void;
  onSchedule: () => void;
}

const BroadcastSendControls = ({
  activeTab, selectedGroups, excludeAdmins, setExcludeAdmins,
  selectedParticipants, onParticipantSelectionChange,
  uniqueRegularMembersCount, totalMembers, totalRegularMembers,
  randomDelay, setRandomDelay, estimatedTime, formatDuration,
  mediaType, isPtt, carouselCardCount,
  isSending, canSend, canSchedule,
  onSend, onSchedule,
}: BroadcastSendControlsProps) => {
  const targetCount = excludeAdmins ? selectedParticipants.size : selectedGroups.length;

  return (
    <>
      {/* Toggle para excluir admins */}
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="exclude-admins-broadcast" className="text-sm font-medium cursor-pointer">
                Não enviar para Admins/Donos
              </Label>
              <p className="text-xs text-muted-foreground">
                {excludeAdmins 
                  ? `${selectedParticipants.size} de ${uniqueRegularMembersCount} contato(s) selecionado(s)`
                  : `Enviará para ${selectedGroups.length} grupo${selectedGroups.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>
          <Switch
            id="exclude-admins-broadcast"
            checked={excludeAdmins}
            onCheckedChange={setExcludeAdmins}
            disabled={isSending}
          />
        </div>

        {excludeAdmins && (
          <ParticipantSelector
            selectedGroups={selectedGroups}
            selectedParticipants={selectedParticipants}
            onSelectionChange={onParticipantSelectionChange}
            disabled={isSending}
          />
        )}
      </div>

      <div className="space-y-4 mt-4">
        {/* Delay selector */}
        <div className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                Intervalo entre envios (anti-bloqueio)
              </Label>
              <p className="text-xs text-muted-foreground">
                Adiciona delay aleatório para evitar detecção de spam
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(['none', '5-10', '10-20'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={randomDelay === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRandomDelay(value)}
                disabled={isSending}
              >
                {value === 'none' ? 'Desativado' : value === '5-10' ? '5-10 seg' : '10-20 seg'}
              </Button>
            ))}
          </div>

          {estimatedTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/50 rounded-md px-3 py-2">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Tempo estimado: <span className="font-medium text-foreground">{formatDuration(estimatedTime.min)} - {formatDuration(estimatedTime.max)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Deduplication info */}
        {excludeAdmins && totalRegularMembers > uniqueRegularMembersCount && (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm text-muted-foreground">
            <span className="font-medium text-primary">Deduplicação ativa:</span> {totalRegularMembers - uniqueRegularMembersCount} contato(s) em múltiplos grupos receberão apenas 1 mensagem.
          </div>
        )}

        {/* Summary */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="w-3 h-3" />
            {selectedGroups.length} grupo{selectedGroups.length !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {excludeAdmins ? selectedParticipants.size : (activeTab === 'carousel' ? selectedGroups.length : totalMembers)} destinatário{(excludeAdmins ? selectedParticipants.size : (activeTab === 'carousel' ? selectedGroups.length : totalMembers)) !== 1 ? 's' : ''}
          </Badge>
          {activeTab === 'carousel' && (
            <Badge variant="secondary" className="gap-1">
              <LayoutGrid className="w-3 h-3" />
              {carouselCardCount} card{carouselCardCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {activeTab === 'media' && (
            <Badge variant="secondary" className="gap-1">
              {mediaType === 'image' && <Image className="w-3 h-3" />}
              {mediaType === 'video' && <Video className="w-3 h-3" />}
              {mediaType === 'audio' && <Mic className="w-3 h-3" />}
              {mediaType === 'file' && <FileIcon className="w-3 h-3" />}
              {mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : mediaType === 'audio' ? (isPtt ? 'Voz' : 'Áudio') : 'Arquivo'}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          {activeTab !== 'carousel' && (
            <Button
              variant="outline"
              onClick={onSchedule}
              disabled={isSending || !canSchedule}
              size="sm"
            >
              <Clock className="w-4 h-4 mr-2" />
              Agendar
            </Button>
          )}
          <Button
            onClick={onSend}
            disabled={isSending || !canSend}
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            Enviar para {excludeAdmins ? selectedParticipants.size : (activeTab === 'carousel' ? selectedGroups.length : targetCount)}
          </Button>
        </div>
      </div>
    </>
  );
};

export default BroadcastSendControls;
