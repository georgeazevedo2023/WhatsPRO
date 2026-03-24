import { memo } from 'react';
import type { Instance } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Server, Wifi, WifiOff, QrCode, MoreVertical, Trash2, Eye, UserCog, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';


interface InstanceCardProps {
  instance: Instance;
  showOwner?: boolean;
  onConnect?: (instance: Instance) => void;
  onDelete?: (instance: Instance) => void;
  onViewGroups?: (instance: Instance) => void;
  onManageAccess?: (instance: Instance) => void;
  isLoadingQr?: boolean;
}

const InstanceCard = ({
  instance,
  showOwner,
  onConnect,
  onDelete,
  onViewGroups,
  onManageAccess,
  isLoadingQr,
}: InstanceCardProps) => {
  const navigate = useNavigate();

  const isConnected = instance.status === 'connected' || instance.status === 'online';

  const handleConnect = () => {
    onConnect?.(instance);
  };

  const handleViewDetails = () => {
    navigate(`/dashboard/instances/${instance.id}`);
  };

  const phoneNumber = instance.owner_jid?.split('@')[0];

  return (
    <Card className="glass-card-hover group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-border">
              <AvatarImage src={instance.profile_pic_url || undefined} />
              <AvatarFallback className="bg-secondary">
                <Server className="w-5 h-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground">{instance.name}</h3>
              {phoneNumber && (
                <p className="text-sm text-muted-foreground">+{phoneNumber}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onManageAccess && (
                <DropdownMenuItem onClick={() => onManageAccess(instance)}>
                  <UserCog className="w-4 h-4 mr-2" />
                  Gerenciar Acesso
                </DropdownMenuItem>
              )}
              {onDelete && onManageAccess && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(instance)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5',
              isConnected
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                Desconectado
              </>
            )}
          </Badge>
          {showOwner && instance.user_profiles && (
            <span className="text-xs text-muted-foreground">
              {instance.user_profiles.full_name || instance.user_profiles.email}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {!isConnected && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleConnect}
              disabled={isLoadingQr}
            >
              {isLoadingQr ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Conectar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleViewDetails}
          >
            <Eye className="w-4 h-4 mr-2" />
            Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(InstanceCard);
