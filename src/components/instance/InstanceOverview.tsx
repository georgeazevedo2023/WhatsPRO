import { useState } from 'react';
import type { Instance } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQrConnect } from '@/hooks/useQrConnect';

import {
  Copy,
  QrCode,
  User,
  Calendar,
  Key,
  Phone,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBR } from '@/lib/dateUtils';

interface InstanceOverviewProps {
  instance: Instance;
  onUpdate: () => void;
}

const InstanceOverview = ({ instance, onUpdate }: InstanceOverviewProps) => {
  const [showToken, setShowToken] = useState(false);

  const qr = useQrConnect({ onConnected: onUpdate });
  const showQrDialog = qr.activeInstance?.id === instance.id;

  const isConnected = instance.status === 'connected' || instance.status === 'online';
  const phoneNumber = instance.owner_jid?.split('@')[0];

  const copyToken = () => {
    toast.info('Tokens são gerenciados de forma segura no servidor');
  };

  const handleCloseDialog = () => qr.close();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Informações da Instância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Informações da Instância
          </CardTitle>
          <CardDescription>Dados principais da conexão WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">Nome</Label>
            <p className="font-medium">{instance.name}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">Status</Label>
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
          </div>

          {phoneNumber && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase">Telefone</Label>
              <p className="font-medium">+{phoneNumber}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">ID da Instância</Label>
            <p className="font-mono text-sm text-muted-foreground">{instance.id}</p>
          </div>

          {!isConnected && (
            <Button onClick={() => qr.connect(instance)} className="w-full mt-4">
              <QrCode className="w-4 h-4 mr-2" />
              Conectar via QR Code
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Token de Acesso
          </CardTitle>
          <CardDescription>Token gerenciado de forma segura no servidor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">Token</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value="••••••••••••••••••••"
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyToken}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O token é utilizado internamente pelo servidor e não é mais exposto ao navegador.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Proprietário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Proprietário
          </CardTitle>
          <CardDescription>Usuário responsável pela instância</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">Nome</Label>
            <p className="font-medium">
              {instance.user_profiles?.full_name || 'Não informado'}
            </p>
          </div>
          {instance.user_profiles?.email && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase">Email</Label>
              <p className="text-sm text-muted-foreground">{instance.user_profiles.email}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Datas
          </CardTitle>
          <CardDescription>Informações de criação e atualização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">Criado em</Label>
            <p className="font-medium">
              {formatBR(instance.created_at, "dd 'de' MMMM 'de' yyyy 'às' HH:mm")}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase">Última atualização</Label>
            <p className="font-medium">
              {formatBR(instance.updated_at, "dd 'de' MMMM 'de' yyyy 'às' HH:mm")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar {instance.name}</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 gap-4">
            {qr.isLoadingQr ? (
              <div className="w-64 h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Gerando QR Code...</span>
                </div>
              </div>
            ) : qr.qrCode ? (
              <>
                <img
                  src={qr.qrCode}
                  alt="QR Code"
                  className="w-64 h-64 rounded-lg border"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Aguardando leitura do QR… (verificando status a cada 5s)
                </p>
              </>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-center px-4">
                  Erro ao gerar QR Code. Tente novamente.
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <Button variant="outline" onClick={handleCloseDialog}>
              Fechar
            </Button>
            <Button onClick={qr.regenerateQr} disabled={qr.isLoadingQr}>
              <RefreshCw className={cn("w-4 h-4 mr-2", qr.isLoadingQr && "animate-spin")} />
              Gerar novo QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstanceOverview;
